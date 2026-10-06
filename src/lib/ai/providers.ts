import {
  publishBalance,
  streamZibbyAi,
  ZibbyAiError,
} from "@zibby-run/app-kit";
import type {
  AgentSkill,
  AiModelConfig,
  AiProviderKind,
  ChatMessage,
} from "@/lib/types";
import {
  buildAgentSystemPrompt,
  type ArenaWorldContext,
} from "@/lib/ai/arenaContext";
import { resolveZibbyTextModel, ZIBBY_TEXT_MODELS } from "@/lib/ai/zibbyModels";
import { appConfig } from "@/lib/config";

const MAX_TOKENS = 2048;
const IDLE_MAX_TOKENS = 256;

export function providerDefaults(
  provider: AiProviderKind,
): { name: string; baseUrl: string; modelId: string } {
  const hit =
    ZIBBY_TEXT_MODELS.find((m) => m.kind === provider) ?? ZIBBY_TEXT_MODELS[0]!;
  return { name: hit.label, baseUrl: "", modelId: hit.id };
}

/** Private 1:1 chat system prompt (session facts come from `world`). */
export function buildSystemPrompt(
  agentPrompt: string,
  agentName: string,
  skills: AgentSkill[] = [],
  world: ArenaWorldContext,
): string {
  return buildAgentSystemPrompt({
    agentPrompt,
    agentName,
    skills,
    world,
    mode: "private_chat",
  });
}

/** Recent user/assistant turns kept in the API payload to limit prefill / TTFT. */
export const MAX_CHAT_HISTORY_MESSAGES = appConfig.storage.maxApiChatHistory;

export function truncateChatHistory(
  messages: ChatMessage[],
  maxMessages = MAX_CHAT_HISTORY_MESSAGES,
): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

export interface ChatRequest {
  model: AiModelConfig;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  thinkingEnabled?: boolean;
  /** `x-zibby-action` label. */
  action?: string;
}

function actionLabel(raw: string | undefined): string {
  const a = (raw ?? "chat").toLowerCase();
  if (/^[a-z0-9_:.-]{1,64}$/.test(a)) return a;
  return "chat";
}

function buildPayload(
  req: ChatRequest,
  catalogId: string,
  zibbyProvider: "anthropic" | "openai",
): Record<string, unknown> {
  const maxTokens = req.action === "idle_mutter" ? IDLE_MAX_TOKENS : MAX_TOKENS;
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
  const rest = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  if (zibbyProvider === "anthropic") {
    const payload: Record<string, unknown> = {
      model: catalogId,
      max_tokens: maxTokens,
      messages: rest.length ? rest : [{ role: "user", content: "…" }],
    };
    if (system) payload.system = system;
    if (req.thinkingEnabled === true) {
      payload.thinking = { type: "enabled", budget_tokens: 1024 };
    }
    return payload;
  }

  const messages = system
    ? [{ role: "system", content: system }, ...rest]
    : rest;
  return {
    model: catalogId,
    max_tokens: maxTokens,
    messages: messages.length ? messages : [{ role: "user", content: "…" }],
  };
}

export async function chatCompletion(req: ChatRequest): Promise<string> {
  const catalog = resolveZibbyTextModel(req.model.modelId);
  const action = actionLabel(req.action);
  try {
    const result = await streamZibbyAi(
      {
        action,
        provider: catalog.zibbyProvider,
        model: catalog.id,
        payload: buildPayload(req, catalog.id, catalog.zibbyProvider),
      },
      { onDelta: req.onToken, signal: req.signal },
    );
    if (result.terminal) publishBalance(result.terminal.balance_cr);
    return (result.text || "").trim();
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    if (e instanceof ZibbyAiError) {
      throw new Error(formatZibbyError(e));
    }
    throw e;
  }
}

function formatZibbyError(error: ZibbyAiError): string {
  switch (error.code) {
    case "insufficient_credits":
      return "Not enough Zibby credits for this call.";
    case "session_cap_reached":
      return "This session hit the Zibby spending cap.";
    case "unauthenticated":
      return "Sign in on Zibby to use AI.";
    case "locked":
      return "Your Zibby account is on hold.";
    case "rate_limited":
      return "Too many AI calls just now. Try again in a moment.";
    case "unknown_model":
      return "That model is not available on Zibby.";
    default:
      return error.message || "The AI call failed.";
  }
}

export async function fetchModels(
  _model: Pick<AiModelConfig, "provider" | "baseUrl" | "apiKey" | "extraHeaders">,
  _signal?: AbortSignal,
): Promise<string[]> {
  return ZIBBY_TEXT_MODELS.map((m) => m.id);
}

export async function testConnection(
  model: AiModelConfig,
): Promise<{ ok: boolean; detail: string }> {
  const catalog = resolveZibbyTextModel(model.modelId);
  return { ok: true, detail: catalog.id };
}
