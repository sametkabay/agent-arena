import { describe, expect, it } from "vitest";
import {
  PROMPT_MODES,
  fillPrompt,
  fillPromptLines,
  promptMode,
  prompts,
} from "@/lib/config/prompts";
import { speechMsForText, appConfig } from "@/lib/config";

describe("prompts", () => {
  it("exposes every arena mode", () => {
    for (const mode of PROMPT_MODES) {
      const spec = promptMode(mode);
      expect(spec.channelId).toBeTruthy();
      expect(spec.how).toBeTruthy();
      expect(spec.lines.length).toBeGreaterThan(0);
    }
    expect(PROMPT_MODES).toContain("arena_conversation");
  });

  it("fills templates", () => {
    expect(fillPrompt("Hi {{userName}}", { userName: "Samet" })).toBe("Hi Samet");
    expect(fillPromptLines(["{{x}}"], { x: 2 })).toEqual(["2"]);
    expect(prompts.briefs.bioMax).toBeGreaterThan(0);
    expect(prompts.user.arenaConversation).toContain("<recent_arena>");
    expect(prompts.session.speechDisciplineConversation).toBeTruthy();
    expect(prompts.situation.footerConversation).toBeTruthy();
  });

  it("defines temperament bands for levels 1–10", () => {
    for (let level = 1; level <= 10; level++) {
      expect(Object.prototype.hasOwnProperty.call(prompts.temperament.bands, String(level))).toBe(
        true,
      );
    }
    expect(prompts.temperament.bands["5"]).toBeNull();
    expect(prompts.temperament.bands["1"]).toMatchObject({
      label: expect.any(String),
      instruction: expect.any(String),
      civility: "agreeable",
    });
    expect(prompts.temperament.bands["9"]).toMatchObject({
      civility: "blunt",
      label: "very combative",
    });
    expect(prompts.temperament.bands["10"]).toMatchObject({
      label: "fiercely contrarian",
      civility: "blunt",
    });
    expect(prompts.temperament.line).toContain("{{level}}");
    expect(prompts.temperament.line).toContain("{{civility}}");
    expect(prompts.temperament.civilityAgreeable).toMatch(/Whatever your stance/i);
    expect(prompts.temperament.civilityBlunt).toMatch(/Even when blunt/i);
  });
});

describe("speechMsForText", () => {
  it("clamps duration to configured min/max", () => {
    const { minMs, maxMs } = appConfig.speech;
    expect(speechMsForText("")).toBe(minMs);
    expect(speechMsForText("x".repeat(50_000))).toBe(maxMs);
    expect(speechMsForText("hello")).toBeGreaterThanOrEqual(minMs);
  });
});
