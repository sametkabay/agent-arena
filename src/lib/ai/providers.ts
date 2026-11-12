import type {
  AgentSkill,
  AiModelConfig,
  AiProviderKind,
  ChatMessage,
  ExtraHeader,
} from "@/lib/types";
import {
  buildAgentSystemPrompt,
  type ArenaWorldContext,
} from "@/lib/ai/arenaContext";
import { appConfig, prompts } from "@/lib/config";

const OLLAMA_DEFAULT_PORT = appConfig.providers.ollama.port ?? 11434;

export function providerDefaults(
  provider: AiProviderKind,
): { name: string; baseUrl: string; modelId: string } {
  const d = appConfig.providers[provider];
  return { name: d.name, baseUrl: d.baseUrl, modelId: d.modelId };
}

export function openaiCompatiblePresets(): Array<{
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
}> {
  return appConfig.providers.openai.compatiblePresets ?? [];
}

/**
 * OpenAI-compatible clients append `/chat/completions`. Strip a pasted full
 * endpoint so we do not request `/chat/completions/chat/completions`.
 */
export function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  let s = baseUrl.trim().replace(/\/+$/, "");
  s = s.replace(/\/chat\/completions$/i, "");
  s = s.replace(/\/completions$/i, "");
  return s.replace(/\/+$/, "");
}

export function isLocalLlmBaseUrl(baseUrl: string): boolean {
  try {
    const u = new URL(normalizeOpenAiCompatibleBaseUrl(baseUrl));
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  } catch {
    return false;
  }
}

/** In Vite DEV, rewrite LLM URLs to same-origin proxies (CORS + less SSE buffering). */
function resolveRequestBaseUrl(provider: AiProviderKind, baseUrl: string): string {
  const trimmed = normalizeOpenAiCompatibleBaseUrl(baseUrl);
  if (
    trimmed.startsWith("/ollama") ||
    trimmed.startsWith("/local-llm/") ||
    trimmed.startsWith("/remote-llm/")
  ) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    const isLocal = isLocalLlmBaseUrl(trimmed);

    if (!import.meta.env.DEV) return trimmed;

    if (provider === "ollama" && isLocal && (u.port === String(OLLAMA_DEFAULT_PORT) || !u.port)) {
      return "/ollama";
    }

    if (provider === "openai" || provider === "custom" || provider === "ollama") {
      const host = u.hostname === "[::1]" || u.hostname === "localhost" ? "127.0.0.1" : u.hostname;
      const pathPart = u.pathname.replace(/\/+$/, "");
      if (isLocal) {
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        return `/local-llm/${host}/${port}${pathPart}`;
      }
      // Remote HTTPS OpenAI-compatible APIs often lack browser CORS.
      if (u.protocol === "https:") {
        const port = u.port || "443";
        return `/remote-llm/${host}/${port}${pathPart}`;
      }
    }
  } catch {
    // keep as-is
  }
  return trimmed;
}

function headersToRecord(extras: ExtraHeader[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of extras) {
    if (h.key.trim()) out[h.key.trim()] = h.value;
  }
  return out;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  // Avoid double /v1/v1
  if (b.endsWith("/v1") && p.startsWith("/v1/")) return `${b}${p.slice(3)}`;
  return `${b}${p}`;
}

function openaiCompatibleBase(model: AiModelConfig): string {
  const base = resolveRequestBaseUrl(model.provider, model.baseUrl);
  if (model.provider === "ollama") {
    // Ollama OpenAI-compatible lives under /v1
    if (base.endsWith("/v1")) return base;
    return `${base.replace(/\/+$/, "")}/v1`;
  }
  return base.replace(/\/+$/, "");
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
}

export async function chatCompletion(req: ChatRequest): Promise<string> {
  const { model } = req;
  if (model.provider === "gemini") {
    return chatGemini(req);
  }
  if (model.provider === "claude") {
    return chatClaude(req);
  }
  return chatOpenAiCompatible(req);
}

async function chatOpenAiCompatible(req: ChatRequest): Promise<string> {
  const { model, messages, signal, onToken, thinkingEnabled } = req;
  const base = openaiCompatibleBase(model);
  const url = joinUrl(base, "/chat/completions");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/x-ndjson, application/json",
    ...headersToRecord(model.extraHeaders),
  };
  if (model.apiKey) headers.Authorization = `Bearer ${model.apiKey}`;

  const stream = Boolean(onToken);
  const body: Record<string, unknown> = {
    model: model.modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream,
  };

  // Local gateways may think by default — send an explicit effort.
  // Skip remote hosted APIs unless thinking is on (many 400 on unknown params).
  const effort = thinkingEnabled === true ? "medium" : "none";
  const localGateway = model.provider === "ollama" || isLocalLlmBaseUrl(model.baseUrl);
  const sendEffort = localGateway || thinkingEnabled === true;
  if (sendEffort) {
    body.reasoning_effort = effort;
    if (model.provider === "ollama") {
      body.reasoning = { effort };
    }
  }

  const res = await fetchProvider(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    },
    model.baseUrl,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatHttpError(res.status, text, model.baseUrl));
  }

  if (!onToken || !res.body) {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    return normalizeOpenAiContent(data.choices?.[0]?.message?.content).trim();
  }

  // Always consume as a stream when requested. Some gateways label SSE as
  // application/json; awaiting res.json() would hide tokens until the end.
  return readOpenAiStream(res, onToken);
}

function normalizeOpenAiContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && "text" in p) {
          return String((p as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractOpenAiDeltaContent(json: {
  choices?: Array<{
    delta?: { content?: unknown; text?: string };
    message?: { content?: unknown };
  }>;
}): string {
  const choice = json.choices?.[0];
  if (!choice) return "";
  if (choice.delta) {
    if (choice.delta.content != null) return normalizeOpenAiContent(choice.delta.content);
    if (typeof choice.delta.text === "string") return choice.delta.text;
  }
  if (choice.message?.content != null) return normalizeOpenAiContent(choice.message.content);
  return "";
}

function consumeOpenAiStreamLine(line: string, onToken: (c: string) => void): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return "";
  let payload = trimmed;
  if (trimmed.startsWith("data:")) {
    payload = trimmed.slice(5).trim();
  }
  if (!payload || payload === "[DONE]") return "";
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{
        delta?: { content?: unknown; text?: string };
        message?: { content?: unknown };
      }>;
    };
    const chunk = extractOpenAiDeltaContent(json);
    if (chunk) onToken(chunk);
    return chunk;
  } catch {
    return "";
  }
}

async function readOpenAiStream(res: Response, onToken: (c: string) => void): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  const emitFromLine = (line: string) => {
    const chunk = consumeOpenAiStreamLine(line, onToken);
    if (chunk) full += chunk;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Prefer line-delimited SSE/NDJSON; also try to peel complete JSON objects early.
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      emitFromLine(line);
    }

    // Some gateways flush a complete `data: {...}` without trailing newline for a while.
    if (buffer.startsWith("data:")) {
      const payload = buffer.slice(5).trim();
      if (payload.startsWith("{")) {
        try {
          JSON.parse(payload);
          emitFromLine(buffer);
          buffer = "";
        } catch {
          // incomplete JSON — wait for more bytes
        }
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) emitFromLine(buffer);

  return full.trim();
}

type GeminiPart = { text?: string; thought?: boolean };

function geminiAnswerText(parts: GeminiPart[] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .filter((p) => !p.thought && Boolean(p.text))
    .map((p) => p.text ?? "")
    .join("");
}

/** thinkingConfig is only valid on Gemini 2.5+ / thinking variants. */
function geminiSupportsThinkingConfig(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("2.5") ||
    id.includes("2.6") ||
    id.includes("thinking") ||
    /(?:^|[/:_-])gemini-3/.test(id)
  );
}

function geminiGenerationConfig(
  modelId: string,
  thinkingEnabled: boolean,
): Record<string, unknown> | undefined {
  const wantsThinking = thinkingEnabled === true;
  if (!geminiSupportsThinkingConfig(modelId) && !wantsThinking) return undefined;
  return {
    thinkingConfig: {
      // 2.5+ may think by default; 0 disables, 1024 enables a budget.
      thinkingBudget: wantsThinking ? (appConfig.providers.gemini.thinkingBudget ?? 1024) : 0,
    },
  };
}

async function chatGemini(req: ChatRequest): Promise<string> {
  const { model, messages, signal, onToken, thinkingEnabled } = req;
  const base = model.baseUrl.replace(/\/+$/, "");
  const key = model.apiKey ?? "";
  const stream = Boolean(onToken);
  const params = new URLSearchParams();
  if (key) params.set("key", key);
  if (stream) params.set("alt", "sse");
  const qs = params.toString();
  const method = stream ? "streamGenerateContent" : "generateContent";
  const url = `${base}/models/${encodeURIComponent(model.modelId)}:${method}${
    qs ? `?${qs}` : ""
  }`;

  const system = messages.find((m) => m.role === "system")?.content;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...headersToRecord(model.extraHeaders),
  };

  const body: Record<string, unknown> = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
  };
  const generationConfig = geminiGenerationConfig(model.modelId, thinkingEnabled === true);
  if (generationConfig) body.generationConfig = generationConfig;

  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatHttpError(res.status, text));
  }

  if (!stream || !res.body) {
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    };
    const text = geminiAnswerText(data.candidates?.[0]?.content?.parts);
    if (onToken && text) onToken(text);
    return text.trim();
  }

  return readSseGemini(res, onToken!);
}

async function readSseGemini(res: Response, onToken: (c: string) => void): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
        };
        const chunk = geminiAnswerText(json.candidates?.[0]?.content?.parts);
        if (chunk) {
          full += chunk;
          onToken(chunk);
        }
      } catch {
        // ignore partial JSON
      }
    }
  }
  return full.trim();
}

