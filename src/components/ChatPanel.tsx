import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildSystemPrompt,
  chatCompletion,
  truncateChatHistory,
} from "@/lib/ai/providers";
import { getArenaWorldContext, withSituationUserMessage } from "@/lib/ai/arenaContext";
import { useStickToBottom } from "@/lib/useStickToBottom";
import { useArenaStore } from "@/store/arenaStore";

const STORAGE_KEY = "agent-arena-chat-panel";
const MIN_W = 280;
const MIN_H = 240;
const MARGIN = 8;

type ChatLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function defaultLayout(): ChatLayout {
  const width = Math.min(380, Math.max(MIN_W, window.innerWidth - 24));
  const height = Math.min(460, Math.max(MIN_H, window.innerHeight - 100));
  return {
    width,
    height,
    left: Math.max(MARGIN, window.innerWidth - width - 18),
    top: Math.max(MARGIN, window.innerHeight - height - 18),
  };
}

function clampLayout(layout: ChatLayout): ChatLayout {
  const maxW = Math.max(MIN_W, window.innerWidth - MARGIN * 2);
  const maxH = Math.max(MIN_H, window.innerHeight - MARGIN * 2);
  const width = Math.min(maxW, Math.max(MIN_W, layout.width));
  const height = Math.min(maxH, Math.max(MIN_H, layout.height));
  const left = Math.min(
    window.innerWidth - width - MARGIN,
    Math.max(MARGIN, layout.left),
  );
  const top = Math.min(
    window.innerHeight - height - MARGIN,
    Math.max(MARGIN, layout.top),
  );
  return { left, top, width, height };
}

function loadLayout(): ChatLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clampLayout(defaultLayout());
    const parsed = JSON.parse(raw) as Partial<ChatLayout>;
    if (
      typeof parsed.left !== "number" ||
      typeof parsed.top !== "number" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return clampLayout(defaultLayout());
    }
    return clampLayout({
      left: parsed.left,
      top: parsed.top,
      width: parsed.width,
      height: parsed.height,
    });
  } catch {
    return clampLayout(defaultLayout());
  }
}

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
  const [layout, setLayout] = useState<ChatLayout>(() => loadLayout());
  const abortRef = useRef<AbortController | null>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origin: ChatLayout;
  } | null>(null);

  const agent = agents.find((a) => a.id === selectedAgentId);
  const model = models.find((m) => m.id === agent?.modelConfigId);
  const messages = selectedAgentId ? chats[selectedAgentId] ?? [] : [];
  const busy = selectedAgentId ? Boolean(chatBusyById[selectedAgentId]) : false;
  const lastContent = messages[messages.length - 1]?.content ?? "";
  const { containerRef, onScroll, stickNow } = useStickToBottom([
    messages.length,
    lastContent,
    selectedAgentId,
    chatOpen,
  ]);

  useEffect(() => {
    if (chatOpen && selectedAgentId) stickNow();
  }, [selectedAgentId, chatOpen, stickNow]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    const onResize = () => setLayout((prev) => clampLayout(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.mode === "move") {
        setLayout(
          clampLayout({
            ...drag.origin,
            left: drag.origin.left + dx,
            top: drag.origin.top + dy,
          }),
        );
      } else {
        setLayout(
          clampLayout({
            ...drag.origin,
            width: drag.origin.width + dx,
            height: drag.origin.height + dy,
          }),
        );
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.classList.remove("is-chat-panel-dragging");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function beginGesture(
    mode: "move" | "resize",
    e: { button: number; clientX: number; clientY: number; preventDefault: () => void },
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: layout,
    };
    document.body.classList.add("is-chat-panel-dragging");
  }

  if (!chatOpen || !agent) return null;

  async function send() {
    const text = input.trim();
    if (!text || !agent || busy) return;
    if (!model) {
      appendChat(agent.id, { role: "system", content: t("chat.noModel") });
      useArenaStore.getState().persist();
      return;
    }

    setInput("");
    stickNow();
    const prior = truncateChatHistory(
      (useArenaStore.getState().chats[agent.id] ?? []).filter(
        (m) => m.role === "user" || m.role === "assistant",
      ),
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
      getArenaWorldContext(agent.id),
    );
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    let assembled = "";
    let raf = 0;
    let paintedFirst = false;
    const flushUi = () => {
      raf = 0;
      replaceLastAssistant(agent.id, assembled);
      setAgentSpeech(agent.id, assembled || "…", 120000);
    };
    const scheduleUi = () => {
      if (!paintedFirst) {
        paintedFirst = true;
        flushUi();
        return;
      }
      if (!raf) raf = requestAnimationFrame(flushUi);
    };

    try {
      const reply = await chatCompletion({
        model,
        signal: ac.signal,
        thinkingEnabled: agent.thinkingEnabled === true,
        messages: [
          { role: "system", content: system },
          ...prior,
          { role: "user", content: withSituationUserMessage(agent.id, text) },
        ],
        onToken: (chunk) => {
          assembled += chunk;
          scheduleUi();
        },
      });
      if (raf) cancelAnimationFrame(raf);
      const finalText = (reply || assembled).trim() || "…";
      replaceLastAssistant(agent.id, finalText);
      setAgentSpeech(agent.id, finalText, 5000);
    } catch (e) {
      if (raf) cancelAnimationFrame(raf);
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
    <div
      className="chat-popup"
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      }}
    >
      <header
        className="chat-popup__header"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          beginGesture("move", e);
        }}
      >
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
      <div
        className="chat-popup__messages"
        ref={containerRef}
        onScroll={onScroll}
      >
        {messages.length === 0 ? (
          <div className="chat-popup__empty">{t("chat.empty")}</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
              {m.content || (m.role === "assistant" && busy ? t("chat.thinking") : "")}
            </div>
          ))
        )}
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
      <div
        className="chat-popup__resize"
        role="separator"
        aria-label={t("chat.resize")}
        title={t("chat.resize")}
        onPointerDown={(e) => beginGesture("resize", e)}
      />
    </div>
  );
}
