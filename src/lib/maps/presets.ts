import raw from "@data/map-presets.yaml";
import { normalizeAgentName, nextCopyName } from "@/lib/agentCopy";
import { cloneMap, blankMap, type ArenaMapDefinition } from "@/lib/maps/schema";
import { newCustomMapId } from "@/lib/maps/importCollision";
import { getBuiltinMap, listBuiltinMaps } from "@/lib/maps/runtime";
import { appConfig } from "@/lib/config";

export type MapPresetId = string;

export interface MapPresetMeta {
  id: MapPresetId;
  nameKey: string;
  descriptionKey: string;
  /** Optional YAML description used as i18n fallback (not the display name). */
  description?: string;
  sourceBuiltin?: string;
  name: string;
  map?: Partial<ArenaMapDefinition>;
}

export interface CreateMapFromPresetOptions {
  /** Localized display name (falls back to YAML `name`). */
  name?: string;
  /** Names that must stay unique (custom + builtin). */
  takenNames?: readonly string[];
  /** Localized copy suffix label (e.g. "copy"). */
  copyLabel?: string;
  /** Existing custom map ids — regenerate on collision. */
  existingIds?: readonly string[];
}

interface MapPresetsYaml {
  presets: MapPresetMeta[];
}

export const MAP_PRESETS: MapPresetMeta[] = (raw as MapPresetsYaml).presets;

function uniquePresetName(
  baseName: string,
  takenNames: readonly string[],
  copyLabel: string,
): string {
  const base = baseName.trim() || appConfig.maps.defaultCustomName;
  const taken = new Set(takenNames.map(normalizeAgentName));
  if (!taken.has(normalizeAgentName(base))) return base;
  return nextCopyName(base, takenNames, copyLabel);
}

/**
 * Build a map definition from preset meta without assigning a custom id.
 * Used for gallery thumbnails / previews.
 */
export function resolvePresetDefinition(
  meta: MapPresetMeta,
): ArenaMapDefinition {
  const previewId = `preset_${meta.id}`;

  if (meta.map) {
    return blankMap({
      id: previewId,
      name: meta.name,
      builtin: false,
      ...meta.map,
    });
  }

  const sourceId = meta.sourceBuiltin ?? appConfig.defaults.mapId;
  const source = getBuiltinMap(sourceId);
  if (!source) {
    return blankMap({
      id: previewId,
      name: meta.name || appConfig.maps.defaultBlankName,
      builtin: false,
    });
  }

  return cloneMap(source, {
    id: previewId,
    name: meta.name || source.name,
    builtin: false,
    description: source.description,
  });
}

/** Spawn a custom map from a gallery preset (always a new custom_* id). */
export function createMapFromPreset(
  presetId: MapPresetId,
  opts?: CreateMapFromPresetOptions,
): ArenaMapDefinition {
  const meta = MAP_PRESETS.find((p) => p.id === presetId);
  const copyLabel = opts?.copyLabel?.trim() || "copy";
  const takenNames = opts?.takenNames ?? [];

  const baseName =
    opts?.name?.trim() ||
    meta?.name ||
    appConfig.maps.defaultCustomName;
  const name = uniquePresetName(baseName, takenNames, copyLabel);

  const existingIds = new Set(opts?.existingIds ?? []);
  let id: string;
  do {
    id = newCustomMapId();
  } while (existingIds.has(id));

  const base = resolvePresetDefinition(
    meta ?? {
      id: presetId || "fallback",
      nameKey: "",
      descriptionKey: "",
      name: "",
    },
  );
  return { ...base, id, name, builtin: false };
}

/** Builtin + custom display names for uniqueness when creating from a preset. */
export function presetTakenNames(
  customMaps: readonly ArenaMapDefinition[],
): string[] {
  return [
    ...customMaps.map((m) => m.name),
    ...listBuiltinMaps().map((m) => m.name),
  ];
}
