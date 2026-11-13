import { describe, expect, it } from "vitest";
import { blankMap, isArenaMapDefinition, isMapZone } from "@/lib/maps";
import { getBuiltinMap } from "@/lib/maps/runtime";
import { MAP_PRESETS, resolvePresetDefinition } from "@/lib/maps/presets";
import {
  canAddLight,
  canAddZone,
  clampRegionsToFloor,
  convertZoneToRect,
  createLight,
  createZone,
  deleteTargets,
  lightsEqual,
  moveTargets,
  nextZoneName,
  normalizeHex,
  sanitizeZoneName,
  targetKind,
  updateLight,
  updateZone,
  zoneRadiusMax,
  zonesEqual,
  MAX_LIGHTS,
  MAX_ZONES,
  ZONE_SIZE_DEFAULT,
} from "@/lib/maps/mapRegionEdit";
import type { MapZone } from "@/lib/maps/mapRegions";

function baseMap(size = 40) {
  return blankMap({
    id: "t",
    name: "T",
    floor: { size, style: "surface", color: "#ccc", surface: "office" },
  });
}

describe("createZone / createLight", () => {
  it("creates a default 4×4 rectangle clamped into the floor", () => {
    const def = baseMap(20);
    const z = createZone("z1", [100, 0, 100], def, "Zone 1");
    expect(z.kind).toBe("custom");
    expect(z.name).toBe("Zone 1");
    expect(z.size).toEqual([ZONE_SIZE_DEFAULT, ZONE_SIZE_DEFAULT]);
    expect(z.radius).toBe(ZONE_SIZE_DEFAULT / 2);
    // Center must sit so the rect fits inside ±(size/2 - 0.05)
    expect(Math.abs(z.center[0]) + z.size![0] / 2).toBeLessThanOrEqual(10);
    expect(Math.abs(z.center[2]) + z.size![1] / 2).toBeLessThanOrEqual(10);
  });

  it("creates a light at default height with defaults", () => {
    const def = baseMap();
    const L = createLight("l1", [1, 0, 2], def);
    expect(L.id).toBe("l1");
    expect(L.position[0]).toBeCloseTo(1);
    expect(L.position[2]).toBeCloseTo(2);
    expect(L.position[1]).toBeGreaterThan(0);
    expect(L.intensity).toBeGreaterThan(0);
    expect(L.distance).toBeGreaterThan(0);
    expect(L.color.startsWith("#")).toBe(true);
  });
});

describe("nextZoneName", () => {
  it("starts at 1 and skips taken names without filling gaps", () => {
    expect(nextZoneName([], "Zone")).toBe("Zone 1");
    const zones: MapZone[] = [
      {
        id: "a",
        name: "Zone 1",
        kind: "custom",
        center: [0, 0, 0],
        radius: 2,
      },
      {
        id: "b",
        name: "Zone 3",
        kind: "custom",
        center: [0, 0, 0],
        radius: 2,
      },
    ];
    // Gaps left open: 1 and 3 exist → next is 4
    expect(nextZoneName(zones, "Zone")).toBe("Zone 4");
  });

  it("handles CJK stems and regex-special characters in the stem", () => {
    expect(nextZoneName([], "区域")).toBe("区域 1");
    expect(
      nextZoneName(
        [
          {
            id: "a",
            name: "区域 1",
            kind: "custom",
            center: [0, 0, 0],
            radius: 2,
          },
        ],
        "区域",
      ),
    ).toBe("区域 2");
    expect(nextZoneName([], "Z(one)+")).toBe("Z(one)+ 1");
    expect(
      nextZoneName(
        [
          {
            id: "a",
            name: "Z(one)+ 1",
            kind: "custom",
            center: [0, 0, 0],
            radius: 2,
          },
        ],
        "Z(one)+",
      ),
    ).toBe("Z(one)+ 2");
  });
});

