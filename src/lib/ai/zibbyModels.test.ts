import { describe, expect, it } from "vitest";
import { resolveZibbyTextModel, ZIBBY_TEXT_MODELS } from "@/lib/ai/zibbyModels";

describe("resolveZibbyTextModel", () => {
  it("keeps catalog ids", () => {
    expect(resolveZibbyTextModel("claude-haiku-4-5-20251001").id).toBe(
      "claude-haiku-4-5-20251001",
    );
    expect(ZIBBY_TEXT_MODELS.length).toBeGreaterThan(4);
  });

  it("maps legacy ids onto the catalog", () => {
    expect(resolveZibbyTextModel("claude-3-5-sonnet-latest").id).toBe("claude-sonnet-5");
    expect(resolveZibbyTextModel("claude-3-opus").id).toBe("claude-opus-5");
    expect(resolveZibbyTextModel("gpt-4o-mini").id).toBe("gpt-5");
    expect(resolveZibbyTextModel("grok-beta").id).toBe("x-ai/grok-4");
    expect(resolveZibbyTextModel("claude-haiku").id).toBe("claude-haiku-4-5-20251001");
    expect(resolveZibbyTextModel("glm-4").id).toBe("z-ai/glm-4.6");
  });
});
