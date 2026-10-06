import { afterEach, describe, expect, it, vi } from "vitest";
import { ZibbyAiError } from "@zibby-run/app-kit";
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

const streamZibbyAi = vi.fn();
const publishBalance = vi.fn();

vi.mock("@zibby-run/app-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@zibby-run/app-kit")>();
  return {
    ...actual,
    streamZibbyAi: (...args: unknown[]) => streamZibbyAi(...args),
    publishBalance: (...args: unknown[]) => publishBalance(...args),
  };
});

const world: ArenaWorldContext = {
  userName: "Samet",
  language: "en",
  mapName: "Office",
  mapDescription: "",
  mapAreas: [],
  dayNight: "day",
  otherAgents: [],
};

afterEach(() => {
  streamZibbyAi.mockReset();
  publishBalance.mockReset();
});

describe("provider helpers", () => {
  it("returns catalog defaults per provider family", () => {
    expect(providerDefaults("claude").modelId).toContain("claude");
    expect(providerDefaults("openai").modelId).toBeTruthy();
    expect(providerDefaults("gemini").modelId).toBeTruthy();
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
  it("sends an Anthropic payload through streamZibbyAi", async () => {
    streamZibbyAi.mockResolvedValue({
      text: "Hello",
      terminal: { charged_cr: 2, balance_cr: 10 },
      requestId: "r1",
    });
    const text = await chatCompletion({
      model: sampleModel({ provider: "claude", modelId: "claude-haiku-4-5-20251001" }),
      action: "private_chat",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      onToken: () => {},
    });
    expect(text).toBe("Hello");
    expect(publishBalance).toHaveBeenCalledWith(10);
    const req = streamZibbyAi.mock.calls[0]?.[0] as {
      provider: string;
      model: string;
      action: string;
      payload: { system?: string; max_tokens: number };
    };
    expect(req.provider).toBe("anthropic");
    expect(req.model).toBe("claude-haiku-4-5-20251001");
    expect(req.action).toBe("private_chat");
    expect(req.payload.system).toBe("sys");
    expect(req.payload.max_tokens).toBe(2048);
  });

  it("uses a smaller budget for idle mutters and OpenAI message shape", async () => {
    streamZibbyAi.mockResolvedValue({ text: "Hmm.", terminal: null, requestId: null });
    await chatCompletion({
      model: sampleModel({ modelId: "gpt-4o-mini" }),
      action: "idle_mutter",
      messages: [{ role: "user", content: "…" }],
    });
    const req = streamZibbyAi.mock.calls[0]?.[0] as {
      provider: string;
      model: string;
      payload: { max_tokens: number; messages: Array<{ role: string }> };
    };
    expect(req.provider).toBe("openai");
    expect(req.model).toBe("gpt-5");
    expect(req.payload.max_tokens).toBe(256);
    expect(req.payload.messages[0]?.role).toBe("user");
  });

  it("maps Zibby refusals to plain errors", async () => {
    streamZibbyAi.mockRejectedValue(
      new ZibbyAiError("insufficient_credits", "nope"),
    );
    await expect(
      chatCompletion({
        model: sampleModel(),
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/credits/i);

    streamZibbyAi.mockRejectedValue(new ZibbyAiError("session_cap_reached", "cap"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/cap/i);

    streamZibbyAi.mockRejectedValue(new ZibbyAiError("unauthenticated", "auth"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/Sign in/i);

    streamZibbyAi.mockRejectedValue(new ZibbyAiError("locked", "hold"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/on hold/i);

    streamZibbyAi.mockRejectedValue(new ZibbyAiError("rate_limited", "slow"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/Too many/i);

    streamZibbyAi.mockRejectedValue(new ZibbyAiError("unknown_model", "bad"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/not available/i);

    streamZibbyAi.mockRejectedValue(new ZibbyAiError("network", "down"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/down/);

    streamZibbyAi.mockRejectedValue(new Error("boom"));
    await expect(
      chatCompletion({ model: sampleModel(), messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow("boom");
  });

  it("sanitizes action labels and enables Anthropic thinking", async () => {
    streamZibbyAi.mockResolvedValue({ text: "ok", terminal: null, requestId: null });
    await chatCompletion({
      model: sampleModel({ provider: "claude", modelId: "claude-haiku-4-5-20251001" }),
      action: "Not Valid!",
      thinkingEnabled: true,
      messages: [{ role: "system", content: "sys" }],
    });
    const req = streamZibbyAi.mock.calls[0]?.[0] as {
      action: string;
      payload: { thinking?: { type: string }; messages: Array<{ content: string }> };
    };
    expect(req.action).toBe("chat");
    expect(req.payload.thinking?.type).toBe("enabled");
    expect(req.payload.messages[0]?.content).toBe("…");
  });

  it("rethrows abort", async () => {
    streamZibbyAi.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(
      chatCompletion({
        model: sampleModel(),
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("fetchModels / testConnection", () => {
  it("lists the Zibby catalog", async () => {
    const ids = await fetchModels({
      provider: "openai",
      baseUrl: "",
      extraHeaders: [],
    });
    expect(ids.length).toBeGreaterThan(3);
    expect(ids.some((id) => id.includes("claude"))).toBe(true);
  });

  it("validates a catalog model without a network call", async () => {
    await expect(testConnection(sampleModel({ modelId: "claude-sonnet-5" }))).resolves.toMatchObject({
      ok: true,
      detail: "claude-sonnet-5",
    });
  });
});
