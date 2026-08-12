import type { PlaceableInstance } from "@/lib/types";
import {
  applyFloorSurface,
  isFloorSurfaceId,
  type FloorSurfaceId,
} from "@/lib/maps/floorSurfaces";
import {
  isMapLightPoint,
  isMapZone,
  type MapLightPoint,
  type MapZone,
} from "@/lib/maps/mapRegions";

export type { MapLightPoint, MapZone } from "@/lib/maps/mapRegions";

export interface MapTheme {
  floor: string;
  accent: string;
  background: string;
  fog: string;
  ambient: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
}

export type FloorStyle =
  | "surface"
  | "solid"
  | "checker"
  | "patches"
  | "slabs";

export const FLOOR_STYLES: readonly FloorStyle[] = [
  "surface",
  "solid",
  "checker",
  "patches",
  "slabs",
] as const;

export function isFloorStyle(v: unknown): v is FloorStyle {
  return typeof v === "string" && (FLOOR_STYLES as readonly string[]).includes(v);
}

/**
 * Legacy aamf used `"checker"` to mean “use the surface’s default pattern”.
 * Rewrite once to `"surface"` so `"checker"` can mean an explicit checkerboard.
 */
export function migrateLegacyFloorStyle(style: FloorStyle): FloorStyle {
  return style === "checker" ? "surface" : style;
}

export function migrateLegacyMapFloorStyles(
  def: ArenaMapDefinition,
): ArenaMapDefinition {
  if (def.floor.style !== "checker") return def;
  return {
    ...def,
    floor: { ...def.floor, style: "surface" },
  };
}

export interface MapFloor {
  /** Side length in meters (typically 12–40). */
  size: number;
  style: FloorStyle;
  /** Pattern subdivision count. */
  cells?: number;
  color: string;
  /** Ground look preset (grass, dirt, concrete, …). */
  surface?: FloorSurfaceId;
}

export interface MapSpawnPoint {
  id: string;
  position: [number, number, number];
  rotationY: number;
}

/** Agent Arena Map Format (aamf) v1 — shareable JSON map definition. */
export interface ArenaMapDefinition {
  version: 1;
  id: string;
  name: string;
  description?: string;
  /** True for shipped system maps; never overwritten in localStorage. */
  builtin?: boolean;
  floor: MapFloor;
  theme: MapTheme;
  spawnPoints: MapSpawnPoint[];
  placeables: PlaceableInstance[];
  /** Soft atmosphere / platform regions. */
  zones?: MapZone[];
  /** Extra practical point lights authored in the map. */
  lights?: MapLightPoint[];
  /**
   * When set, overrides indoor/outdoor room-fill heuristic.
   * Outdoor maps usually omit floating office point lights.
   */
  roomLights?: boolean;
}

export const AAMF_VERSION = 1 as const;

export const FLOOR_SIZE_MIN = 10;
export const FLOOR_SIZE_MAX = 48;

export function clampFloorSize(n: number): number {
  return Math.min(FLOOR_SIZE_MAX, Math.max(FLOOR_SIZE_MIN, Math.round(n * 10) / 10));
}

export function isArenaMapDefinition(v: unknown): v is ArenaMapDefinition {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  if (m.version !== 1) return false;
  if (typeof m.id !== "string" || typeof m.name !== "string") return false;
  if (!m.floor || typeof m.floor !== "object") return false;
  const floor = m.floor as Record<string, unknown>;
  if (typeof floor.size !== "number") return false;
  if (!isFloorStyle(floor.style)) return false;
  if (typeof floor.color !== "string") return false;
  if (floor.surface != null && !isFloorSurfaceId(floor.surface)) return false;
  if (!m.theme || typeof m.theme !== "object") return false;
  if (!Array.isArray(m.spawnPoints) || !Array.isArray(m.placeables)) return false;
  if (m.zones != null && (!Array.isArray(m.zones) || !m.zones.every(isMapZone))) {
    return false;
  }
  if (
    m.lights != null &&
    (!Array.isArray(m.lights) || !m.lights.every(isMapLightPoint))
  ) {
    return false;
  }
  if (m.roomLights != null && typeof m.roomLights !== "boolean") return false;
  return true;
}

export function blankMap(partial?: Partial<ArenaMapDefinition>): ArenaMapDefinition {
  const surface = partial?.floor?.surface ?? "office";
  const surfaceFloor = applyFloorSurface(partial?.floor?.size ?? 18, surface);
  return {
    version: 1,
    id: partial?.id ?? `custom_${Date.now().toString(36)}`,
    name: partial?.name ?? "Untitled map",
    description: partial?.description ?? "",
    builtin: false,
    floor: {
      ...surfaceFloor,
      ...partial?.floor,
      surface: partial?.floor?.surface ?? surface,
    },
    theme: {
      floor: surfaceFloor.color,
      accent: "#4A7566",
      background: "#E4DDD2",
      fog: "#E4DDD2",
      ambient: "#ffffff",
      hemiSky: "#f5f0e6",
      hemiGround: "#c4b8a4",
      sun: "#fff5e6",
      ...partial?.theme,
    },
    spawnPoints: partial?.spawnPoints ?? [
      { id: "spawn_0", position: [0, 0, 2], rotationY: Math.PI },
    ],
    placeables: partial?.placeables ?? [],
    zones: partial?.zones ? structuredClone(partial.zones) : undefined,
    lights: partial?.lights ? structuredClone(partial.lights) : undefined,
    roomLights: partial?.roomLights,
  };
}

const LEGACY_PLACEABLE_IDS: Record<string, string> = {
  mars_boulder: "space_boulder",
  mars_rock: "space_rock",
};

export function migratePlaceableId(id: string): string {
  return LEGACY_PLACEABLE_IDS[id] ?? id;
}

function migratePlaceables(placeables: PlaceableInstance[]): PlaceableInstance[] {
  return placeables.map((p) => {
    const next = migratePlaceableId(p.placeableId);
    return next === p.placeableId ? p : { ...p, placeableId: next };
  });
}

export function cloneMap(
  def: ArenaMapDefinition,
  overrides?: Partial<ArenaMapDefinition>,
): ArenaMapDefinition {
  const placeables = overrides?.placeables
    ? structuredClone(overrides.placeables)
    : structuredClone(def.placeables);
  return {
    ...structuredClone(def),
    ...overrides,
    floor: { ...def.floor, ...overrides?.floor },
    theme: { ...def.theme, ...overrides?.theme },
    spawnPoints: overrides?.spawnPoints
      ? structuredClone(overrides.spawnPoints)
      : structuredClone(def.spawnPoints),
    placeables: migratePlaceables(placeables),
    zones: overrides?.zones
      ? structuredClone(overrides.zones)
      : def.zones
        ? structuredClone(def.zones)
        : undefined,
    lights: overrides?.lights
      ? structuredClone(overrides.lights)
      : def.lights
        ? structuredClone(def.lights)
        : undefined,
    roomLights: overrides?.roomLights ?? def.roomLights,
  };
}
