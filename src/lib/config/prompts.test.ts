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
  });

  it("fills templates", () => {
    expect(fillPrompt("Hi {{userName}}", { userName: "Samet" })).toBe("Hi Samet");
    expect(fillPromptLines(["{{x}}"], { x: 2 })).toEqual(["2"]);
    expect(prompts.briefs.bioMax).toBeGreaterThan(0);
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
