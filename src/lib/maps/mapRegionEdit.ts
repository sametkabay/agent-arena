import { clampToFloor } from "@/lib/maps/floorBounds";
import type { ArenaMapDefinition, MapSpawnPoint } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import {
  LIGHT_COLOR_DEFAULT,
  LIGHT_DISTANCE_DEFAULT,
  LIGHT_DISTANCE_MAX,
  LIGHT_DISTANCE_MIN,
  LIGHT_HEIGHT_DEFAULT,
  LIGHT_HEIGHT_MAX,
  LIGHT_HEIGHT_MIN,
  LIGHT_INTENSITY_DEFAULT,
  LIGHT_INTENSITY_MAX,
  LIGHT_INTENSITY_MIN,
  MAX_LIGHTS,
  MAX_ZONES,
  ZONE_NAME_MAX,
  ZONE_RADIUS_DEFAULT,
  ZONE_RADIUS_MIN,
  ZONE_SIZE_DEFAULT,
  ZONE_SIZE_MIN,
  isRectZone,
  type MapLightPoint,
  type MapZone,
  type MapZoneKind,
} from "@/lib/maps/mapRegions";

export type EditorTargetKind = "placeable" | "spawn" | "zone" | "light";

export {
  MAX_ZONES,
  MAX_LIGHTS,
  ZONE_NAME_MAX,
  ZONE_RADIUS_MIN,
  ZONE_RADIUS_DEFAULT,
  ZONE_SIZE_MIN,
  ZONE_SIZE_DEFAULT,
  LIGHT_INTENSITY_MIN,
  LIGHT_INTENSITY_MAX,
  LIGHT_INTENSITY_DEFAULT,
  LIGHT_DISTANCE_MIN,
  LIGHT_DISTANCE_MAX,
  LIGHT_DISTANCE_DEFAULT,
  LIGHT_HEIGHT_MIN,
  LIGHT_HEIGHT_MAX,
  LIGHT_HEIGHT_DEFAULT,
  LIGHT_COLOR_DEFAULT,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalize `#rgb` / `#rrggbb` (case-insensitive). Returns null if invalid. */
export function normalizeHex(raw: string): string | null {
  let h = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return `#${h.toUpperCase()}`;
}

/** Half-diagonal-ish compatibility radius for a rectangle (max side / 2). */
export function rectCompatRadius(width: number, depth: number): number {
  return Math.max(width, depth) / 2;
}

export function zoneRadiusMax(floorSize: number): number {
  return Math.max(ZONE_RADIUS_MIN, floorSize / 2);
}

export function zoneSizeMax(floorSize: number): number {
  return Math.max(ZONE_SIZE_MIN, floorSize);
}

export function sanitizeZoneName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, ZONE_NAME_MAX);
  return trimmed || fallback;
}

/**
 * Next unique "Zone 1", "Zone 2", … using `base` as the translated stem
 * (e.g. English "Zone"). Does not fill numbering gaps — uses max existing
 * index + 1 (or 1 when none match).
 */
