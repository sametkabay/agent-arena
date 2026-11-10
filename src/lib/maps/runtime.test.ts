import { describe, expect, it } from "vitest";
import { sampleAgent, sampleMap } from "@/test/fixtures";
import {
  BUILTIN_MAP_IDS,
  buildMapRuntime,
  createBlankCustomMap,
  createCustomMapFromBuiltin,
  exportMapJson,
  getBuiltinMap,
  isBuiltinMapId,
  listBuiltinMaps,
  parseMapJson,
  placeAgentsOnMap,
  resolveMapDefinition,
  syncRuntimeAgents,
} from "@/lib/maps/runtime";

describe("builtin maps", () => {
  it("lists shipped maps and resolves ids", () => {
    expect(BUILTIN_MAP_IDS.length).toBeGreaterThan(0);
    expect(isBuiltinMapId(BUILTIN_MAP_IDS[0]!)).toBe(true);
    expect(isBuiltinMapId("nope")).toBe(false);
    const listed = listBuiltinMaps();
    expect(listed.every((m) => m.builtin)).toBe(true);
    expect(getBuiltinMap("nope")).toBeNull();
    expect(getBuiltinMap(BUILTIN_MAP_IDS[0]!)?.id).toBe(BUILTIN_MAP_IDS[0]);
  });
});

describe("resolveMapDefinition", () => {
  it("prefers custom maps, then builtins, then fallback", () => {
    const custom = sampleMap({ id: "custom_abc", name: "Mine" });
    expect(resolveMapDefinition("custom_abc", [custom]).name).toBe("Mine");
    const builtinId = BUILTIN_MAP_IDS[0]!;
    expect(resolveMapDefinition(builtinId, []).id).toBe(builtinId);
    const fallback = resolveMapDefinition("missing", []);
    expect(fallback.id).toBeTruthy();
  });
});

