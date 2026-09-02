import { describe, expect, it } from "vitest";
import {
  ASSET_CATEGORIES,
  ASSET_PACKS,
  PLACEABLE_SPECS,
  isPlaceableId,
  isUserPlaceableId,
  listPlaceables,
  pickClipName,
  placeableCanAnimate,
  placeableCanWander,
  registerUserPlaceable,
  unregisterUserPlaceable,
  yawToward,
} from "@/lib/assets/catalog";
import {
  ALL_CHARACTERS,
  DEFAULT_CHARACTER_ID,
  characterYawOffset,
  getCharacter,
  isCharacterId,
} from "@/lib/assets/characters";
import {
  ALL_POLY_PRESETS,
  CUSTOM_PRESET,
  getPolyPreset,
  isCustomPreset,
} from "@/lib/poly/presets";

describe("catalog helpers", () => {
  it("picks clip names case-insensitively", () => {
    expect(pickClipName(["Idle", "Walk"], ["walk"])).toBe("Walk");
    expect(pickClipName(["Idle"], ["run"])).toBeUndefined();
    expect(pickClipName([], ["walk"])).toBeUndefined();
    expect(pickClipName(["Idle"], undefined)).toBeUndefined();
  });

  it("yaws props toward a target", () => {
    const neg = yawToward([0, 0, 0], [0, 0, 1], "negZ");
    const pos = yawToward([0, 0, 0], [0, 0, 1], "posZ");
    expect(neg).toBeCloseTo(Math.PI, 5);
    expect(pos).toBeCloseTo(0, 5);
  });

  it("indexes placeables by category and wander flags", () => {
    expect(ASSET_PACKS).toContain("animals");
    expect(ASSET_CATEGORIES).toContain("furniture");
    const all = listPlaceables();
    expect(all.length).toBeGreaterThan(10);
    expect(isPlaceableId(all[0]!)).toBe(true);
    expect(isPlaceableId("not-real")).toBe(false);
    const animals = listPlaceables("animals");
    expect(animals.length).toBeGreaterThan(0);
    expect(animals.every((id) => PLACEABLE_SPECS[id].category === "animals")).toBe(true);

    const wanderId = all.find((id) => placeableCanWander(id));
    expect(wanderId).toBeTruthy();
    expect(placeableCanWander("not-real")).toBe(false);

    const animated = all.find((id) => placeableCanAnimate(id));
    expect(animated).toBeTruthy();
  });

  it("slugifies Kenney lounge chair and animal files into catalog ids", () => {
    const chair = Object.keys(PLACEABLE_SPECS).find((id) =>
      id.includes("lounge_chair"),
    );
    expect(chair).toBeTruthy();
    expect(PLACEABLE_SPECS[chair!]?.category).toBe("furniture");
    expect(isPlaceableId("animals__cat") || isPlaceableId("cat")).toBe(true);
  });

  it("classifies pack files into categories and wander/animate flags", () => {
    const byFile = (pack: string, file: string) =>
      Object.values(PLACEABLE_SPECS).find((s) => s.pack === pack && s.glb?.includes(encodeURIComponent(file)));

    expect(byFile("camping", "Tree.glb")?.category).toBe("nature");
    expect(byFile("camping", "Rock.glb")?.category).toBe("nature");
    expect(byFile("camping", "Tent.glb")?.category).toBe("camping");
    expect(byFile("furniture", "Rug Rectangle.glb")?.category).toBe("ground");
    expect(byFile("furniture", "Cardboard Box Closed.glb")?.category).toBe("decor");
    expect(PLACEABLE_SPECS.animals__cat?.canWander).toBe(true);
    expect(PLACEABLE_SPECS.animals__spider?.canWander).toBe(true);

    const fireId = Object.keys(PLACEABLE_SPECS).find((id) => PLACEABLE_SPECS[id].canAnimate);
    expect(fireId).toBeTruthy();
    expect(placeableCanAnimate(fireId!)).toBe(true);

    const blades = byFile("nature", "Grass Blades.glb") ?? byFile("trees", "Grass Blades.glb");
    expect(blades?.footprint[0]).toBeLessThan(1);
    const housePod = byFile("space", "House Pod.glb");
    expect(housePod?.targetSize).toBeTruthy();
    const floorLamp = Object.values(PLACEABLE_SPECS).find(
      (s) => /lamp/i.test(s.label) && /floor/i.test(s.label),
    );
    expect(floorLamp).toBeTruthy();
    expect(listPlaceables("vehicles").length).toBeGreaterThan(0);
    expect(listPlaceables("food").length).toBeGreaterThan(0);
    expect(listPlaceables("space").length).toBeGreaterThan(0);
    expect(listPlaceables("camping").length).toBeGreaterThan(0);
    expect(listPlaceables("decor").length).toBeGreaterThan(0);
    expect(listPlaceables("ground").length).toBeGreaterThan(0);
    expect(listPlaceables("nature").length).toBeGreaterThan(0);
  });

  it("registers, lists, and unregisters user-imported placeables", () => {
    const id = "user__test_asset";
    expect(isUserPlaceableId(id)).toBe(true);
    expect(isUserPlaceableId("furniture__chair")).toBe(false);
    expect(isPlaceableId(id)).toBe(false);

    registerUserPlaceable(id, {
      label: "Test asset",
      category: "decor",
      pack: "user",
      footprint: [0.5, 0.5],
      glb: "blob:mock",
      scale: 1,
    });
    expect(isPlaceableId(id)).toBe(true);
    expect(PLACEABLE_SPECS[id]?.label).toBe("Test asset");
    expect(listPlaceables("decor")).toContain(id);

    unregisterUserPlaceable(id);
    expect(isPlaceableId(id)).toBe(false);
    expect(listPlaceables("decor")).not.toContain(id);
  });
});

describe("characters", () => {
  it("resolves ids and yaw offset", () => {
    expect(ALL_CHARACTERS.length).toBeGreaterThan(0);
    expect(isCharacterId(DEFAULT_CHARACTER_ID)).toBe(true);
    expect(isCharacterId(null)).toBe(false);
    const spec = getCharacter("missing");
    expect(spec.id).toBeTruthy();
    expect(characterYawOffset({ ...spec, faces: "negZ" })).toBe(Math.PI);
    expect(characterYawOffset({ ...spec, faces: "posZ" })).toBe(0);
  });
});

describe("poly presets", () => {
  it("falls back to a known role", () => {
    expect(isCustomPreset(CUSTOM_PRESET.id)).toBe(true);
    expect(isCustomPreset("explorer")).toBe(false);
    expect(getPolyPreset(CUSTOM_PRESET.id).id).toBe(CUSTOM_PRESET.id);
    expect(ALL_POLY_PRESETS.length).toBeGreaterThan(1);
    const known = ALL_POLY_PRESETS.find((p) => p.id !== CUSTOM_PRESET.id)!;
    expect(getPolyPreset(known.id).id).toBe(known.id);
    expect(getPolyPreset("missing").id).toBeTruthy();
  });
});
