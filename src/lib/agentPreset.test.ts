import { describe, expect, it } from "vitest";
import { applyRolePreset, isStockBio } from "@/lib/agentPreset";
import { migrateLegacySystemPrompt } from "@/lib/legacyRolePrompts";
import { ALL_POLY_PRESETS, CUSTOM_PRESET, getPolyPreset } from "@/lib/poly/presets";
import { sampleAgent } from "@/test/fixtures";

const EXPLORER_LEGACY =
  "You are Explorer, a curious and adventurous guide in Agent Arena. You love discovering ideas, asking follow-up questions, and explaining things clearly. Keep answers friendly and vivid.";

describe("applyRolePreset (#71)", () => {
  it("never modifies displayName, whatever it was", () => {
    for (const displayName of ["Ada", "", "Explorer", "explorer", "  "]) {
      for (const preset of ALL_POLY_PRESETS) {
        const next = applyRolePreset(
          sampleAgent({ displayName, polyPresetId: "explorer" }),
          preset.id,
        );
        expect(next.displayName).toBe(displayName);
        expect(next.polyPresetId).toBe(preset.id);
      }
    }
  });

  it("applies the role persona and color for named roles", () => {
    const next = applyRolePreset(sampleAgent({ displayName: "Ada" }), "engineer");
    const engineer = getPolyPreset("engineer");
    expect(next.systemPrompt).toBe(engineer.defaultSystemPrompt);
    expect(next.color).toBe(engineer.defaultColor);
  });

  it("keeps an existing prompt when switching to custom", () => {
    const kept = applyRolePreset(sampleAgent({ systemPrompt: "Mine." }), "custom");
    expect(kept.systemPrompt).toBe("Mine.");
    const filled = applyRolePreset(sampleAgent({ systemPrompt: "" }), "custom");
    expect(filled.systemPrompt).toBe(CUSTOM_PRESET.defaultSystemPrompt);
  });

  it("keeps a legacy explorer prompt through explorer→custom; migration maps to explorer stock", () => {
    const afterSwitch = applyRolePreset(
      sampleAgent({
        displayName: "Kai",
        polyPresetId: "explorer",
        systemPrompt: EXPLORER_LEGACY,
      }),
      "custom",
    );
    expect(afterSwitch.systemPrompt).toBe(EXPLORER_LEGACY);
    const migrated = migrateLegacySystemPrompt(
      afterSwitch.systemPrompt,
      afterSwitch.polyPresetId,
    );
    expect(migrated).toBe(getPolyPreset("explorer").defaultSystemPrompt);
    expect(migrated).not.toBe(getPolyPreset("custom").defaultSystemPrompt);
  });

  it("swaps a stock bio but keeps a hand-written one", () => {
    const stock = applyRolePreset(
      sampleAgent({ bio: getPolyPreset("explorer").defaultBio }),
      "scholar",
    );
    expect(stock.bio).toBe(getPolyPreset("scholar").defaultBio);
    const own = applyRolePreset(sampleAgent({ bio: "My own bio." }), "scholar");
    expect(own.bio).toBe("My own bio.");
    expect(isStockBio("", "generic-male", "explorer")).toBe(true);
  });
});

describe("role presets (#71)", () => {
  it("default prompts never hard-code the role name as the agent's identity", () => {
    for (const preset of ALL_POLY_PRESETS) {
      const prompt = preset.defaultSystemPrompt.trim();
      expect(prompt.toLowerCase()).not.toMatch(
        new RegExp(`^you are ${preset.defaultDisplayName.toLowerCase()}\\b`),
      );
    }
  });
});