describe("runtime placement", () => {
  it("places enabled agents and keeps pose on sync", () => {
    const map = sampleMap({
      spawnPoints: [
        { id: "s0", position: [2, 0, 0], rotationY: 0.5 },
        { id: "s1", position: [-2, 0, 0], rotationY: 1 },
      ],
    });
    const a = sampleAgent({ id: "a", displayName: "A" });
    const b = sampleAgent({ id: "b", displayName: "B", enabled: false });
    const placed = placeAgentsOnMap([a, b], map);
    expect(placed).toHaveLength(1);
    expect(placed[0]?.position[0]).toBe(2);

    const emptySpawns = sampleMap({ spawnPoints: [] });
    const origin = placeAgentsOnMap([a], emptySpawns);
    expect(origin[0]?.position).toEqual([0, 0, 0]);

    const synced = syncRuntimeAgents(placed, [a, sampleAgent({ id: "c", displayName: "C" })], map);
    expect(synced[0]?.position).toEqual(placed[0]?.position);
    expect(synced[0]?.displayName).toBe("A");
    expect(synced[1]?.id).toBe("c");
    expect(synced[1]?.homePosition).toBeDefined();
  });

  it("places a newcomer on a free spawn after delete-then-duplicate", () => {
    const map = sampleMap({
      spawnPoints: [
        { id: "s0", position: [2, 0, 0], rotationY: 0 },
        { id: "s1", position: [-2, 0, 0], rotationY: 0 },
      ],
    });
    const a = sampleAgent({ id: "a", displayName: "A" });
    const b = sampleAgent({ id: "b", displayName: "B" });
    const placed = placeAgentsOnMap([a, b], map);
    const withoutA = syncRuntimeAgents(placed, [b], map);
    expect(withoutA).toHaveLength(1);

    const copy = sampleAgent({ id: "b-copy", displayName: "B (copy)" });
    const synced = syncRuntimeAgents(withoutA, [b, copy], map);
    const homeB = synced.find((r) => r.id === "b")!.homePosition;
    const homeCopy = synced.find((r) => r.id === "b-copy")!.homePosition;
    const dx = homeB[0] - homeCopy[0];
    const dz = homeB[2] - homeCopy[2];
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0.3);
  });

  it("keeps re-enabled agent off a copy that took its freed slot", () => {
    const map = sampleMap({
      spawnPoints: [
        { id: "s0", position: [2, 0, 0], rotationY: 0 },
        { id: "s1", position: [-2, 0, 0], rotationY: 0 },
      ],
    });
    const a = sampleAgent({ id: "a", displayName: "A" });
    const b = sampleAgent({ id: "b", displayName: "B" });
    const placed = placeAgentsOnMap([a, b], map);
    // Disable A — B keeps slot 1; A's home is freed.
    const withoutA = syncRuntimeAgents(placed, [b], map);
    const copy = sampleAgent({ id: "b-copy", displayName: "B (copy)" });
    // Copy takes free slot 0.
    const withCopy = syncRuntimeAgents(withoutA, [b, copy], map);
    // Re-enable A (comes first in active). Must not land on the copy's home.
    const reEnabled = syncRuntimeAgents(withCopy, [a, b, copy], map);
    const homeA = reEnabled.find((r) => r.id === "a")!.homePosition;
    const homeCopy = reEnabled.find((r) => r.id === "b-copy")!.homePosition;
    const dx = homeA[0] - homeCopy[0];
    const dz = homeA[2] - homeCopy[2];
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0.3);
  });

  it("ignores live wander position when choosing a free spawn", () => {
    const map = sampleMap({
      spawnPoints: [
        { id: "s0", position: [2, 0, 0], rotationY: 0 },
        { id: "s1", position: [-2, 0, 0], rotationY: 0 },
      ],
    });
    const a = sampleAgent({ id: "a", displayName: "A" });
    const placed = placeAgentsOnMap([a], map);
    // Agent home stays on s0, but live position sits on free s1.
    const wandering = [
      {
        ...placed[0]!,
        position: [-2, 0, 0] as [number, number, number],
        homePosition: [2, 0, 0] as [number, number, number],
      },
    ];
    const copy = sampleAgent({ id: "b", displayName: "B" });
    const synced = syncRuntimeAgents(wandering, [a, copy], map);
    const homeCopy = synced.find((r) => r.id === "b")!.homePosition;
    // Newcomer should still take s1 despite the wanderer standing there.
    expect(homeCopy).toEqual([-2, 0, 0]);
  });

  it("gives distinct homes to two newcomers in one sync", () => {
    const map = sampleMap({
      spawnPoints: [
        { id: "s0", position: [2, 0, 0], rotationY: 0 },
        { id: "s1", position: [-2, 0, 0], rotationY: 0 },
      ],
    });
    const synced = syncRuntimeAgents(
      [],
      [
        sampleAgent({ id: "n1", displayName: "N1" }),
        sampleAgent({ id: "n2", displayName: "N2" }),
      ],
      map,
    );
    expect(synced[0]!.homePosition).not.toEqual(synced[1]!.homePosition);
  });

  it("rings outward on maps with no spawn points after index 0", () => {
    const map = sampleMap({ spawnPoints: [] });
    const placed = placeAgentsOnMap(
      [
        sampleAgent({ id: "a", displayName: "A" }),
        sampleAgent({ id: "b", displayName: "B" }),
        sampleAgent({ id: "c", displayName: "C" }),
      ],
      map,
    );
    expect(placed[0]?.position).toEqual([0, 0, 0]);
    expect(placed[1]?.position).not.toEqual(placed[0]?.position);
    expect(placed[2]?.position).not.toEqual(placed[1]?.position);
  });

  it("builds a runtime snapshot", () => {
    const map = sampleMap({
      placeables: [
        {
          id: "p",
          placeableId: "desk",
          position: [1, 0, 1],
          rotationY: 0,
          scale: 1,
        },
      ],
    });
    const rt = buildMapRuntime(map);
    expect(rt.floorSize).toBe(map.floor.size);
    expect(rt.placeables[0]?.id).toBe("p");
  });
});

describe("parse / export map JSON", () => {
  it("round-trips a valid map and rejects junk", () => {
    const map = sampleMap({ name: "Export me" });
    const json = exportMapJson(map);
    expect(json.endsWith("\n")).toBe(true);
    const parsed = parseMapJson(json);
    expect(parsed.name).toBe("Export me");
    expect(parsed.builtin).toBe(false);
    expect(() => parseMapJson("{")).toThrow(/Invalid JSON/);
    expect(() => parseMapJson("{}")).toThrow(/Invalid Agent Arena map/);
  });
});

describe("custom map factories", () => {
  it("copies a builtin and creates a blank custom map", () => {
    const fromBuiltin = createCustomMapFromBuiltin(BUILTIN_MAP_IDS[0]!, []);
    expect(fromBuiltin.id.startsWith("custom_")).toBe(true);
    expect(fromBuiltin.builtin).toBe(false);
    expect(fromBuiltin.name).toContain(getBuiltinMap(BUILTIN_MAP_IDS[0]!)!.name);

    const blank = createBlankCustomMap();
    expect(blank.id.startsWith("custom_")).toBe(true);
    expect(blank.builtin).toBe(false);
  });
});
