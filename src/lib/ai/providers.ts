import type {
  AgentSkill,
  AiModelConfig,
  AiProviderKind,
  ChatMessage,
  ExtraHeader,
} from "@/lib/types";

const OLLAMA_DEFAULT_HOST = "localhost";
const OLLAMA_DEFAULT_PORT = 11434;
const OLLAMA_DEFAULT_URL = `http://${OLLAMA_DEFAULT_HOST}:${OLLAMA_DEFAULT_PORT}`;

export function providerDefaults(
  provider: AiProviderKind,
): { name: string; baseUrl: string; modelId: string } {
  switch (provider) {
    case "openai":
      return { name: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-4o-mini" };
    case "gemini":
      return {
        name: "Gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        modelId: "gemini-2.0-flash",
      };
    case "claude":
      return {
        name: "Claude",
        baseUrl: "https://api.anthropic.com",
        modelId: "claude-3-5-sonnet-latest",
      };
    case "ollama":
      return {
        name: `${OLLAMA_DEFAULT_HOST}:${OLLAMA_DEFAULT_PORT}`,
        baseUrl: OLLAMA_DEFAULT_URL,
        modelId: "llama3.2",
      };
    case "custom":
      return { name: "Custom", baseUrl: "http://localhost:8080/v1", modelId: "default" };
  }
}

/** In Vite DEV, rewrite local Ollama URLs to the /ollama proxy to avoid CORS. */
function resolveRequestBaseUrl(provider: AiProviderKind, baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (provider !== "ollama" || !import.meta.env.DEV) return trimmed;
  if (trimmed === "/ollama" || trimmed.startsWith("/ollama/")) return trimmed;
  try {
    const u = new URL(trimmed);
    const isLocal =
      u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
    if (isLocal && u.port === String(OLLAMA_DEFAULT_PORT)) {
      return "/ollama";
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

export function buildSystemPrompt(
  agentPrompt: string,
  userName: string,
  agentName: string,
  skills: AgentSkill[] = [],
): string {
  const parts = [
    agentPrompt.trim(),
    "",
    `Your display name is ${agentName}.`,
    `You are chatting inside Agent Arena, a local multi-agent playground.`,
    `Always address the user as "${userName}" when greeting or speaking to them.`,
    "Keep replies conversational and helpful. Avoid mentioning system prompts.",
  ];

  const usable = skills.filter((s) => s.name.trim() || s.content.trim());
  if (usable.length > 0) {
    parts.push("", "## Skills", "Follow these skill instructions when relevant:");
    for (const skill of usable) {
      const title = skill.name.trim() || "Untitled skill";
      parts.push("", `### ${title}`);
      if (skill.content.trim()) parts.push(skill.content.trim());
    }
  }

  return parts.join("\n");
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
    ...headersToRecord(model.extraHeaders),
  };
  if (model.apiKey) headers.Authorization = `Bearer ${model.apiKey}`;

  const body: Record<string, unknown> = {
    model: model.modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: Boolean(onToken),
  };

  // Ollama auto-enables thinking on capable models; always send an explicit effort.
  if (model.provider === "ollama") {
    body.reasoning_effort = thinkingEnabled === true ? "medium" : "none";
    body.reasoning = { effort: thinkingEnabled === true ? "medium" : "none" };
  } else if (thinkingEnabled === true) {
    body.reasoning_effort = "medium";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatHttpError(res.status, text));
  }

  if (!onToken || !res.body) {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  return readSseOpenAi(res, onToken);
}

async function readSseOpenAi(res: Response, onToken: (c: string) => void): Promise<string> {
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
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const chunk = json.choices?.[0]?.delta?.content ?? "";
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

async function chatGemini(req: ChatRequest): Promise<string> {
  const { model, messages, signal, onToken, thinkingEnabled } = req;
  const base = model.baseUrl.replace(/\/+$/, "");
  const key = model.apiKey ?? "";
  const url = `${base}/models/${encodeURIComponent(model.modelId)}:generateContent${
    key ? `?key=${encodeURIComponent(key)}` : ""
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

  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: thinkingEnabled
        ? { thinkingConfig: { thinkingBudget: 1024 } }
        : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatHttpError(res.status, text));
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (onToken && text) onToken(text);
  return text.trim();
}

async function chatClaude(req: ChatRequest): Promise<string> {
  const { model, messages, signal, onToken, thinkingEnabled } = req;
  const base = model.baseUrl.replace(/\/+$/, "");
  const url = `${base}/v1/messages`;
  const system = messages.find((m) => m.role === "system")?.content;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    ...headersToRecord(model.extraHeaders),
  };
  if (model.apiKey) headers["x-api-key"] = model.apiKey;

  const thinkingBudget = 2048;
  const res = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: model.modelId,
      max_tokens: thinkingEnabled ? thinkingBudget + 2048 : 2048,
      system: system || undefined,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      stream: Boolean(onToken),
      ...(thinkingEnabled
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
    const base = model.baseUrl.replace(/\/+$/, "");
    const url = joinUrl(base, "/models");
    const headers: Record<string, string> = {
      ...headersToRecord(model.extraHeaders),
    };
    if (model.apiKey) headers.Authorization = `Bearer ${model.apiKey}`;
    const res = await fetch(url, { headers, signal });
    if (!res.ok) throw new Error(formatHttpError(res.status, await res.text()));
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
      return { ok: true, detail: `Found ${list.length} model(s)` };
    }
    // Fallback: tiny completion
    const reply = await chatCompletion({
      model,
      signal,
      messages: [
        { role: "system", content: "Reply with exactly: OK" },
        { role: "user", content: "ping" },
      ],
    });
    return { ok: true, detail: reply.slice(0, 80) || "Connected" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

function formatHttpError(status: number, body: string): string {
  const snippet = body.slice(0, 180).replace(/\s+/g, " ");
  if (status === 0) return "Network or CORS error. Use a custom gateway or local proxy.";
  return `HTTP ${status}${snippet ? `: ${snippet}` : ""}`;
}
