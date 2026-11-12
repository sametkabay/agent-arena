import type { AgentConfig, ArenaAgent, PlaceableInstance } from "@/lib/types";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { blankMap, clampFloorSize, cloneMap, isArenaMapDefinition } from "@/lib/maps/schema";
import { newCustomMapId } from "@/lib/maps/importCollision";
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
  const spawns = def.spawnPoints.length
    ? def.spawnPoints
    : [{ position: [0, 0, 0] as [number, number, number], rotationY: Math.PI }];
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

function xzDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

/** First spawn index whose XY is free of occupied agent homes. */
function freeSpawnIndex(
  def: ArenaMapDefinition,
  occupied: readonly ArenaAgent[],
  fallback: number,
): number {
  const threshold = appConfig.maps.spawnRingOffset / 2;
  const limit = Math.max((occupied.length + 1) * 8, fallback + 1);
  for (let i = 0; i < limit; i++) {
    const spawn = spawnPosition(def, i);
    const taken = occupied.some(
      (agent) => xzDistance(agent.homePosition, spawn.position) < threshold,
    );
    if (!taken) return i;
  }
  return fallback;
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
  // Seed with every previously placed agent so newcomers (and later re-enables
  // that land earlier in `active`) see homes that are still occupied.
  const occupied = active.flatMap((c) => {
    const e = prevById.get(c.id);
    return e ? [e] : [];
  });
  const next: ArenaAgent[] = [];

  for (let i = 0; i < active.length; i++) {
    const cfg = active[i]!;
    const existing = prevById.get(cfg.id);
    if (existing) {
      const updated: ArenaAgent = {
        ...existing,
        displayName: cfg.displayName,
        modelConfigId: cfg.modelConfigId,
        polyPresetId: cfg.polyPresetId,
        characterId: cfg.characterId,
        systemPrompt: cfg.systemPrompt,
        color: cfg.color,
        bio: cfg.bio,
      };
      next.push(updated);
      continue;
    }
    const placed = placeAgentsOnMap([cfg], def)[0]!;
    const spawn = spawnPosition(def, freeSpawnIndex(def, occupied, i));
    const agent: ArenaAgent = {
      ...placed,
      position: [...spawn.position] as [number, number, number],
      homePosition: [...spawn.position] as [number, number, number],
      rotationY: spawn.rotationY,
    };
    next.push(agent);
    occupied.push(agent);
  }

  return next;
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
  return cloneMap(source, {
    id: newCustomMapId(),
    name: `${source.name}${appConfig.maps.copySuffix}`,
    builtin: false,
    description: source.description,
  });
}

export function createBlankCustomMap(): ArenaMapDefinition {
  return blankMap({
    id: newCustomMapId(),
    name: appConfig.maps.defaultCustomName,
    builtin: false,
  });
}
