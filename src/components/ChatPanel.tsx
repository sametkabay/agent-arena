import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildSystemPrompt, chatCompletion } from "@/lib/ai/providers";
import { useArenaStore } from "@/store/arenaStore";

export function ChatPanel() {
  const { t } = useTranslation();
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const chatOpen = useArenaStore((s) => s.chatOpen);
  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const userName = useArenaStore((s) => s.userName);
  const chats = useArenaStore((s) => s.chats);
  const chatBusyById = useArenaStore((s) => s.chatBusyById);
  const appendChat = useArenaStore((s) => s.appendChat);
  const replaceLastAssistant = useArenaStore((s) => s.replaceLastAssistant);
  const setChatBusy = useArenaStore((s) => s.setChatBusy);
  const setAgentSpeech = useArenaStore((s) => s.setAgentSpeech);
  const selectAgent = useArenaStore((s) => s.selectAgent);
  const setChatOpen = useArenaStore((s) => s.setChatOpen);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const agent = agents.find((a) => a.id === selectedAgentId);
  const model = models.find((m) => m.id === agent?.modelConfigId);
  const messages = selectedAgentId ? chats[selectedAgentId] ?? [] : [];
  const busy = selectedAgentId ? Boolean(chatBusyById[selectedAgentId]) : false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedAgentId]);

  if (!chatOpen || !agent) return null;

  async function send() {
    const text = input.trim();
    if (!text || !agent || busy) return;
    if (!model) {
      appendChat(agent.id, { role: "system", content: t("chat.noModel") });
      return;
    }

    setInput("");
    const prior = (useArenaStore.getState().chats[agent.id] ?? []).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    appendChat(agent.id, { role: "user", content: text });
    appendChat(agent.id, { role: "assistant", content: "" });
    setChatBusy(agent.id, true);
    setAgentSpeech(agent.id, "…", 120000);

    const system = buildSystemPrompt(
      agent.systemPrompt,
      userName,
      agent.displayName,
      agent.skills ?? [],
    );
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    let assembled = "";
    try {
      const reply = await chatCompletion({
        model,
        signal: ac.signal,
        thinkingEnabled: agent.thinkingEnabled === true,
        messages: [
          { role: "system", content: system },
          ...prior,
          { role: "user", content: text },
        ],
        onToken: (chunk) => {
          assembled += chunk;
          replaceLastAssistant(agent.id, assembled);
          const preview = assembled.slice(-120);
          setAgentSpeech(agent.id, preview || "…", 120000);
        },
      });
      const finalText = (reply || assembled).trim() || "…";
      replaceLastAssistant(agent.id, finalText);
      setAgentSpeech(agent.id, finalText.slice(0, 160), 5000);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : t("chat.error");
      replaceLastAssistant(agent.id, "");
      appendChat(agent.id, { role: "system", content: msg });
      setAgentSpeech(agent.id, undefined);
    } finally {
      setChatBusy(agent.id, false);
    }
  }

  return (
    <div className="chat-popup">
      <header className="chat-popup__header">
        <div>
          <strong>{agent.displayName}</strong>
          <span className="chat-popup__meta">
            {model ? model.name : t("chat.noModel")}
          </span>
        </div>
        <button
          type="button"
          className="chat-popup__close"
          aria-label={t("chat.close")}
          onClick={() => {
            setChatOpen(false);
            selectAgent(null);
          }}
        >
          ×
        </button>
      </header>
      <div className="chat-popup__messages">
        {messages.length === 0 ? (
          <div className="chat-popup__empty">{t("chat.empty")}</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
              {m.content || (m.role === "assistant" && busy ? t("chat.thinking") : "")}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="chat-popup__form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder", { name: agent.displayName })}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {t("chat.send")}
        </button>
      </form>
    </div>
  );
}
