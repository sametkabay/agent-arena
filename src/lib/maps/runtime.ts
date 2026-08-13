import type { AgentConfig, ArenaAgent, PlaceableInstance } from "@/lib/types";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { blankMap, clampFloorSize, cloneMap, isArenaMapDefinition } from "@/lib/maps/schema";
import { appConfig } from "@/lib/config";

const builtinMapModules = import.meta.glob("../../../data/maps/*.json", {
  eager: true,
  import: "default",
}) as Record<string, ArenaMapDefinition>;

function loadBuiltinRaw(): Record<string, ArenaMapDefinition> {
  const out: Record<string, ArenaMapDefinition> = {};
  for (const def of Object.values(builtinMapModules)) {
    if (def && typeof def === "object" && typeof def.id === "string") {
      out[def.id] = def;
    }
  }
  return out;
}

const BUILTIN_RAW = loadBuiltinRaw();

export const BUILTIN_MAP_IDS = Object.keys(BUILTIN_RAW);
export type BuiltinMapId = string;

export function isBuiltinMapId(id: string): id is BuiltinMapId {
  return id in BUILTIN_RAW;
}

export function listBuiltinMaps(): ArenaMapDefinition[] {
  return BUILTIN_MAP_IDS.map((id) => cloneMap(BUILTIN_RAW[id]!, { builtin: true }));
}

export function getBuiltinMap(id: string): ArenaMapDefinition | null {
  if (!isBuiltinMapId(id)) return null;
  return cloneMap(BUILTIN_RAW[id]!, { builtin: true });
}

function fallbackBuiltin(): ArenaMapDefinition {
  return (
    getBuiltinMap(appConfig.defaults.mapId) ??
    getBuiltinMap(BUILTIN_MAP_IDS[0] ?? "") ??
    blankMap({
      id: "fallback",
      name: appConfig.maps.defaultBlankName,
      builtin: true,
    })
  );
}

export function resolveMapDefinition(
  mapId: string,
  customMaps: ArenaMapDefinition[],
): ArenaMapDefinition {
  const custom = customMaps.find((m) => m.id === mapId);
  if (custom) return cloneMap(custom, { builtin: false });
  const builtin = getBuiltinMap(mapId);
  if (builtin) return builtin;
  return fallbackBuiltin();
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
  const base = spawns[index % spawns.length]!;
  const ring = Math.floor(index / spawns.length);
  const angle = ring * appConfig.maps.spawnRingAngle;
  const offset = ring * appConfig.maps.spawnRingOffset;
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
        characterId: cfg.characterId,
        systemPrompt: cfg.systemPrompt,
        color: cfg.color,
        bio: cfg.bio,
        position: [...spawn.position] as [number, number, number],
        homePosition: [...spawn.position] as [number, number, number],
        rotationY: spawn.rotationY,
        state: "idle" as const,
        thinkingIntensity: 0,
        moveSpeed: appConfig.maps.agentMoveSpeed,
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
        characterId: cfg.characterId,
        systemPrompt: cfg.systemPrompt,
        color: cfg.color,
        bio: cfg.bio,
      };
    }
    const placed = placeAgentsOnMap([cfg], def)[0]!;
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
    name: `${source.name}${appConfig.maps.copySuffix}`,
    builtin: false,
    description: source.description,
  });
}

export function createBlankCustomMap(): ArenaMapDefinition {
  return blankMap({
    id: `custom_${Math.random().toString(36).slice(2, 10)}`,
    name: appConfig.maps.defaultCustomName,
    builtin: false,
  });
}
