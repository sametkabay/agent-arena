import type { FloorSurfaceId } from "@/lib/maps/floorSurfaces";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { appConfig } from "@/lib/config";

/** Soft region for atmosphere / future FX triggers (aamf optional). */
export type MapZoneKind = "camp" | "yard" | "indoor" | "path" | "platform" | "custom";

export const MAP_ZONE_KINDS: readonly MapZoneKind[] = [
  "camp",
  "yard",
  "indoor",
  "path",
  "platform",
  "custom",
] as const;

export interface MapZone {
  id: string;
  name: string;
  kind: MapZoneKind;
  /** Center on the floor plane. */
  center: [number, number, number];
  /**
   * Horizontal radius in meters.
   * Always written (for circle zones this is the radius; for rectangles it is
   * kept as `max(width, depth) / 2` so older readers stay compatible).
   */
  radius: number;
  /**
   * Optional axis-aligned size `[width, depth]` in meters.
   * When present the zone is a rectangle centered on `center` (no rotation).
   * When absent the zone is a circle of `radius`.
   */
  size?: [number, number];
  /** Optional platform height (props may sit on this Y). */
  height?: number;
}

/** Explicit practical light authored in the map (beyond lamp/campfire FX). */
export interface MapLightPoint {
  id: string;
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}

const regions = appConfig.maps.regions;

export const MAX_ZONES = regions.maxZones;
export const MAX_LIGHTS = regions.maxLights;
export const ZONE_NAME_MAX = regions.zoneNameMax;
export const ZONE_RADIUS_MIN = regions.zoneRadiusMin;
export const ZONE_RADIUS_DEFAULT = regions.zoneRadiusDefault;
export const ZONE_SIZE_MIN = regions.zoneSizeMin;
export const ZONE_SIZE_DEFAULT = regions.zoneSizeDefault;
export const LIGHT_INTENSITY_MIN = regions.lightIntensityMin;
export const LIGHT_INTENSITY_MAX = regions.lightIntensityMax;
export const LIGHT_INTENSITY_STEP = regions.lightIntensityStep;
export const LIGHT_INTENSITY_DEFAULT = regions.lightIntensityDefault;
export const LIGHT_DISTANCE_MIN = regions.lightDistanceMin;
export const LIGHT_DISTANCE_MAX = regions.lightDistanceMax;
export const LIGHT_DISTANCE_DEFAULT = regions.lightDistanceDefault;
export const LIGHT_HEIGHT_MIN = regions.lightHeightMin;
export const LIGHT_HEIGHT_MAX = regions.lightHeightMax;
export const LIGHT_HEIGHT_DEFAULT = regions.lightHeightDefault;
export const LIGHT_COLOR_DEFAULT = regions.lightColorDefault;

export function isRectZone(
  z: MapZone,
): z is MapZone & { size: [number, number] } {
  return Array.isArray(z.size) && z.size.length === 2;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Type guard for map zones.
 *
 * - Circles (no `size`): `radius` must be a finite number **> 0**.
 * - Rectangles (`size: [width, depth]`): both sides must be finite and > 0.
 *   If `radius` is missing, it is derived as `max(width, depth) / 2` so
 *   hand-authored imports with only `size` still validate (mutates the object).
 *   If `radius` is present it must be finite (any sign is rewritten on edit).
 */
export function isMapZone(v: unknown): v is MapZone {
  if (!v || typeof v !== "object") return false;
  const z = v as Record<string, unknown>;
  if (
    typeof z.id !== "string" ||
    typeof z.name !== "string" ||
    typeof z.kind !== "string" ||
    !Array.isArray(z.center) ||
    z.center.length !== 3
  ) {
    return false;
  }

  if (z.size != null) {
    if (
      !Array.isArray(z.size) ||
      z.size.length !== 2 ||
      !isPositiveFinite(z.size[0]) ||
      !isPositiveFinite(z.size[1])
    ) {
      return false;
    }
    // Derive compatibility radius when omitted (size-only authored JSON).
    if (typeof z.radius !== "number" || !Number.isFinite(z.radius)) {
      const w = z.size[0] as number;
      const d = z.size[1] as number;
      (z as { radius: number }).radius = Math.max(w, d) / 2;
    }
    return true;
  }

  // Circle: radius required and strictly positive (negatives break SVG / ringGeometry).
  return typeof z.radius === "number" && Number.isFinite(z.radius) && z.radius > 0;
}

export function isMapLightPoint(v: unknown): v is MapLightPoint {
  if (!v || typeof v !== "object") return false;
  const L = v as Record<string, unknown>;
  return (
    typeof L.id === "string" &&
    Array.isArray(L.position) &&
    L.position.length === 3 &&
    typeof L.color === "string" &&
    typeof L.intensity === "number" &&
    typeof L.distance === "number"
  );
}

/** Indoor surfaces get floating room fill lights; outdoor maps rely on practicals. */
export function surfaceWantsRoomLights(surface: FloorSurfaceId | undefined): boolean {
  if (!surface) return false;
  return appConfig.maps.indoorSurfaces.includes(surface);
}

export function mapWantsRoomLights(def: ArenaMapDefinition): boolean {
  if (typeof def.roomLights === "boolean") return def.roomLights;
  return surfaceWantsRoomLights(def.floor.surface);
}
