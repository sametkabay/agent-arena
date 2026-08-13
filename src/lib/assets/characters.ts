import raw from "@data/characters.yaml";
import { appConfig } from "@/lib/config";

const ASSET_BASE = import.meta.env.BASE_URL;

export interface CharacterSpec {
  id: string;
  nameKey: string;
  file: string;
  glb: string;
  /** Fitted standing height in meters (map units). */
  targetHeight: number;
  /** XZ collider / selection footprint in meters. */
  footprint: [number, number];
  /** Circle radius used for picking + floor clearance. */
  radius: number;
  /** Model forward axis in bind pose. */
  faces: "posZ" | "negZ";
  /** Head bone scale vs authored cube-head (1 = unchanged). */
  headScale?: number;
  walkClipHints: string[];
  idleClipHints: string[];
  sprintClipHints?: string[];
  /** Short identity blurb other agents read. */
  defaultBio?: string;
}

interface CharacterYamlEntry {
  id: string;
  nameKey: string;
  file: string;
  inherit?: string;
  targetHeight?: number;
  footprint?: [number, number];
  radius?: number;
  faces?: "posZ" | "negZ";
  headScale?: number;
  walkClipHints?: string[];
  idleClipHints?: string[];
  sprintClipHints?: string[];
  defaultBio?: string;
}

interface CharactersYaml {
  defaultId: string;
  human: Omit<CharacterSpec, "id" | "nameKey" | "file" | "glb">;
  characters: CharacterYamlEntry[];
}

function characterUrl(file: string): string {
  return `${ASSET_BASE}assets/characters/${encodeURIComponent(file)}`;
}

const yaml = raw as CharactersYaml;

function resolveCharacter(entry: CharacterYamlEntry): CharacterSpec {
  const base =
    entry.inherit === "human"
      ? yaml.human
      : {
          targetHeight: 1.6,
          footprint: [0.48, 0.4] as [number, number],
          radius: 0.26,
          faces: "posZ" as const,
          walkClipHints: ["Walk"],
          idleClipHints: ["Idle"],
        };
  return {
    id: entry.id,
    nameKey: entry.nameKey,
    file: entry.file,
    glb: characterUrl(entry.file),
    targetHeight: entry.targetHeight ?? base.targetHeight,
    footprint: entry.footprint ?? base.footprint,
    radius: entry.radius ?? base.radius,
    faces: entry.faces ?? base.faces,
    headScale: entry.headScale ?? base.headScale,
    walkClipHints: entry.walkClipHints ?? base.walkClipHints,
    idleClipHints: entry.idleClipHints ?? base.idleClipHints,
    sprintClipHints: entry.sprintClipHints ?? base.sprintClipHints,
    defaultBio: entry.defaultBio?.replace(/\s+/g, " ").trim() || undefined,
  };
}

const CHARACTERS: CharacterSpec[] = yaml.characters.map(resolveCharacter);

const BY_ID: Record<string, CharacterSpec> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export const DEFAULT_CHARACTER_ID =
  yaml.defaultId || appConfig.defaults.characterId;

export const ALL_CHARACTERS: CharacterSpec[] = CHARACTERS;

export function isCharacterId(id: string | undefined | null): boolean {
  return typeof id === "string" && id in BY_ID;
}

export function getCharacter(id: string | undefined | null): CharacterSpec {
  if (id && BY_ID[id]) return BY_ID[id];
  return BY_ID[DEFAULT_CHARACTER_ID] ?? CHARACTERS[0];
}

export function characterYawOffset(spec: CharacterSpec): number {
  return spec.faces === "negZ" ? Math.PI : 0;
}
