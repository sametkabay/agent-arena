import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSystemPrompt,
  chatCompletion,
  fetchModels,
  providerDefaults,
  testConnection,
  truncateChatHistory,
} from "@/lib/ai/providers";
import { sampleModel } from "@/test/fixtures";
import type { ArenaWorldContext } from "@/lib/ai/arenaContext";
import type { ChatMessage } from "@/lib/types";

const world: ArenaWorldContext = {
  userName: "Samet",
  language: "en",
  mapName: "Office",
  mapDescription: "",
  mapAreas: [],
  dayNight: "day",
  otherAgents: [],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    body: null,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
        return;
      }
      controller.close();
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}), text: async () => "" } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("provider helpers", () => {
  it("returns defaults per provider", () => {
    expect(providerDefaults("openai").baseUrl).toContain("openai");
    expect(providerDefaults("ollama").modelId).toBeTruthy();
    expect(providerDefaults("gemini").name).toBeTruthy();
    expect(providerDefaults("claude").baseUrl).toContain("anthropic");
  });

  it("truncates chat history from the tail", () => {
    const msgs: ChatMessage[] = Array.from({ length: 6 }, (_, i) => ({
      role: "user",
      content: String(i),
    }));
    expect(truncateChatHistory(msgs, 3).map((m) => m.content)).toEqual(["3", "4", "5"]);
    expect(truncateChatHistory(msgs, 20)).toBe(msgs);
  });

  it("builds a private-chat system prompt", () => {
    const prompt = buildSystemPrompt("Be brief.", "Explorer", [], world);
    expect(prompt).toContain("Be brief");
    expect(prompt).toContain("Explorer");
  });
});

describe("chatCompletion", () => {
  it("parses OpenAI JSON replies including array content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: [{ type: "text", text: "Hi" }, " there"] } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const text = await chatCompletion({
      model: sampleModel(),
      messages: [{ role: "user", content: "hello" }],
    });
    expect(text).toBe("Hi there");
  });

  it("streams OpenAI SSE deltas", async () => {
    const tokens: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
          'data: {"choices":[{"delta":{"text":"lo"}}]}\n',
          "data: [DONE]\n",
        ]),
      ),
    );
    const text = await chatCompletion({
      model: sampleModel({ extraHeaders: [{ key: "X-Test", value: "1" }] }),
      messages: [{ role: "user", content: "hi" }],
      onToken: (c) => tokens.push(c),
    });
    expect(text).toBe("Hello");
    expect(tokens.join("")).toBe("Hello");
  });

  it("throws on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, false, 401)));
    await expect(
      chatCompletion({
        model: sampleModel(),
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/401/);
  });

  it("calls Gemini generateContent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: "Greetings" }, { text: "skip", thought: true }] } }],
        }),
      ),
    );
    const text = await chatCompletion({
      model: sampleModel({ provider: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", modelId: "gemini-2.5-flash" }),
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      thinkingEnabled: true,
    });
    expect(text).toBe("Greetings");
  });

  it("streams Gemini SSE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(['data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n']),
      ),
    );
    const text = await chatCompletion({
      model: sampleModel({ provider: "gemini", baseUrl: "https://example.invalid/v1beta", modelId: "gemini-flash" }),
      messages: [{ role: "user", content: "hi" }],
      onToken: () => {},
    });
    expect(text).toBe("ok");
  });

  it("calls Claude messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ content: [{ type: "text", text: "Claude hi" }, { type: "thinking", text: "no" }] }),
      ),
    );
    const text = await chatCompletion({
      model: sampleModel({ provider: "claude", baseUrl: "https://api.anthropic.com", modelId: "claude-3" }),
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      thinkingEnabled: true,
    });
    expect(text).toBe("Claude hi");
  });

  it("streams Claude content_block_delta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"content_block_delta","delta":{"text":"Hey"}}\n',
          'data: {"type":"other"}\n',
        ]),
      ),
    );
    const text = await chatCompletion({
      model: sampleModel({ provider: "claude", baseUrl: "https://api.anthropic.com" }),
      messages: [{ role: "user", content: "hi" }],
      onToken: () => {},
    });
    expect(text).toBe("Hey");
  });

  it("rewrites local OpenAI URLs and keeps invalid bases", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await chatCompletion({
      model: sampleModel({
        provider: "custom",
        baseUrl: "http://localhost:8080/v1",
        modelId: "local",
      }),
      messages: [{ role: "user", content: "hi" }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/local-llm/");

    fetchMock.mockClear();
    await chatCompletion({
      model: sampleModel({ provider: "openai", baseUrl: "not a url", modelId: "x" }),
      messages: [{ role: "user", content: "hi" }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("not a url");
  });

  it("ignores comment lines and incomplete SSE JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          ": keep-alive\n",
          "data: {not-json\n",
          'data: {"choices":[{"message":{"content":"via-message"}}]}\n',
          'data: {"choices":[{"delta":{"content":[{"foo":1},{"text":"!"},""]}}]}\n',
          "data: {",
        ]),
      ),
    );
    const text = await chatCompletion({
      model: sampleModel(),
      messages: [{ role: "user", content: "hi" }],
      onToken: () => {},
    });
    expect(text).toContain("via-message");
  });

  it("throws on Gemini and Claude HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "no" }, false, 503)));
    await expect(
      chatCompletion({
        model: sampleModel({ provider: "gemini", baseUrl: "https://example.invalid", modelId: "gemini-flash" }),
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/503/);
    await expect(
      chatCompletion({
        model: sampleModel({ provider: "claude", baseUrl: "https://example.invalid" }),
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/503/);
  });

  it("normalizes empty OpenAI content shapes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: { n: 1 } } }] })));
    await expect(
      chatCompletion({
        model: sampleModel(),
        messages: [{ role: "user", content: "hi" }],
      }),
    ).resolves.toBe("");
  });

  it("sends reasoning_effort for ollama", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await chatCompletion({
      model: sampleModel({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "llama3",
      }),
      messages: [{ role: "user", content: "hi" }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      reasoning_effort: string;
    };
    expect(body.reasoning_effort).toBe("none");
  });
});

describe("fetchModels / testConnection", () => {
  it("lists ollama, openai, and gemini models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse({ models: [{ name: "llama3" }, { name: "" }] }))
        .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-4o" }, {}] }))
        .mockResolvedValueOnce(jsonResponse({ models: [{ name: "models/gemini-flash" }, { name: "other" }] })),
    );
    await expect(
      fetchModels({ provider: "ollama", baseUrl: "http://127.0.0.1:11434", extraHeaders: [] }),
    ).resolves.toEqual(["llama3"]);
    await expect(
      fetchModels({
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "k",
        extraHeaders: [{ key: "X-A", value: "b" }],
      }),
    ).resolves.toEqual(["gpt-4o"]);
    await expect(
      fetchModels({ provider: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: "k", extraHeaders: [] }),
    ).resolves.toEqual(["gemini-flash"]);
    await expect(
      fetchModels({ provider: "claude", baseUrl: "https://api.anthropic.com", extraHeaders: [] }),
    ).resolves.toEqual([]);
  });

  it("reports connection success and failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "gpt-4o" }] })));
    await expect(testConnection(sampleModel())).resolves.toMatchObject({ ok: true });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [] })));
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse({ data: [] }))
        .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "pong" } }] })),
    );
    await expect(testConnection(sampleModel())).resolves.toMatchObject({ ok: true, detail: "pong" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(testConnection(sampleModel())).resolves.toMatchObject({ ok: false, detail: "offline" });
  });
});
