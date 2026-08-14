import { describe, expect, it } from "vitest";
import { MAP_PRESETS, createMapFromPreset } from "@/lib/maps/presets";
import { getMap, mapsToMeta, shadowMapSize } from "@/lib/maps/types";
import { sampleMap } from "@/test/fixtures";
import { BUILTIN_MAP_IDS } from "@/lib/maps/runtime";

describe("createMapFromPreset", () => {
  it("builds a custom map from each shipped preset", () => {
    expect(MAP_PRESETS.length).toBeGreaterThan(0);
    for (const preset of MAP_PRESETS) {
      const map = createMapFromPreset(preset.id);
      expect(map.id.startsWith("custom_")).toBe(true);
      expect(map.builtin).toBe(false);
      expect(map.name).toBeTruthy();
    }
    const unknown = createMapFromPreset("not-a-preset");
    expect(unknown.id.startsWith("custom_")).toBe(true);
  });
});

describe("map meta", () => {
  it("lists builtins plus customs and resolves getMap", () => {
    const custom = sampleMap({ id: "custom_x", name: "X" });
    const meta = mapsToMeta([custom]);
    expect(meta.some((m) => m.builtin)).toBe(true);
    expect(meta.find((m) => m.id === "custom_x")?.name).toBe("X");
    expect(getMap(BUILTIN_MAP_IDS[0]!).builtin).toBe(true);
    expect(getMap("custom_x", [custom]).builtin).toBe(false);
  });

  it("maps shadow quality to a texture size", () => {
    expect(shadowMapSize("off")).toBeGreaterThanOrEqual(0);
    expect(shadowMapSize("high")).toBeGreaterThan(shadowMapSize("low"));
  });
});