export function nextZoneName(zones: MapZone[], base: string): string {
  const stem = base.trim() || "Zone";
  const re = new RegExp(`^${escapeRegExp(stem)}\\s+(\\d+)$`);
  let max = 0;
  for (const z of zones) {
    const m = z.name.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  const taken = new Set(zones.map((z) => z.name));
  while (taken.has(`${stem} ${n}`)) n += 1;
  return `${stem} ${n}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function floorHalf(floorSize: number): number {
  return floorSize / 2 - 0.05;
}

/** Clamp an axis-aligned rect so it stays inside the floor (may shrink size). */
function clampRectToFloor(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  floorSize: number,
): { center: [number, number, number]; size: [number, number] } {
  const half = floorHalf(floorSize);
  let w = clamp(width, ZONE_SIZE_MIN, zoneSizeMax(floorSize));
  let d = clamp(depth, ZONE_SIZE_MIN, zoneSizeMax(floorSize));
  // Shrink if the rect cannot fit at all
  w = Math.min(w, half * 2);
  d = Math.min(d, half * 2);
  const hw = w / 2;
  const hd = d / 2;
  const nx = clamp(cx, -half + hw, half - hw);
  const nz = clamp(cz, -half + hd, half - hd);
  return {
    center: [nx, 0, nz],
    size: [round2(w), round2(d)],
  };
}

/** Clamp a circle so center+radius stay inside the floor (may shrink radius). */
function clampCircleToFloor(
  cx: number,
  cz: number,
  radius: number,
  floorSize: number,
): { center: [number, number, number]; radius: number } {
  const half = floorHalf(floorSize);
  let r = clamp(radius, ZONE_RADIUS_MIN, zoneRadiusMax(floorSize));
  r = Math.min(r, half);
  const nx = clamp(cx, -half + r, half - r);
  const nz = clamp(cz, -half + r, half - r);
  return { center: [nx, 0, nz], radius: round2(r) };
}

export function createZone(
  id: string,
  pos: [number, number, number],
  def: ArenaMapDefinition,
  defaultName: string,
): MapZone {
  const floorSize = def.floor.size;
  const w = ZONE_SIZE_DEFAULT;
  const d = ZONE_SIZE_DEFAULT;
  const clamped = clampRectToFloor(pos[0], pos[2], w, d, floorSize);
  return {
    id,
    name: defaultName,
    kind: "custom",
    center: clamped.center,
    size: clamped.size,
    radius: rectCompatRadius(clamped.size[0], clamped.size[1]),
  };
}

export function createLight(
  id: string,
  pos: [number, number, number],
  def: ArenaMapDefinition,
): MapLightPoint {
  const [x, , z] = clampToFloor(pos[0], pos[2], def.floor.size);
  return {
    id,
    position: [x, LIGHT_HEIGHT_DEFAULT, z],
    color: LIGHT_COLOR_DEFAULT,
    intensity: LIGHT_INTENSITY_DEFAULT,
    distance: LIGHT_DISTANCE_DEFAULT,
  };
}

export type ZonePatch = Partial<{
  name: string;
  kind: MapZoneKind;
  center: [number, number, number];
  radius: number;
  size: [number, number];
  height: number;
}>;

/**
 * Clamp a single zone into the floor. Prefer this over `updateZone(z, {}, …)`
 * when only geometry fitting is needed (name/kind edits must not re-clamp).
 */
export function clampZoneToFloor(z: MapZone, floorSize: number): MapZone {
  if (isRectZone(z)) {
    const clamped = clampRectToFloor(
      z.center[0],
      z.center[2],
      z.size[0],
      z.size[1],
      floorSize,
    );
    return {
      ...z,
      center: [clamped.center[0], z.center[1], clamped.center[2]],
      size: clamped.size,
      radius: rectCompatRadius(clamped.size[0], clamped.size[1]),
    };
  }
  const clamped = clampCircleToFloor(
    z.center[0],
    z.center[2],
    z.radius,
    floorSize,
  );
  return {
    ...z,
    center: [clamped.center[0], z.center[1], clamped.center[2]],
    radius: clamped.radius,
  };
}

/** True when a patch touches geometry that must be re-clamped to the floor. */
function zonePatchTouchesGeometry(patch: ZonePatch): boolean {
  return patch.center != null || patch.size != null || patch.radius != null;
}

export function updateZone(
  z: MapZone,
  patch: ZonePatch,
  floorSize: number,
): MapZone {
  let next: MapZone = { ...z, ...patch };
  if (patch.center) {
    next.center = [patch.center[0], patch.center[1] ?? 0, patch.center[2]];
  }

  // Only re-clamp when geometry is in the patch. Name/kind-only edits must not
  // silently shift builtins that sit slightly past the clamp margin (Lounge).
  if (zonePatchTouchesGeometry(patch)) {
    if (isRectZone(next) || patch.size) {
      const size =
        patch.size ?? next.size ?? [ZONE_SIZE_DEFAULT, ZONE_SIZE_DEFAULT];
      const clamped = clampRectToFloor(
        next.center[0],
        next.center[2],
        size[0],
        size[1],
        floorSize,
      );
      next = {
        ...next,
        center: [clamped.center[0], next.center[1], clamped.center[2]],
        size: clamped.size,
        radius: rectCompatRadius(clamped.size[0], clamped.size[1]),
      };
    } else {
      const radius = patch.radius ?? next.radius;
      const clamped = clampCircleToFloor(
        next.center[0],
        next.center[2],
        radius,
        floorSize,
      );
      next = {
        ...next,
        center: [clamped.center[0], next.center[1], clamped.center[2]],
        radius: clamped.radius,
      };
    }
  }

  if (patch.height != null && Number.isFinite(patch.height)) {
    next.height = patch.height;
  }
  return next;
}

/** Structural equality for undo no-op detection (zones). */
export function zonesEqual(a: MapZone, b: MapZone): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.kind === b.kind &&
    a.center[0] === b.center[0] &&
    a.center[1] === b.center[1] &&
    a.center[2] === b.center[2] &&
    a.radius === b.radius &&
    a.height === b.height &&
    a.size?.[0] === b.size?.[0] &&
    a.size?.[1] === b.size?.[1]
  );
}

/** Structural equality for undo no-op detection (lights). */
export function lightsEqual(a: MapLightPoint, b: MapLightPoint): boolean {
  return (
    a.id === b.id &&
    a.color === b.color &&
    a.intensity === b.intensity &&
    a.distance === b.distance &&
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2]
  );
}

/** Convert a circle zone to a square rectangle (width = depth = 2 × radius). */
export function convertZoneToRect(z: MapZone, floorSize: number): MapZone {
  if (isRectZone(z)) return z;
  const side = Math.max(ZONE_SIZE_MIN, 2 * z.radius);
  return updateZone(z, { size: [side, side] }, floorSize);
}

export type LightPatch = Partial<{
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}>;

export function updateLight(
  L: MapLightPoint,
  patch: LightPatch,
  floorSize: number,
): MapLightPoint {
  let next: MapLightPoint = { ...L };

  if (patch.position) {
    const [x, , z] = clampToFloor(patch.position[0], patch.position[2], floorSize);
    const y = clamp(
      patch.position[1],
      LIGHT_HEIGHT_MIN,
      LIGHT_HEIGHT_MAX,
    );
    next.position = [x, y, z];
  }

  if (patch.intensity != null && Number.isFinite(patch.intensity)) {
    next.intensity = clamp(
      patch.intensity,
      LIGHT_INTENSITY_MIN,
      LIGHT_INTENSITY_MAX,
    );
  }
  if (patch.distance != null && Number.isFinite(patch.distance)) {
    next.distance = clamp(
      patch.distance,
      LIGHT_DISTANCE_MIN,
      LIGHT_DISTANCE_MAX,
    );
  }
  if (patch.color != null) {
    const hex = normalizeHex(patch.color);
    if (hex) next.color = hex;
  }
  return next;
}

export function moveTargets(
  def: ArenaMapDefinition,
  moves: { id: string; position: [number, number, number] }[],
): ArenaMapDefinition {
  if (moves.length === 0) return def;
  const byId = new Map(moves.map((m) => [m.id, m.position]));

  const placeables: PlaceableInstance[] = def.placeables.map((p) => {
    const pos = byId.get(p.id);
    if (!pos) return p;
    return {
      ...p,
      position: pos,
      ...(p.behavior === "wander"
        ? {
            homePosition: pos,
            target: undefined,
            locomotion: "idle" as const,
          }
        : {}),
    };
  });

  const spawnPoints: MapSpawnPoint[] = def.spawnPoints.map((s) => {
    const pos = byId.get(s.id);
    return pos ? { ...s, position: pos } : s;
  });

  const zones = (def.zones ?? []).map((z) => {
    const pos = byId.get(z.id);
    if (!pos) return z;
    return updateZone(
      z,
      { center: [pos[0], z.center[1], pos[2]] },
      def.floor.size,
    );
  });

  const lights = (def.lights ?? []).map((L) => {
    const pos = byId.get(L.id);
    if (!pos) return L;
    // Preserve Y (height) when dragging on the floor plane
    return updateLight(
      L,
      { position: [pos[0], L.position[1], pos[2]] },
      def.floor.size,
    );
  });

  return {
    ...def,
    placeables,
    spawnPoints,
    zones: def.zones != null ? zones : undefined,
    lights: def.lights != null ? lights : undefined,
  };
}

export function deleteTargets(
  def: ArenaMapDefinition,
  ids: string[],
): ArenaMapDefinition {
  if (ids.length === 0) return def;
  const idSet = new Set(ids);
  return {
    ...def,
    placeables: def.placeables.filter((p) => !idSet.has(p.id)),
    spawnPoints: def.spawnPoints.filter((s) => !idSet.has(s.id)),
    zones: (def.zones ?? []).filter((z) => !idSet.has(z.id)),
    lights: (def.lights ?? []).filter((L) => !idSet.has(L.id)),
  };
}

/** Clamp zones and lights into the current floor (spawn/placeables untouched). */
export function clampRegionsToFloor(def: ArenaMapDefinition): ArenaMapDefinition {
  const floorSize = def.floor.size;
  const zones = (def.zones ?? []).map((z) => clampZoneToFloor(z, floorSize));
  const lights = (def.lights ?? []).map((L) =>
    updateLight(
      L,
      {
        position: L.position,
        intensity: L.intensity,
        distance: L.distance,
        color: L.color,
      },
      floorSize,
    ),
  );
  return {
    ...def,
    zones: def.zones ? zones : undefined,
    lights: def.lights ? lights : undefined,
  };
}

export function targetKind(
  def: ArenaMapDefinition,
  id: string,
): EditorTargetKind | null {
  if (def.placeables.some((p) => p.id === id)) return "placeable";
  if (def.spawnPoints.some((s) => s.id === id)) return "spawn";
  if ((def.zones ?? []).some((z) => z.id === id)) return "zone";
  if ((def.lights ?? []).some((L) => L.id === id)) return "light";
  return null;
}

export function canAddZone(def: ArenaMapDefinition): boolean {
  return (def.zones?.length ?? 0) < MAX_ZONES;
}

export function canAddLight(def: ArenaMapDefinition): boolean {
  return (def.lights?.length ?? 0) < MAX_LIGHTS;
}
