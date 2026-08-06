import type { FloorStyle } from "@/lib/maps/schema";

/** Built-in ground looks — procedural colors/patterns (no textures required). */
export type FloorSurfaceId =
  | "office"
  | "grass"
  | "dirt"
  | "concrete"
  | "factory";

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

export const FLOOR_SURFACES: Record<FloorSurfaceId, FloorSurfaceSpec> = {
  office: {
    id: "office",
    color: "#D2C9BB",
    alt: "#C4B8A6",
    border: "#B5A894",
    pattern: "checker",
    tileMeters: 1,
    roughness: 0.92,
    metalness: 0.02,
    style: "surface",
  },
  grass: {
    id: "grass",
    color: "#6B9B4A",
    alt: "#5A8A3C",
    border: "#4A7034",
    pattern: "patches",
    tileMeters: 1,
    roughness: 0.98,
    metalness: 0,
    style: "surface",
  },
  dirt: {
    id: "dirt",
    color: "#8B6A4A",
    alt: "#7A5A3C",
    border: "#5C4030",
    pattern: "patches",
    tileMeters: 1,
    roughness: 1,
    metalness: 0,
    style: "surface",
  },
  concrete: {
    id: "concrete",
    color: "#A8A9AB",
    alt: "#96989A",
    border: "#7A7C80",
    pattern: "slabs",
    tileMeters: 1,
    roughness: 0.88,
    metalness: 0.06,
    style: "surface",
  },
  factory: {
    id: "factory",
    color: "#3A3D42",
    alt: "#2E3136",
    border: "#1E2024",
    pattern: "slabs",
    tileMeters: 1,
    roughness: 0.75,
    metalness: 0.18,
    style: "surface",
  },
};

export const FLOOR_SURFACE_IDS = Object.keys(FLOOR_SURFACES) as FloorSurfaceId[];

export function isFloorSurfaceId(v: unknown): v is FloorSurfaceId {
  return typeof v === "string" && v in FLOOR_SURFACES;
}

export function getFloorSurface(id: FloorSurfaceId | undefined): FloorSurfaceSpec {
  if (id && isFloorSurfaceId(id)) return FLOOR_SURFACES[id];
  return FLOOR_SURFACES.office;
}

/** Floor edge frame width in meters (each side, outside the playable grid). */
export const FLOOR_BORDER_METERS = 0.5;

/**
 * World Y of the floor’s top surface.
 * Slightly below 0 so rugs / flat props at y≈0 sit on top instead of z-fighting or sinking.
 */
export const FLOOR_TOP_Y = -0.01;

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
  const spec = FLOOR_SURFACES[surface];
  return {
    size,
    style: spec.style,
    cells: cellsForFloorSize(size, surface),
    color: spec.color,
    surface,
  };
}
