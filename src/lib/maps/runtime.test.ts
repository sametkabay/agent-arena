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
