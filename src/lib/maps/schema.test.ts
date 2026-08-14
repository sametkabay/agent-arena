import { describe, expect, it } from "vitest";
import {
  FLOOR_STYLES,
  blankMap,
  clampFloorSize,
  cloneMap,
  isArenaMapDefinition,
  isFloorStyle,
  migrateLegacyFloorStyle,
  migrateLegacyMapFloorStyles,
  migratePlaceableId,
} from "@/lib/maps/schema";
import { FLOOR_SIZE_MAX, FLOOR_SIZE_MIN } from "@/lib/maps/schema";

describe("floor styles", () => {
  it("validates and migrates legacy checker", () => {
    expect(FLOOR_STYLES).toContain("surface");
    expect(isFloorStyle("checker")).toBe(true);
    expect(isFloorStyle("wood")).toBe(false);
    expect(migrateLegacyFloorStyle("checker")).toBe("surface");
    expect(migrateLegacyFloorStyle("solid")).toBe("solid");
  });
});

describe("clampFloorSize", () => {
  it("rounds to one decimal and clamps", () => {
    expect(clampFloorSize(FLOOR_SIZE_MIN - 5)).toBe(FLOOR_SIZE_MIN);
    expect(clampFloorSize(FLOOR_SIZE_MAX + 5)).toBe(FLOOR_SIZE_MAX);
    expect(clampFloorSize(12.34)).toBe(12.3);
  });
});

describe("isArenaMapDefinition", () => {
  it("rejects malformed payloads", () => {
    expect(isArenaMapDefinition(null)).toBe(false);
    expect(isArenaMapDefinition({})).toBe(false);
    const ok = blankMap({ id: "m", name: "M" });
    expect(isArenaMapDefinition(ok)).toBe(true);
    expect(isArenaMapDefinition({ ...ok, version: 2 })).toBe(false);
    expect(isArenaMapDefinition({ ...ok, floor: { ...ok.floor, style: "nope" } })).toBe(
      false,
    );
    expect(isArenaMapDefinition({ ...ok, spawnPoints: "x" })).toBe(false);
    expect(isArenaMapDefinition({ ...ok, zones: [{ id: 1 }] })).toBe(false);
    expect(isArenaMapDefinition({ ...ok, lights: [{ id: 1 }] })).toBe(false);
    expect(isArenaMapDefinition({ ...ok, roomLights: "yes" })).toBe(false);
  });
});

describe("blankMap / cloneMap", () => {
  it("fills defaults and clones independently", () => {
    const a = blankMap({
      name: "Camp",
      zones: [{ id: "z", name: "Yard", kind: "yard", center: [0, 0, 0], radius: 2 }],
      lights: [
        { id: "l", position: [1, 2, 3], color: "#fff", intensity: 1, distance: 4 },
      ],
      roomLights: true,
    });
    expect(a.builtin).toBe(false);
    expect(a.zones?.[0]?.name).toBe("Yard");
    const b = cloneMap(a, { name: "Copy", floor: { ...a.floor, size: 18 } });
    expect(b.name).toBe("Copy");
    expect(b.floor.size).toBe(18);
    expect(a.name).toBe("Camp");
    a.zones![0]!.name = "mutated";
    expect(b.zones?.[0]?.name).toBe("Yard");
  });

  it("migrates legacy placeable ids on clone", () => {
    const map = blankMap({
      placeables: [
        {
          id: "p1",
          placeableId: "mars_boulder",
          position: [0, 0, 0],
          rotationY: 0,
          scale: 1,
        },
      ],
    });
    const cloned = cloneMap(map);
    expect(cloned.placeables[0]?.placeableId).toBe("space_boulder");
    expect(migratePlaceableId("lounge_chair")).toBe("furniture__lounge_chair_pimrvmqw1o");
    expect(migratePlaceableId("desk")).toBe("desk");
  });
});

describe("migrateLegacyMapFloorStyles", () => {
  it("rewrites checker floors only", () => {
    const checker = blankMap({
      floor: { size: 16, style: "checker", color: "#ccc", surface: "office" },
    });
    expect(migrateLegacyMapFloorStyles(checker).floor.style).toBe("surface");
    const solid = blankMap({
      floor: { size: 16, style: "solid", color: "#ccc", surface: "office" },
    });
    expect(migrateLegacyMapFloorStyles(solid)).toBe(solid);
  });
});
