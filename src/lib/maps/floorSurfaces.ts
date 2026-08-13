import raw from "@data/floor-surfaces.yaml";
import { appConfig } from "@/lib/config";
import type { FloorStyle } from "@/lib/maps/schema";

/** Built-in ground looks — procedural colors/patterns (no textures required). */
export type FloorSurfaceId = string;

export type FloorPattern = "solid" | "checker" | "patches" | "slabs";

export interface FloorSurfaceSpec {
  id: FloorSurfaceId;
  /** Default base color when applying this surface. */
  color: string;
  /** Secondary tint for pattern contrast. */
  alt: string;
  /** Edge / underlay. */
  border: string;
  pattern: FloorPattern;
  /** Target tile edge length in meters — grid count scales with floor size. */
  tileMeters: number;
  roughness: number;
  /** Slight metal for concrete/factory. */
  metalness: number;
  /** Default map floor.style when picking this surface. */
  style: FloorStyle;
}

interface FloorSurfacesYaml {
  surfaces: Record<
    string,
    Omit<FloorSurfaceSpec, "id">
  >;
}

const yaml = raw as FloorSurfacesYaml;

export const FLOOR_SURFACES: Record<FloorSurfaceId, FloorSurfaceSpec> =
  Object.fromEntries(
    Object.entries(yaml.surfaces).map(([id, spec]) => [id, { id, ...spec }]),
  );

export const FLOOR_SURFACE_IDS = Object.keys(FLOOR_SURFACES) as FloorSurfaceId[];

export function isFloorSurfaceId(v: unknown): v is FloorSurfaceId {
  return typeof v === "string" && v in FLOOR_SURFACES;
}

export function getFloorSurface(id: FloorSurfaceId | undefined): FloorSurfaceSpec {
  if (id && isFloorSurfaceId(id)) return FLOOR_SURFACES[id];
  const fallback =
    FLOOR_SURFACES[appConfig.maps.defaultBlankSurface] ??
    FLOOR_SURFACES[FLOOR_SURFACE_IDS[0]];
  return fallback;
}

/** Floor edge frame width in meters (each side, outside the playable grid). */
export const FLOOR_BORDER_METERS = appConfig.maps.floorBorderMeters;

/**
 * World Y of the floor’s top surface.
 * Slightly below 0 so rugs / flat props at y≈0 sit on top instead of z-fighting or sinking.
 */
export const FLOOR_TOP_Y = appConfig.maps.floorTopY;

/** Grid count: floor size N meters → N×N cells of 1×1 m. */
export function cellsForFloorSize(
  size: number,
  _surface?: FloorSurfaceId | undefined,
): number {
  return Math.max(1, Math.round(size));
}

/** Apply a surface preset onto floor fields (keeps size; cells follow size). */
export function applyFloorSurface(
  size: number,
  surface: FloorSurfaceId,
): {
  size: number;
  style: FloorStyle;
  cells: number;
  color: string;
  surface: FloorSurfaceId;
} {
  const spec = getFloorSurface(surface);
  return {
    size,
    style: spec.style,
    cells: cellsForFloorSize(size, surface),
    color: spec.color,
    surface: spec.id,
  };
}
