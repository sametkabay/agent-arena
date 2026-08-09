import { cloneMap, blankMap, type ArenaMapDefinition } from "@/lib/maps/schema";
import { getBuiltinMap } from "@/lib/maps/runtime";

export type MapPresetId =
  | "starter_camp"
  | "factory_yard"
  | "mars_outpost"
  | "office_lounge"
  | "blank_concrete";

export interface MapPresetMeta {
  id: MapPresetId;
  nameKey: string;
  descriptionKey: string;
  sourceBuiltin?: string;
}

export const MAP_PRESETS: MapPresetMeta[] = [
  {
    id: "starter_camp",
    nameKey: "settings.map.presets.starter_camp.name",
    descriptionKey: "settings.map.presets.starter_camp.description",
    sourceBuiltin: "nature",
  },
  {
    id: "factory_yard",
    nameKey: "settings.map.presets.factory_yard.name",
    descriptionKey: "settings.map.presets.factory_yard.description",
    sourceBuiltin: "factory",
  },
  {
    id: "mars_outpost",
    nameKey: "settings.map.presets.mars_outpost.name",
    descriptionKey: "settings.map.presets.mars_outpost.description",
    sourceBuiltin: "mars",
  },
  {
    id: "office_lounge",
    nameKey: "settings.map.presets.office_lounge.name",
    descriptionKey: "settings.map.presets.office_lounge.description",
    sourceBuiltin: "office",
  },
  {
    id: "blank_concrete",
    nameKey: "settings.map.presets.blank_concrete.name",
    descriptionKey: "settings.map.presets.blank_concrete.description",
  },
];

/** Spawn a custom map from a gallery preset (always a new custom_* id). */
export function createMapFromPreset(presetId: MapPresetId): ArenaMapDefinition {
  const id = `custom_${Math.random().toString(36).slice(2, 10)}`;
  const meta = MAP_PRESETS.find((p) => p.id === presetId);

  if (presetId === "blank_concrete") {
    return blankMap({
      id,
      name: "Concrete pad",
      description: "Clean concrete slab — ready to dress up",
      builtin: false,
      ambience: "factory",
      roomLights: true,
      floor: {
        size: 20,
        style: "surface",
        cells: 20,
        color: "#A8A9AB",
        surface: "concrete",
      },
      theme: {
        floor: "#A8A9AB",
        accent: "#6A7A8A",
        background: "#D0D2D6",
        fog: "#D0D2D6",
        ambient: "#ffffff",
        hemiSky: "#e8eaee",
        hemiGround: "#9a9ca0",
        sun: "#fff4e8",
      },
      zones: [
        {
          id: "zone_pad",
          name: "Pad",
          kind: "yard",
          center: [0, 0, 0],
          radius: 6,
        },
      ],
      lights: [
        {
          id: "light_center",
          position: [0, 4.2, 0],
          color: "#ffe8cc",
          intensity: 0.55,
          distance: 16,
        },
      ],
    });
  }

  const sourceId = meta?.sourceBuiltin ?? "office";
  const source = getBuiltinMap(sourceId);
  if (!source) {
    return blankMap({ id, name: "Preset map", builtin: false });
  }

  const names: Record<MapPresetId, string> = {
    starter_camp: "Starter camp",
    factory_yard: "Factory yard",
    mars_outpost: "Mars outpost",
    office_lounge: "Office lounge",
    blank_concrete: "Concrete pad",
  };

  return cloneMap(source, {
    id,
    name: names[presetId],
    builtin: false,
    description: source.description,
  });
}
