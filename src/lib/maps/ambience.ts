import type { FloorSurfaceId } from "@/lib/maps/floorSurfaces";
import type { ArenaMapDefinition } from "@/lib/maps/schema";

/** Procedural ambience profile — no external audio assets. */
export type AmbienceId = "office" | "nature" | "factory" | "mars" | "none";

export const AMBIENCE_IDS: readonly AmbienceId[] = [
  "office",
  "nature",
  "factory",
  "mars",
  "none",
] as const;

export function isAmbienceId(v: unknown): v is AmbienceId {
  return typeof v === "string" && (AMBIENCE_IDS as readonly string[]).includes(v);
}

/** Soft region for atmosphere / future FX triggers (aamf optional). */
export type MapZoneKind = "camp" | "yard" | "indoor" | "path" | "platform" | "custom";

export interface MapZone {
  id: string;
  name: string;
  kind: MapZoneKind;
  /** Center on the floor plane. */
  center: [number, number, number];
  /** Horizontal radius in meters. */
  radius: number;
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

export function isMapZone(v: unknown): v is MapZone {
  if (!v || typeof v !== "object") return false;
  const z = v as Record<string, unknown>;
  return (
    typeof z.id === "string" &&
    typeof z.name === "string" &&
    typeof z.kind === "string" &&
    Array.isArray(z.center) &&
    z.center.length === 3 &&
    typeof z.radius === "number"
  );
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
  return surface === "office" || surface === "concrete" || surface === "factory";
}

export function resolveAmbienceId(def: ArenaMapDefinition): AmbienceId {
  if (def.ambience && isAmbienceId(def.ambience)) return def.ambience;
  if (def.id === "office" || def.id === "nature" || def.id === "factory" || def.id === "mars") {
    return def.id;
  }
  const surface = def.floor.surface;
  if (surface === "grass") return "nature";
  if (surface === "dirt") return "mars";
  if (surface === "factory") return "factory";
  if (surface === "concrete") return "factory";
  if (surface === "office") return "office";
  return "none";
}

export function mapWantsRoomLights(def: ArenaMapDefinition): boolean {
  if (typeof def.roomLights === "boolean") return def.roomLights;
  return surfaceWantsRoomLights(def.floor.surface);
}
