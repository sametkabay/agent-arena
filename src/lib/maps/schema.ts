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
import { appConfig } from "@/lib/config";

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

export type MapInteractionKind = "table_chat" | "bar_chat" | "open_mic";

export interface MapInteractionSeat {
  id: string;
  position: [number, number, number];
  rotationY: number;
}

/** A named social activity with reservable positions for agents. */
export interface MapInteractionSpot {
  id: string;
  name: string;
  kind: MapInteractionKind;
  /** Marker / conversation center. */
  position: [number, number, number];
  seats: MapInteractionSeat[];
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
  /** Runtime social activities such as tables, booths, bars, and stages. */
  interactionSpots?: MapInteractionSpot[];
  /**
   * When set, overrides indoor/outdoor room-fill heuristic.
   * Outdoor maps usually omit floating office point lights.
   */
  roomLights?: boolean;
}

const INTERACTION_KINDS: readonly MapInteractionKind[] = [
  "table_chat",
  "bar_chat",
  "open_mic",
];

function isVec3(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

export function isMapInteractionSpot(v: unknown): v is MapInteractionSpot {
  if (!v || typeof v !== "object") return false;
  const spot = v as Record<string, unknown>;
  if (typeof spot.id !== "string" || typeof spot.name !== "string") return false;
  if (
    typeof spot.kind !== "string" ||
    !(INTERACTION_KINDS as readonly string[]).includes(spot.kind)
  ) {
    return false;
  }
  if (!isVec3(spot.position) || !Array.isArray(spot.seats) || spot.seats.length === 0) {
    return false;
  }
  return spot.seats.every((value) => {
    if (!value || typeof value !== "object") return false;
    const seat = value as Record<string, unknown>;
    return (
      typeof seat.id === "string" &&
      isVec3(seat.position) &&
      typeof seat.rotationY === "number" &&
      Number.isFinite(seat.rotationY)
    );
  });
}

export const AAMF_VERSION = 1 as const;

export const FLOOR_SIZE_MIN = appConfig.maps.floorSizeMin;
export const FLOOR_SIZE_MAX = appConfig.maps.floorSizeMax;

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
  if (
    m.interactionSpots != null &&
    (!Array.isArray(m.interactionSpots) ||
      !m.interactionSpots.every(isMapInteractionSpot))
  ) {
    return false;
  }
  if (m.roomLights != null && typeof m.roomLights !== "boolean") return false;
  return true;
}

export function blankMap(partial?: Partial<ArenaMapDefinition>): ArenaMapDefinition {
  const surface = partial?.floor?.surface ?? appConfig.maps.defaultBlankSurface;
  const surfaceFloor = applyFloorSurface(
    partial?.floor?.size ?? appConfig.maps.defaultBlankSize,
    surface,
  );
  return {
    version: 1,
    id: partial?.id ?? `custom_${Date.now().toString(36)}`,
    name: partial?.name ?? appConfig.maps.defaultBlankName,
    description: partial?.description ?? "",
    builtin: false,
    floor: {
      ...surfaceFloor,
      ...partial?.floor,
      surface: partial?.floor?.surface ?? surface,
    },
    theme: {
      floor: surfaceFloor.color,
      ...appConfig.maps.defaultTheme,
      ...partial?.theme,
    },
    spawnPoints: partial?.spawnPoints ?? [appConfig.maps.defaultSpawn],
    placeables: partial?.placeables ?? [],
    zones: partial?.zones ? structuredClone(partial.zones) : undefined,
    lights: partial?.lights ? structuredClone(partial.lights) : undefined,
    interactionSpots: partial?.interactionSpots
      ? structuredClone(partial.interactionSpots)
      : undefined,
    roomLights: partial?.roomLights,
  };
}

const LEGACY_PLACEABLE_IDS: Record<string, string> = {
  mars_boulder: "space_boulder",
  mars_rock: "space_rock",
  food__cooking_pot_lmedeomg9l: "food__cooking_pot",
  lounge_chair: "furniture__lounge_chair_pimrvmqw1o",
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
    interactionSpots: overrides?.interactionSpots
      ? structuredClone(overrides.interactionSpots)
      : def.interactionSpots
        ? structuredClone(def.interactionSpots)
        : undefined,
    roomLights: overrides?.roomLights ?? def.roomLights,
  };
}
