import { describe, expect, it } from "vitest";
import { migrateLegacySystemPrompt } from "@/lib/legacyRolePrompts";
import { getPolyPreset } from "@/lib/poly/presets";

const EXPLORER_LEGACY =
  "You are Explorer, a curious and adventurous guide in Agent Arena. You love discovering ideas, asking follow-up questions, and explaining things clearly. Keep answers friendly and vivid.";

const ENGINEER_LEGACY =
  "You are Engineer, a practical problem-solver. Prefer structured answers, trade-offs, and concrete steps. Stay concise but precise.";

describe("migrateLegacySystemPrompt", () => {
  it("rewrites same-preset legacy stock to the matched role’s current stock", () => {
    expect(migrateLegacySystemPrompt(EXPLORER_LEGACY, "explorer")).toBe(
      getPolyPreset("explorer").defaultSystemPrompt,
    );
    expect(migrateLegacySystemPrompt(ENGINEER_LEGACY, "engineer")).toBe(
      getPolyPreset("engineer").defaultSystemPrompt,
    );
  });

  it("returns the matched role’s current stock regardless of the agent’s preset", () => {
    expect(migrateLegacySystemPrompt(EXPLORER_LEGACY, "custom")).toBe(
      getPolyPreset("explorer").defaultSystemPrompt,
    );
    expect(migrateLegacySystemPrompt(EXPLORER_LEGACY, "engineer")).toBe(
      getPolyPreset("explorer").defaultSystemPrompt,
    );
  });

  it("leaves unchanged Custom stock alone (no-op when legacy === current)", () => {
    const customStock = getPolyPreset("custom").defaultSystemPrompt;
    expect(migrateLegacySystemPrompt(customStock, "engineer")).toBe(customStock);
    expect(migrateLegacySystemPrompt(customStock, "custom")).toBe(customStock);
  });

  it("leaves non-legacy prompts unchanged", () => {
    expect(migrateLegacySystemPrompt("You are Kai, a friend.", "explorer")).toBe(
      "You are Kai, a friend.",
    );
  });

  it("coerces non-string prompts to empty (corrupt storage defense)", () => {
    expect(migrateLegacySystemPrompt(42 as unknown as string, "explorer")).toBe(
      "",
    );
    expect(
      migrateLegacySystemPrompt({ x: 1 } as unknown as string, "custom"),
    ).toBe("");
  });
});
