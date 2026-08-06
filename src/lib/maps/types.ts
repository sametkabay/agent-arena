export type MapId = "office" | "nature" | "factory" | "mars";

export interface MapTheme {
  floor: string;
  accent: string;
  background: string;
  fog: string;
  ambient: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
}

export type ShadowQuality = "off" | "low" | "medium" | "high";

export interface MapMeta {
  id: MapId;
  nameKey: string;
  descriptionKey: string;
  available: boolean;
  theme: MapTheme;
}

export const MAPS: MapMeta[] = [
  {
    id: "office",
    nameKey: "maps.office.name",
    descriptionKey: "maps.office.description",
    available: true,
    theme: {
      floor: "#D2C9BB",
      accent: "#4A7566",
      background: "#E4DDD2",
      fog: "#E4DDD2",
      ambient: "#ffffff",
      hemiSky: "#f5f0e6",
      hemiGround: "#c4b8a4",
      sun: "#fff5e6",
    },
  },
  {
    id: "nature",
    nameKey: "maps.nature.name",
    descriptionKey: "maps.nature.description",
    available: false,
    theme: {
      floor: "#8FAE6E",
      accent: "#4A7566",
      background: "#DDE8D0",
      fog: "#DDE8D0",
      ambient: "#ffffff",
      hemiSky: "#e8f0e0",
      hemiGround: "#7a9460",
      sun: "#fff8e8",
    },
  },
  {
    id: "factory",
    nameKey: "maps.factory.name",
    descriptionKey: "maps.factory.description",
    available: false,
    theme: {
      floor: "#9A9A9A",
      accent: "#6A7A8A",
      background: "#C8CBD0",
      fog: "#C8CBD0",
      ambient: "#ffffff",
      hemiSky: "#e0e4e8",
      hemiGround: "#7a8088",
      sun: "#fff0e0",
    },
  },
  {
    id: "mars",
    nameKey: "maps.mars.name",
    descriptionKey: "maps.mars.description",
    available: false,
    theme: {
      floor: "#C07A5A",
      accent: "#A85A3A",
      background: "#E8C8B0",
      fog: "#E8C8B0",
      ambient: "#ffffff",
      hemiSky: "#f0d8c8",
      hemiGround: "#a06040",
      sun: "#ffe8d0",
    },
  },
];

export function getMap(id: MapId): MapMeta {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export function shadowMapSize(quality: ShadowQuality): number {
  switch (quality) {
    case "high":
      return 2048;
    case "medium":
      return 1024;
    case "low":
      return 512;
    default:
      return 256;
  }
}

export { DEFAULT_GRAPHICS } from "@/lib/storage";
