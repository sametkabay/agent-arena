import type { FloorSurfaceId } from "@/lib/maps/floorSurfaces";
import type { ArenaMapDefinition } from "@/lib/maps/schema";

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

export function mapWantsRoomLights(def: ArenaMapDefinition): boolean {
  if (typeof def.roomLights === "boolean") return def.roomLights;
  return surfaceWantsRoomLights(def.floor.surface);
}
