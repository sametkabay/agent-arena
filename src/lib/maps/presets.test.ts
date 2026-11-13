import { describe, expect, it } from "vitest";
import {
  MAP_PRESETS,
  createMapFromPreset,
  resolvePresetDefinition,
} from "@/lib/maps/presets";
import { getMap, mapsToMeta, shadowMapSize } from "@/lib/maps/types";
import { sampleMap } from "@/test/fixtures";
import { BUILTIN_MAP_IDS } from "@/lib/maps/runtime";
import en from "@/i18n/en.json";

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

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

  it("uses a localized name override and nextCopyName on collision", () => {
    const first = createMapFromPreset("starter_camp", {
      name: "Starter camp",
      takenNames: [],
      copyLabel: "copy",
    });
    expect(first.name).toBe("Starter camp");

    const second = createMapFromPreset("starter_camp", {
      name: "Starter camp",
      takenNames: ["Starter camp"],
      copyLabel: "copy",
    });
    expect(second.name).toBe("Starter camp (copy)");
  });

  it("always assigns a fresh custom_ id and retries collisions", () => {
    const existing = "custom_fixedid";
    const map = createMapFromPreset("blank_concrete", {
      name: "Concrete pad",
      existingIds: [existing],
    });
    expect(map.id.startsWith("custom_")).toBe(true);
    expect(map.id).not.toBe(existing);
  });

  it("resolves every preset nameKey/descriptionKey in en.json", () => {
    for (const preset of MAP_PRESETS) {
      expect(getByPath(en as Record<string, unknown>, preset.nameKey)).toEqual(
        expect.any(String),
      );
      expect(
        getByPath(en as Record<string, unknown>, preset.descriptionKey),
      ).toEqual(expect.any(String));
    }
  });
});

describe("resolvePresetDefinition", () => {
  it("builds preview maps without custom_ ids", () => {
    for (const preset of MAP_PRESETS) {
      const def = resolvePresetDefinition(preset);
      expect(def.id).toBe(`preset_${preset.id}`);
      expect(def.builtin).toBe(false);
      expect(def.floor.size).toBeGreaterThan(0);
    }
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
