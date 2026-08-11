import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendArenaChatMessage } from "@/lib/ai/arenaChat";
import type { AgentConfig, FloatingChatLine } from "@/lib/types";
import { useStickToBottom } from "@/lib/useStickToBottom";
import { useArenaStore } from "@/store/arenaStore";

function ChatLineView({
  line,
  fading,
  onFadeEnd,
}: {
  line: FloatingChatLine;
  fading?: boolean;
  onFadeEnd?: () => void;
}) {
  return (
    <div
      className={
        "floating-chat-log__line" +
        (fading ? " floating-chat-log__line--fade" : "") +
        (line.kind === "user" ? " floating-chat-log__line--user" : "") +
        (line.kind === "system" ? " floating-chat-log__line--system" : "")
      }
      onAnimationEnd={
        fading
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              onFadeEnd?.();
            }
          : undefined
      }
    >
      <span className="floating-chat-log__name" style={{ color: line.color }}>
        {line.agentName}
      </span>
      <span className="floating-chat-log__sep">:</span>
      <span className="floating-chat-log__text">{line.text}</span>
    </div>
  );
}

function getActiveMention(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

function filterMentionAgents(agents: AgentConfig[], query: string): AgentConfig[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  return agents
    .filter((a) => a.enabled !== false && Boolean(a.modelConfigId))
    .filter((a) => {
      if (!q) return true;
      const name = a.displayName.toLowerCase();
      const compact = name.replace(/\s+/g, "");
      return name.startsWith(query.toLowerCase()) || compact.startsWith(q);
    })
    .slice(0, 8);
}

/**
 * MMO-style arena chat: fading live feed, history panel, and input.
 */
export function FloatingChatLog() {
  const { t } = useTranslation();
  const lines = useArenaStore((s) => s.floatingChatLog);
  const history = useArenaStore((s) => s.arenaChatHistory);
  const agents = useArenaStore((s) => s.agents);
  const removeFloatingChatLog = useArenaStore((s) => s.removeFloatingChatLog);
  const clearFloatingChatLog = useArenaStore((s) => s.clearFloatingChatLog);

  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const historyOpenRef = useRef(historyOpen);
  const lastHistoryText = history[history.length - 1]?.text ?? "";
  const { containerRef: historyScrollRef, onScroll: onHistoryScroll, stickNow } =
    useStickToBottom([history.length, lastHistoryText, historyOpen]);

  const activeMention = useMemo(
    () => getActiveMention(input, caret),
    [input, caret],
  );
  const mentionMatches = useMemo(
    () => (activeMention ? filterMentionAgents(agents, activeMention.query) : []),
    [activeMention, agents],
  );
  const mentionOpen = Boolean(activeMention) && mentionMatches.length > 0;

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.start, activeMention?.query, mentionMatches.length]);

  // Opening/closing history must not replay old lines as fresh fading messages.
  useEffect(() => {
    const wasOpen = historyOpenRef.current;
    historyOpenRef.current = historyOpen;
    if (wasOpen !== historyOpen) {
      clearFloatingChatLog();
    }
  }, [historyOpen, clearFloatingChatLog]);

  useEffect(() => {
    if (historyOpen) stickNow();
  }, [historyOpen, stickNow]);

  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mentionOpen) {
        setHistoryOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen, mentionOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const dock = dockRef.current;
      if (!dock) return;
      if (e.target instanceof Node && dock.contains(e.target)) return;
      setHistoryOpen(false);
      inputRef.current?.blur();
    };
    // Capture so arena/canvas clicks still close the panel.
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [historyOpen]);

  function syncCaret() {
    const el = inputRef.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  }

  function applyMention(agent: AgentConfig) {
    if (!activeMention) return;
    const tag = `@${agent.displayName.replace(/\s+/g, "")}`;
    const before = input.slice(0, activeMention.start);
    const after = input.slice(caret);
    const next = `${before}${tag} ${after.replace(/^\s*/, "")}`;
    const nextCaret = before.length + tag.length + 1;
    setInput(next);
    setCaret(nextCaret);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  async function submit() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setCaret(0);
    stickNow();
    setSending(true);
    try {
      await sendArenaChatMessage(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div
      ref={dockRef}
      className={"arena-chat-dock" + (historyOpen ? " is-history-open" : "")}
    >
      {historyOpen && (
        <div className="arena-chat-dock__history" aria-label={t("chat.arena.history")}>
          <div className="arena-chat-dock__history-head">
            <span>{t("chat.arena.history")}</span>
            <button
              type="button"
              className="arena-chat-dock__icon-btn"
              aria-label={t("chat.arena.closeHistory")}
              onClick={() => setHistoryOpen(false)}
            >
              ×
            </button>
          </div>
          <div
            className="arena-chat-dock__history-scroll"
            ref={historyScrollRef}
            onScroll={onHistoryScroll}
          >
            {history.length === 0 ? (
              <div className="arena-chat-dock__empty">{t("chat.arena.empty")}</div>
            ) : (
              history.map((line) => <ChatLineView key={line.id} line={line} />)
            )}
          </div>
        </div>
      )}

      {!historyOpen && lines.length > 0 && (
        <div
          className="floating-chat-log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {lines.map((line) => (
            <ChatLineView
              key={line.id}
              line={line}
              fading
              onFadeEnd={() => removeFloatingChatLog(line.id)}
            />
          ))}
        </div>
      )}

      <div className="arena-chat-dock__composer">
        {mentionOpen && (
          <ul className="arena-chat-dock__mentions" role="listbox">
            {mentionMatches.map((agent, i) => (
              <li key={agent.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={
                    "arena-chat-dock__mention" +
                    (i === mentionIndex ? " is-active" : "")
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(agent);
                  }}
                >
                  <span
                    className="arena-chat-dock__mention-swatch"
                    style={{ background: agent.color }}
                    aria-hidden
                  />
                  <span
                    className="arena-chat-dock__mention-name"
                    style={{ color: agent.color }}
                  >
                    @{agent.displayName.replace(/\s+/g, "")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="arena-chat-dock__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mentionOpen) {
              const pick = mentionMatches[mentionIndex];
              if (pick) applyMention(pick);
              return;
            }
            void submit();
          }}
        >
          <button
            type="button"
            className={
              "arena-chat-dock__history-btn" + (historyOpen ? " is-active" : "")
            }
            aria-pressed={historyOpen}
            title={t("chat.arena.history")}
            aria-label={t("chat.arena.history")}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            {historyOpen ? "↓" : "↑"}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onClick={syncCaret}
            onKeyUp={syncCaret}
            onSelect={syncCaret}
            onFocus={() => {
              setHistoryOpen(true);
              syncCaret();
            }}
            onKeyDown={(e) => {
              if (!mentionOpen) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionMatches.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex(
                  (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
                );
              } else if (e.key === "Tab") {
                e.preventDefault();
                const pick = mentionMatches[mentionIndex];
                if (pick) applyMention(pick);
              } else if (e.key === "Escape" && activeMention) {
                e.preventDefault();
                const next =
                  input.slice(0, activeMention.start) + input.slice(caret);
                const nextCaret = activeMention.start;
                setInput(next);
                setCaret(nextCaret);
                requestAnimationFrame(() => {
                  inputRef.current?.setSelectionRange(nextCaret, nextCaret);
                });
              }
            }}
            placeholder={t("chat.arena.placeholder")}
            disabled={sending}
            maxLength={280}
            autoComplete="off"
          />
          <button type="submit" disabled={sending || !input.trim()}>
            {t("chat.arena.send")}
          </button>
        </form>
      </div>
    </div>
  );
}