describe("updateZone / updateLight", () => {
  it("does not re-clamp geometry on name/kind-only patches (Lounge regression)", () => {
    // Office Lounge sits past the clamp margin: center z=8.6, r=4 on floor 24
    // → half≈11.95, so a re-clamp would pull z to ≈7.95.
    const lounge: MapZone = {
      id: "lounge",
      name: "Lounge",
      kind: "indoor",
      center: [0, 0, 8.6],
      radius: 4,
    };
    const renamed = updateZone(lounge, { name: "LoungeX" }, 24);
    expect(renamed.center).toEqual([0, 0, 8.6]);
    expect(renamed.radius).toBe(4);
    expect(renamed.name).toBe("LoungeX");

    const rekinded = updateZone(lounge, { kind: "custom" }, 24);
    expect(rekinded.center).toEqual([0, 0, 8.6]);
    expect(rekinded.radius).toBe(4);
    expect(rekinded.kind).toBe("custom");
  });

  it("clamps circle radius to [min, floorSize/2]", () => {
    const z: MapZone = {
      id: "z",
      name: "C",
      kind: "indoor",
      center: [0, 0, 0],
      radius: 2,
    };
    expect(updateZone(z, { radius: 0.01 }, 20).radius).toBeGreaterThanOrEqual(0.5);
    expect(updateZone(z, { radius: 999 }, 20).radius).toBeLessThanOrEqual(
      zoneRadiusMax(20),
    );
  });

  it("clamps light intensity / distance / y and rejects bad hex", () => {
    const L = createLight("l", [0, 0, 0], baseMap());
    const hi = updateLight(L, { intensity: 99, distance: 999, color: "nope" }, 20);
    expect(hi.intensity).toBeLessThanOrEqual(3);
    expect(hi.distance).toBeLessThanOrEqual(40);
    expect(hi.color).toBe(L.color);
    const ok = updateLight(L, { color: "#abc" }, 20);
    expect(ok.color).toBe("#AABBCC");
    const tall = updateLight(
      L,
      { position: [0, 99, 0] },
      20,
    );
    expect(tall.position[1]).toBeLessThanOrEqual(8);
  });
});

describe("sanitizeZoneName", () => {
  it("trims, truncates, and falls back when empty", () => {
    expect(sanitizeZoneName("  Lounge  ", "Zone 1")).toBe("Lounge");
    expect(sanitizeZoneName("   ", "Zone 1")).toBe("Zone 1");
    expect(sanitizeZoneName("x".repeat(100), "Z").length).toBeLessThanOrEqual(40);
  });
});

describe("zonesEqual / lightsEqual (undo no-op helpers)", () => {
  it("detects identical vs changed zones and lights", () => {
    const z: MapZone = {
      id: "z",
      name: "A",
      kind: "custom",
      center: [1, 0, 2],
      radius: 3,
      size: [4, 4],
    };
    expect(zonesEqual(z, { ...z })).toBe(true);
    expect(zonesEqual(z, { ...z, name: "B" })).toBe(false);
    expect(zonesEqual(z, updateZone(z, { name: "A" }, 40))).toBe(true);

    const L = createLight("l", [0, 0, 0], baseMap());
    expect(lightsEqual(L, { ...L })).toBe(true);
    expect(lightsEqual(L, { ...L, intensity: L.intensity + 0.1 })).toBe(false);
  });
});

