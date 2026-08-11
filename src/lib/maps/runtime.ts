import type { AgentConfig, ArenaAgent, PlaceableInstance } from "@/lib/types";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { blankMap, clampFloorSize, cloneMap, isArenaMapDefinition } from "@/lib/maps/schema";
import officeDef from "@/lib/maps/defs/office.json";
import natureDef from "@/lib/maps/defs/nature.json";
import factoryDef from "@/lib/maps/defs/factory.json";
import marsDef from "@/lib/maps/defs/mars.json";

export const BUILTIN_MAP_IDS = ["office", "nature", "factory", "mars"] as const;
export type BuiltinMapId = (typeof BUILTIN_MAP_IDS)[number];

const BUILTIN_RAW: Record<BuiltinMapId, ArenaMapDefinition> = {
  office: officeDef as ArenaMapDefinition,
  nature: natureDef as ArenaMapDefinition,
  factory: factoryDef as ArenaMapDefinition,
  mars: marsDef as ArenaMapDefinition,
};

export function isBuiltinMapId(id: string): id is BuiltinMapId {
  return (BUILTIN_MAP_IDS as readonly string[]).includes(id);
}

export function listBuiltinMaps(): ArenaMapDefinition[] {
  return BUILTIN_MAP_IDS.map((id) => cloneMap(BUILTIN_RAW[id], { builtin: true }));
}

export function getBuiltinMap(id: string): ArenaMapDefinition | null {
  if (!isBuiltinMapId(id)) return null;
  return cloneMap(BUILTIN_RAW[id], { builtin: true });
}

export function resolveMapDefinition(
  mapId: string,
  customMaps: ArenaMapDefinition[],
): ArenaMapDefinition {
  const custom = customMaps.find((m) => m.id === mapId);
  if (custom) return cloneMap(custom, { builtin: false });
  const builtin = getBuiltinMap(mapId);
  if (builtin) return builtin;
  return getBuiltinMap("office")!;
}

export function buildMapRuntime(def: ArenaMapDefinition): {
  floorSize: number;
  placeables: PlaceableInstance[];
} {
  return {
    floorSize: clampFloorSize(def.floor.size),
    placeables: structuredClone(def.placeables),
  };
}

function spawnPosition(
  def: ArenaMapDefinition,
  index: number,
): { position: [number, number, number]; rotationY: number } {
  const spawns = def.spawnPoints;
  if (!spawns.length) {
    return { position: [0, 0, 0], rotationY: Math.PI };
  }
  const base = spawns[index % spawns.length];
  const ring = Math.floor(index / spawns.length);
  const angle = ring * 0.85;
  const offset = ring * 0.65;
  return {
    position: [
      base.position[0] + Math.cos(angle) * offset,
      0,
      base.position[2] + Math.sin(angle) * offset,
    ],
    rotationY: base.rotationY,
  };
}

export function placeAgentsOnMap(
  configs: AgentConfig[],
  def: ArenaMapDefinition,
): ArenaAgent[] {
  return configs
    .filter((cfg) => cfg.enabled !== false)
    .map((cfg, i) => {
      const spawn = spawnPosition(def, i);
      return {
        id: cfg.id,
        displayName: cfg.displayName,
        modelConfigId: cfg.modelConfigId,
        polyPresetId: cfg.polyPresetId,
        systemPrompt: cfg.systemPrompt,
        color: cfg.color,
        bio: cfg.bio,
        position: [...spawn.position] as [number, number, number],
        homePosition: [...spawn.position] as [number, number, number],
        rotationY: spawn.rotationY,
        state: "idle" as const,
        thinkingIntensity: 0,
        moveSpeed: 1.6,
      };
    });
}

/** Keep existing runtime pose for known agents; place newcomers on free spawns. */
export function syncRuntimeAgents(
  prev: ArenaAgent[],
  configs: AgentConfig[],
  def: ArenaMapDefinition,
): ArenaAgent[] {
  const active = configs.filter((cfg) => cfg.enabled !== false);
  const prevById = new Map(prev.map((a) => [a.id, a]));
  return active.map((cfg, i) => {
    const existing = prevById.get(cfg.id);
    if (existing) {
      return {
        ...existing,
        displayName: cfg.displayName,
        modelConfigId: cfg.modelConfigId,
        polyPresetId: cfg.polyPresetId,
        systemPrompt: cfg.systemPrompt,
        color: cfg.color,
        bio: cfg.bio,
      };
    }
    const placed = placeAgentsOnMap([cfg], def)[0];
    // Prefer index-based spawn for brand-new agents when possible
    const spawn = spawnPosition(def, i);
    return {
      ...placed,
      position: [...spawn.position] as [number, number, number],
      homePosition: [...spawn.position] as [number, number, number],
      rotationY: spawn.rotationY,
    };
  });
}

export function parseMapJson(raw: string): ArenaMapDefinition {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid JSON — could not parse map file");
  }
  if (!isArenaMapDefinition(data)) {
    throw new Error(
      "Invalid Agent Arena map (expected aamf v1 with floor, theme, spawnPoints, placeables)",
    );
  }
  const normalized = cloneMap(data, {
    builtin: false,
    floor: {
      ...data.floor,
      size: clampFloorSize(data.floor.size),
    },
  });
  return normalized;
}

export function exportMapJson(def: ArenaMapDefinition): string {
  const out = cloneMap(def, { builtin: def.builtin === true });
  return `${JSON.stringify(out, null, 2)}\n`;
}

export function createCustomMapFromBuiltin(
  sourceId: string,
  customMaps: ArenaMapDefinition[],
): ArenaMapDefinition {
  const source = resolveMapDefinition(sourceId, customMaps);
  const id = `custom_${Math.random().toString(36).slice(2, 10)}`;
  return cloneMap(source, {
    id,
    name: `${source.name} (copy)`,
    builtin: false,
    description: source.description,
  });
}

export function createBlankCustomMap(): ArenaMapDefinition {
  return blankMap({
    id: `custom_${Math.random().toString(36).slice(2, 10)}`,
    name: "My map",
    builtin: false,
  });
}
