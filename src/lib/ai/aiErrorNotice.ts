import i18n from "@/i18n";
import type { AgentConfig, AiModelConfig } from "@/lib/types";
import { useArenaStore } from "@/store/arenaStore";

const THROTTLE_MS = 30_000;
const TOAST_MS = 8_000;
const lastToastAtByModelId = new Map<string, number>();

/** Clear throttle state between unit tests. */
export function resetAiErrorNoticeThrottleForTests(): void {
  lastToastAtByModelId.clear();
}

function isAbortError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error == null) return "";
  return String(error);
}

function pickJsonErrorMessage(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const nested = obj.error;
  if (nested && typeof nested === "object") {
    const msg = (nested as Record<string, unknown>).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
  if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return null;
}

/**
 * Prefer a readable message from `HTTP <status>: <body snippet>` when the
 * snippet is JSON (possibly truncated). Falls back to the raw text.
 */
function preferReadableHttpBody(text: string): string {
  const m = /^HTTP\s+(\d+)\s*:\s*(.*)$/i.exec(text);
  if (!m) return text;
  const status = m[1]!;
  const snippet = m[2]!.trim();
  if (!snippet) return text;

  let readable: string | null = null;
  try {
    readable = pickJsonErrorMessage(JSON.parse(snippet));
  } catch {
    // Truncated JSON — try a regex for "message":"..."
  }
  if (!readable) {
    const msgMatch = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(snippet);
    if (msgMatch?.[1]) {
      try {
        readable = JSON.parse(`"${msgMatch[1]}"`) as string;
      } catch {
        readable = msgMatch[1];
      }
    }
  }
  if (!readable) return text;
  return `HTTP ${status}: ${readable}`;
}

/**
 * Short, single-line reason for toasts. Never surface API keys / bearer tokens.
 */
export function sanitizeAiErrorReason(error: unknown, maxLen = 120): string {
  let text = rawErrorMessage(error).replace(/\s+/g, " ").trim();
  text = preferReadableHttpBody(text);
  text = text.replace(/\bsk-[A-Za-z0-9_-]+/gi, "[redacted]");
  text = text.replace(/\bBearer\s+\S+/gi, "[redacted]");
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

/**
 * Visible toast when a provider call fails (not AbortError).
 * Throttled to at most one toast per model id per 30s.
 */
export function notifyAiCallFailed(
  agent: Pick<AgentConfig, "displayName">,
  model: Pick<AiModelConfig, "id">,
  error: unknown,
): void {
  if (isAbortError(error)) return;

  const now = Date.now();
  const last = lastToastAtByModelId.get(model.id) ?? 0;
  if (now - last < THROTTLE_MS) return;
  lastToastAtByModelId.set(model.id, now);

  const reason = sanitizeAiErrorReason(error) || "error";
  const msg = i18n.t("chat.aiCallFailed", {
    name: agent.displayName,
    reason,
  });
  useArenaStore.getState().showToast(msg, TOAST_MS);
}
