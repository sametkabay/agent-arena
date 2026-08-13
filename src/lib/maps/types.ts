import type { ArenaMapDefinition, MapTheme } from "@/lib/maps/schema";
import { listBuiltinMaps, resolveMapDefinition } from "@/lib/maps/runtime";
import { appConfig } from "@/lib/config";

export type { MapTheme } from "@/lib/maps/schema";
export type ShadowQuality = "off" | "low" | "medium" | "high";

/** @deprecated Prefer string map ids (builtin + custom_*). */
export type MapId = string;

export interface MapMeta {
  id: string;
  name: string;
  description: string;
  available: boolean;
  builtin: boolean;
  theme: MapTheme;
}

export function mapsToMeta(
  customMaps: ArenaMapDefinition[] = [],
): MapMeta[] {
  const builtins = listBuiltinMaps().map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description ?? "",
    available: true,
    builtin: true,
    theme: m.theme,
  }));
  const customs = customMaps.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description ?? "",
    available: true,
    builtin: false,
    theme: m.theme,
  }));
  return [...builtins, ...customs];
}

/** Resolve display meta for any map id. */
export function getMap(
  id: string,
  customMaps: ArenaMapDefinition[] = [],
): MapMeta {
  const def = resolveMapDefinition(id, customMaps);
  return {
    id: def.id,
    name: def.name,
    description: def.description ?? "",
    available: true,
    builtin: !!def.builtin,
    theme: def.theme,
  };
}

/** Legacy static list (builtins only) for callers that don't have custom maps yet. */
export const MAPS: MapMeta[] = mapsToMeta([]);

export function shadowMapSize(quality: ShadowQuality): number {
  return appConfig.graphics.shadowMapSizes[quality] ?? appConfig.graphics.shadowMapSizes.off;
}
