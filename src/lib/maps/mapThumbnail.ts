import {
  PLACEABLE_SPECS,
  type AssetCategory,
  type PlaceableId,
} from "@/lib/assets/catalog";
import { FLOOR_SURFACES } from "@/lib/maps/floorSurfaces";
import type { ArenaMapDefinition } from "@/lib/maps/schema";

const MAX_PROPS = 200;

const CATEGORY_FILL: Record<AssetCategory, string> = {
  furniture: "#8B7355",
  nature: "#5a8f4a",
  space: "#6a7a9a",
  decor: "#b07a4a",
  ground: "#8a8070",
  camping: "#c4783a",
  vehicles: "#5a6a7a",
  animals: "#a06050",
  food: "#c07040",
};

const FALLBACK_PROP_FILL = "#888888";
const FALLBACK_FOOTPRINT: [number, number] = [0.6, 0.6];

export interface MapThumbnailFloor {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

export interface MapThumbnailZone {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

export interface MapThumbnailProp {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  fill: string;
}

export interface MapThumbnailModel {
  viewBox: string;
  background: string;
  floor: MapThumbnailFloor;
  zones: MapThumbnailZone[];
  props: MapThumbnailProp[];
}

/** Map world XZ (±size/2) into viewBox coordinates (0…size). */
export function worldToView(
  x: number,
  z: number,
  size: number,
): { x: number; y: number } {
  return { x: x + size / 2, y: z + size / 2 };
}

function propFill(placeableId: string): string {
  const spec = PLACEABLE_SPECS[placeableId as PlaceableId];
  if (!spec) return FALLBACK_PROP_FILL;
  return CATEGORY_FILL[spec.category] ?? FALLBACK_PROP_FILL;
}

function propFootprint(placeableId: string): [number, number] {
  const spec = PLACEABLE_SPECS[placeableId as PlaceableId];
  if (!spec) return FALLBACK_FOOTPRINT;
  return spec.footprint;
}

/**
 * Pure top-down SVG model for a map definition (no DOM / WebGL).
 * World XZ maps into a square viewBox of side `size` (floor meters).
 */
export function buildMapThumbnail(
  def: ArenaMapDefinition,
  size = 96,
): MapThumbnailModel {
  const floorSize = Math.max(1, def.floor.size || 1);
  const scale = size / floorSize;
  const surfaceId = def.floor.surface;
  const surfaceColor =
    (surfaceId && FLOOR_SURFACES[surfaceId]?.color) || def.floor.color;
  const accent = def.theme.accent || "#888888";

  const floor: MapThumbnailFloor = {
    x: 0,
    y: 0,
    w: size,
    h: size,
    fill: surfaceColor,
  };

  const zones: MapThumbnailZone[] = (def.zones ?? []).map((z) => {
    const { x: cx, y: cy } = worldToView(z.center[0], z.center[2], floorSize);
    return {
      cx: cx * scale,
      cy: cy * scale,
      r: Math.max(0, z.radius) * scale,
      fill: accent,
    };
  });

  const props: MapThumbnailProp[] = [];
  for (const p of def.placeables.slice(0, MAX_PROPS)) {
    const [fw, fd] = propFootprint(p.placeableId);
    const s = p.scale ?? 1;
    const w = Math.max(0.05, fw * s) * scale;
    const h = Math.max(0.05, fd * s) * scale;
    const { x: cx, y: cy } = worldToView(
      p.position[0],
      p.position[2],
      floorSize,
    );
    props.push({
      x: cx * scale - w / 2,
      y: cy * scale - h / 2,
      w,
      h,
      rotate: -(p.rotationY * 180) / Math.PI,
      fill: propFill(p.placeableId),
    });
  }

  return {
    viewBox: `0 0 ${size} ${size}`,
    background: def.theme.background || "#d0d0d0",
    floor,
    zones,
    props,
  };
}

/** Test helper — prop cap used by buildMapThumbnail. */
export const MAP_THUMBNAIL_PROP_CAP = MAX_PROPS;