describe("moveTargets / deleteTargets / targetKind", () => {
  it("leaves zones undefined when the map had no zones array", () => {
    const def = blankMap({
      id: "m",
      name: "M",
      floor: { size: 30, style: "surface", color: "#ccc", surface: "office" },
      placeables: [
        {
          id: "p1",
          placeableId: "desk",
          position: [0, 0, 0],
          rotationY: 0,
        },
      ],
    });
    expect(def.zones).toBeUndefined();
    const next = moveTargets(def, [{ id: "p1", position: [2, 0, 2] }]);
    expect(next.zones).toBeUndefined();
    expect(next.lights).toBeUndefined();
  });

  it("moves placeables, spawns, zones, lights and preserves light Y", () => {
    const def = blankMap({
      id: "m",
      name: "M",
      floor: { size: 30, style: "surface", color: "#ccc", surface: "office" },
      placeables: [
        {
          id: "p1",
          placeableId: "desk",
          position: [0, 0, 0],
          rotationY: 0,
        },
      ],
      spawnPoints: [{ id: "s1", position: [1, 0, 1], rotationY: 0 }],
      zones: [
        {
          id: "z1",
          name: "A",
          kind: "custom",
          center: [2, 0, 2],
          radius: 2,
          size: [4, 4],
        },
      ],
      lights: [
        {
          id: "l1",
          position: [3, 4.2, 3],
          color: "#fff",
          intensity: 0.5,
          distance: 10,
        },
      ],
    });
    const next = moveTargets(def, [
      { id: "p1", position: [5, 0, 5] },
      { id: "s1", position: [6, 0, 6] },
      { id: "z1", position: [7, 0, 7] },
      { id: "l1", position: [8, 0, 8] },
    ]);
    expect(next.placeables[0]!.position).toEqual([5, 0, 5]);
    expect(next.spawnPoints[0]!.position).toEqual([6, 0, 6]);
    expect(next.zones![0]!.center[0]).toBeCloseTo(7);
    expect(next.zones![0]!.center[2]).toBeCloseTo(7);
    expect(next.lights![0]!.position[0]).toBeCloseTo(8);
    expect(next.lights![0]!.position[2]).toBeCloseTo(8);
    expect(next.lights![0]!.position[1]).toBe(4.2);

    expect(targetKind(def, "p1")).toBe("placeable");
    expect(targetKind(def, "s1")).toBe("spawn");
    expect(targetKind(def, "z1")).toBe("zone");
    expect(targetKind(def, "l1")).toBe("light");
    expect(targetKind(def, "nope")).toBeNull();

    const gone = deleteTargets(def, ["p1", "z1", "l1"]);
    expect(gone.placeables).toHaveLength(0);
    expect(gone.zones).toHaveLength(0);
    expect(gone.lights).toHaveLength(0);
    expect(gone.spawnPoints).toHaveLength(1);
  });
});

describe("clampRegionsToFloor", () => {
  it("pulls zones and lights inside when floor shrinks 40→10", () => {
    const def = blankMap({
      id: "m",
      name: "M",
      floor: { size: 40, style: "surface", color: "#ccc", surface: "office" },
      zones: [
        {
          id: "z",
          name: "Far",
          kind: "custom",
          center: [18, 0, 18],
          radius: 3,
          size: [6, 6],
        },
        {
          id: "c",
          name: "Circle",
          kind: "indoor",
          center: [15, 0, 0],
          radius: 8,
        },
      ],
      lights: [
        {
          id: "l",
          position: [18, 4, 18],
          color: "#fff",
          intensity: 1,
          distance: 12,
        },
      ],
      placeables: [
        {
          id: "p",
          placeableId: "desk",
          position: [18, 0, 18],
          rotationY: 0,
        },
      ],
    });
    const shrunk = clampRegionsToFloor({
      ...def,
      floor: { ...def.floor, size: 10 },
    });
    const half = 5 - 0.05;
    const z = shrunk.zones![0]!;
    expect(Math.abs(z.center[0]) + (z.size?.[0] ?? 0) / 2).toBeLessThanOrEqual(
      half + 0.01,
    );
    expect(Math.abs(shrunk.lights![0]!.position[0])).toBeLessThanOrEqual(half + 0.01);
    // Placeables are NOT clamped
    expect(shrunk.placeables[0]!.position[0]).toBe(18);
  });
});

describe("convertZoneToRect", () => {
  it("turns a circle into a square of side 2×radius", () => {
    const z: MapZone = {
      id: "z",
      name: "C",
      kind: "indoor",
      center: [0, 0, 0],
      radius: 3,
    };
    const r = convertZoneToRect(z, 40);
    expect(r.size).toEqual([6, 6]);
    expect(r.radius).toBe(3);
  });
});

