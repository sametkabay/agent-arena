import raw from "@data/roles.yaml";
import { appConfig } from "@/lib/config";
import type { PlaceableId } from "@/lib/assets/catalog";

export interface PolyPreset {
  id: string;
  nameKey: string;
  blurbKey: string;
  /** Visual tint for the procedural character body */
  defaultColor: string;
  defaultSystemPrompt: string;
  defaultDisplayName: string;
  /** Short identity blurb other agents read. */
  defaultBio?: string;
  /** Optional body silhouette variant */
  body: "round" | "tall" | "compact";
}

interface RolesYaml {
  custom: PolyPreset;
  roles: PolyPreset[];
}

function tidyBio(bio?: string): string | undefined {
  const text = bio?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

function withTidiedBio(preset: PolyPreset): PolyPreset {
  return { ...preset, defaultBio: tidyBio(preset.defaultBio) };
}

const yaml = raw as RolesYaml;

export const CUSTOM_PRESET: PolyPreset = withTidiedBio(yaml.custom);
export const POLY_PRESETS: PolyPreset[] = yaml.roles.map(withTidiedBio);
export const ALL_POLY_PRESETS: PolyPreset[] = [CUSTOM_PRESET, ...POLY_PRESETS];

export function getPolyPreset(id: string): PolyPreset {
  if (id === CUSTOM_PRESET.id) return CUSTOM_PRESET;
  return (
    POLY_PRESETS.find((p) => p.id === id) ??
    POLY_PRESETS.find((p) => p.id === appConfig.defaults.roleId) ??
    POLY_PRESETS[0] ??
    CUSTOM_PRESET
  );
}

export function isCustomPreset(id: string): boolean {
  return id === CUSTOM_PRESET.id;
}

export type { PlaceableId };