async function chatClaude(req: ChatRequest): Promise<string> {
  const { model, messages, signal, onToken, thinkingEnabled } = req;
  const base = model.baseUrl.replace(/\/+$/, "");
  const url = `${base}/v1/messages`;
  const system = messages.find((m) => m.role === "system")?.content;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": appConfig.providers.claude.anthropicVersion ?? "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    ...headersToRecord(model.extraHeaders),
  };
  if (model.apiKey) headers["x-api-key"] = model.apiKey;

  const thinkingOn = thinkingEnabled === true;
  const thinkingBudget = appConfig.providers.claude.thinkingBudget ?? 2048;
  const maxTokens = appConfig.providers.claude.maxTokens ?? 2048;
  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: model.modelId,
      max_tokens: thinkingOn ? thinkingBudget + maxTokens : maxTokens,
      system: system || undefined,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      stream: Boolean(onToken),
      ...(thinkingOn
        ? { thinking: { type: "enabled", budget_tokens: thinkingBudget } }
        : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatHttpError(res.status, text));
  }

  if (!onToken || !res.body) {
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    return data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      try {
        const json = JSON.parse(data) as {
          type?: string;
          delta?: { text?: string };
        };
        if (json.type === "content_block_delta" && json.delta?.text) {
          full += json.delta.text;
          onToken(json.delta.text);
        }
      } catch {
        // ignore
      }
    }
  }
  return full.trim();
}

export async function fetchModels(
  model: Pick<AiModelConfig, "provider" | "baseUrl" | "apiKey" | "extraHeaders">,
  signal?: AbortSignal,
): Promise<string[]> {
  const { provider } = model;

  if (provider === "ollama") {
    const base = resolveRequestBaseUrl(provider, model.baseUrl).replace(/\/v1$/, "");
    const res = await fetch(`${base}/api/tags`, {
      signal,
      headers: headersToRecord(model.extraHeaders),
    });
    if (!res.ok) throw new Error(formatHttpError(res.status, await res.text()));
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? []).map((m) => m.name!).filter(Boolean);
  }

  if (provider === "openai" || provider === "custom") {
    const base = resolveRequestBaseUrl(provider, model.baseUrl);
    const url = joinUrl(base, "/models");
    const headers: Record<string, string> = {
      ...headersToRecord(model.extraHeaders),
    };
    if (model.apiKey) headers.Authorization = `Bearer ${model.apiKey}`;
    const res = await fetchProvider(url, { headers, signal }, model.baseUrl);
    if (!res.ok) throw new Error(formatHttpError(res.status, await res.text(), model.baseUrl));
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? []).map((m) => m.id!).filter(Boolean).sort();
  }

  if (provider === "gemini") {
    const base = model.baseUrl.replace(/\/+$/, "");
    const key = model.apiKey ?? "";
    const url = `${base}/models${key ? `?key=${encodeURIComponent(key)}` : ""}`;
    const res = await fetch(url, {
      signal,
      headers: headersToRecord(model.extraHeaders),
    });
    if (!res.ok) throw new Error(formatHttpError(res.status, await res.text()));
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? [])
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n.includes("gemini"))
      .sort();
  }

  // Claude has no simple browser models list without special access — return empty
  return [];
}

export async function testConnection(
  model: AiModelConfig,
  signal?: AbortSignal,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const list = await fetchModels(model, signal);
    if (list.length > 0) {
      return { ok: true, detail: `Connected. Found ${list.length} model(s)` };
    }
    // Fallback: tiny completion
    const reply = await chatCompletion({
      model,
      signal,
      messages: [
        { role: "system", content: prompts.connectionTest.system },
        { role: "user", content: prompts.connectionTest.user },
      ],
    });
    return { ok: true, detail: reply.slice(0, 80) || "Connected" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchProvider(
  url: string,
  init: RequestInit,
  corsHintUrl: string,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw wrapNetworkError(e, corsHintUrl);
  }
}

export function wrapNetworkError(error: unknown, baseUrl: string): Error {
  const raw = error instanceof Error ? error.message : String(error);
  if (!/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return error instanceof Error ? error : new Error(raw);
  }
  return new Error(corsHelpMessage(baseUrl));
}

export function corsHelpMessage(_baseUrl?: string): string {
  return "Network or CORS error. This origin cannot call that API. Run npm run dev (proxies remote OpenAI-compatible HTTPS hosts) or put your own CORS-enabled gateway in Base URL. GitHub Pages has no proxy.";
}

function formatHttpError(status: number, body: string, baseUrl?: string): string {
  const snippet = body.slice(0, 180).replace(/\s+/g, " ");
  if (status === 0) return corsHelpMessage(baseUrl ?? "");
  return `HTTP ${status}${snippet ? `: ${snippet}` : ""}`;
}
