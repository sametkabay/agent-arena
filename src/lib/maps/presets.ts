import raw from "@data/map-presets.yaml";
import { cloneMap, blankMap, type ArenaMapDefinition } from "@/lib/maps/schema";
import { getBuiltinMap } from "@/lib/maps/runtime";
import { appConfig } from "@/lib/config";

export type MapPresetId = string;

export interface MapPresetMeta {
  id: MapPresetId;
  nameKey: string;
  descriptionKey: string;
  sourceBuiltin?: string;
  name: string;
  map?: Partial<ArenaMapDefinition>;
}

interface MapPresetsYaml {
  presets: MapPresetMeta[];
}

export const MAP_PRESETS: MapPresetMeta[] = (raw as MapPresetsYaml).presets;

/** Spawn a custom map from a gallery preset (always a new custom_* id). */
export function createMapFromPreset(presetId: MapPresetId): ArenaMapDefinition {
  const id = `custom_${Math.random().toString(36).slice(2, 10)}`;
  const meta = MAP_PRESETS.find((p) => p.id === presetId);

  if (meta?.map) {
    return blankMap({
      id,
      name: meta.name,
      builtin: false,
      ...meta.map,
    });
  }

  const sourceId = meta?.sourceBuiltin ?? appConfig.defaults.mapId;
  const source = getBuiltinMap(sourceId);
  if (!source) {
    return blankMap({
      id,
      name: meta?.name ?? appConfig.maps.defaultBlankName,
      builtin: false,
    });
  }

  return cloneMap(source, {
    id,
    name: meta?.name ?? source.name,
    builtin: false,
    description: source.description,
  });
}
