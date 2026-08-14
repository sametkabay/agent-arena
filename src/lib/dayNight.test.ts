import { describe, expect, it } from "vitest";
import {
  isDayNightMode,
  lerpSceneLighting,
  mixHex,
  resolveSceneLighting,
} from "@/lib/dayNight";
import { SAMPLE_THEME } from "@/test/fixtures";

describe("isDayNightMode", () => {
  it("accepts only day and night", () => {
    expect(isDayNightMode("day")).toBe(true);
    expect(isDayNightMode("night")).toBe(true);
    expect(isDayNightMode("dusk")).toBe(false);
    expect(isDayNightMode(1)).toBe(false);
  });
});

describe("resolveSceneLighting", () => {
  it("uses theme colors by day and mixes them at night", () => {
    const day = resolveSceneLighting(SAMPLE_THEME, "day");
    expect(day.nightAmount).toBe(0);
    expect(day.background).toBe(SAMPLE_THEME.background);

    const night = resolveSceneLighting(SAMPLE_THEME, "night");
    expect(night.nightAmount).toBe(1);
    expect(night.background).not.toBe(SAMPLE_THEME.background);
  });
});

describe("lerpSceneLighting", () => {
  it("snaps to endpoints and blends in between", () => {
    const day = lerpSceneLighting(SAMPLE_THEME, -1);
    const night = lerpSceneLighting(SAMPLE_THEME, 2);
    const mid = lerpSceneLighting(SAMPLE_THEME, 0.5);
    expect(day.nightAmount).toBe(0);
    expect(night.nightAmount).toBe(1);
    expect(mid.nightAmount).toBe(0.5);
    expect(mid.sunIntensity).toBeGreaterThan(night.sunIntensity);
    expect(mid.sunIntensity).toBeLessThan(day.sunIntensity);
  });
});

describe("mixHex", () => {
  it("interpolates 6-digit and 3-digit colors", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#000", "#fff", 1)).toBe("#ffffff");
    expect(mixHex("not-hex", "#112233", 0.2)).toBe("not-hex");
    expect(mixHex("not-hex", "#112233", 0.8)).toBe("#112233");
    expect(mixHex("#gggggg", "#000000", 0.5)).toBe("#gggggg");
  });
});