describe("limits / hex", () => {
  it("reports when zone/light caps are reached", () => {
    const def = baseMap();
    expect(canAddZone(def)).toBe(true);
    expect(canAddLight(def)).toBe(true);
    const fullZ = {
      ...def,
      zones: Array.from({ length: MAX_ZONES }, (_, i) =>
        createZone(`z${i}`, [0, 0, 0], def, `Zone ${i}`),
      ),
    };
    const fullL = {
      ...def,
      lights: Array.from({ length: MAX_LIGHTS }, (_, i) =>
        createLight(`l${i}`, [0, 0, 0], def),
      ),
    };
    expect(canAddZone(fullZ)).toBe(false);
    expect(canAddLight(fullL)).toBe(false);
  });

  it("normalizes hex colors", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("ff00aa")).toBe("#FF00AA");
    expect(normalizeHex("nope")).toBeNull();
    expect(normalizeHex("#gg0000")).toBeNull();
  });
});

describe("schema compatibility", () => {
  it("accepts old circle zones and rejects invalid size", () => {
    expect(
      isMapZone({
        id: "z",
        name: "Lounge",
        kind: "indoor",
        center: [0, 0, 0],
        radius: 3,
      }),
    ).toBe(true);
    expect(
      isMapZone({
        id: "z",
        name: "Rect",
        kind: "custom",
        center: [0, 0, 0],
        radius: 2,
        size: [4, 4],
      }),
    ).toBe(true);
    expect(
      isMapZone({
        id: "z",
        name: "Bad",
        kind: "custom",
        center: [0, 0, 0],
        radius: 2,
        size: [4],
      }),
    ).toBe(false);
    expect(
      isMapZone({
        id: "z",
        name: "Bad",
        kind: "custom",
        center: [0, 0, 0],
        radius: 2,
        size: [-1, 4],
      }),
    ).toBe(false);
  });

  it("rejects non-positive / invalid circle radius and bad size shapes", () => {
    const base = {
      id: "z",
      name: "Z",
      kind: "custom",
      center: [0, 0, 0],
    };
    expect(isMapZone({ ...base, radius: 0 })).toBe(false);
    expect(isMapZone({ ...base, radius: -2 })).toBe(false);
    expect(isMapZone({ ...base, radius: Infinity })).toBe(false);
    expect(isMapZone({ ...base, radius: 2, size: null })).toBe(true); // null → circle
    expect(isMapZone({ ...base, radius: 2, size: [4, "4"] })).toBe(false);
    expect(isMapZone({ ...base, radius: 2, size: [4, 4, 4] })).toBe(false);
    expect(isMapZone({ ...base, radius: 2, size: [Infinity, 4] })).toBe(false);
  });

  it("derives radius from size when radius is omitted", () => {
    const raw: Record<string, unknown> = {
      id: "z",
      name: "Rect",
      kind: "custom",
      center: [0, 0, 0],
      size: [6, 4],
    };
    expect(isMapZone(raw)).toBe(true);
    expect((raw as { radius: number }).radius).toBe(3);
  });

  it("keeps builtin office/space and presets valid", () => {
    for (const id of ["office", "space"] as const) {
      const m = getBuiltinMap(id);
      expect(m).toBeTruthy();
      expect(isArenaMapDefinition(m!)).toBe(true);
      for (const z of m!.zones ?? []) expect(isMapZone(z)).toBe(true);
    }
    for (const p of MAP_PRESETS) {
      const def = resolvePresetDefinition(p);
      expect(isArenaMapDefinition(def)).toBe(true);
    }
  });

  it("accepts imported JSON with and without size", () => {
    const circle = blankMap({
      zones: [
        {
          id: "z",
          name: "Old",
          kind: "yard",
          center: [0, 0, 0],
          radius: 5,
        },
      ],
    });
    const rect = blankMap({
      zones: [
        {
          id: "z",
          name: "New",
          kind: "custom",
          center: [0, 0, 0],
          radius: 2,
          size: [4, 3],
        },
      ],
    });
    expect(isArenaMapDefinition(circle)).toBe(true);
    expect(isArenaMapDefinition(rect)).toBe(true);
    const bad = {
      ...rect,
      zones: [
        {
          id: "z",
          name: "X",
          kind: "custom",
          center: [0, 0, 0],
          radius: 2,
          size: ["a", 3],
        },
      ],
    };
    expect(isArenaMapDefinition(bad)).toBe(false);
  });
});
