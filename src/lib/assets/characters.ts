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
}

function characterUrl(file: string): string {
  return `${ASSET_BASE}assets/characters/${encodeURIComponent(file)}`;
}

const WALK = ["Walk"];
const IDLE = ["Idle"];
const SPRINT = ["Sprint"];

/** Neutral human that fits office / nature / space furniture scale. */
export const DEFAULT_CHARACTER_ID = "generic-male";

const HUMAN: Pick<
  CharacterSpec,
  | "targetHeight"
  | "footprint"
  | "radius"
  | "faces"
  | "walkClipHints"
  | "idleClipHints"
  | "sprintClipHints"
  | "headScale"
> = {
  // Desks ~1.05m, chairs ~0.95m. Fit the authored silhouette first (keeps
  // the original body scale), then shrink the cube-head a notch.
  targetHeight: 1.62,
  footprint: [0.48, 0.4],
  radius: 0.26,
  faces: "posZ",
  walkClipHints: WALK,
  idleClipHints: IDLE,
  sprintClipHints: SPRINT,
  headScale: 0.62,
};

const CHARACTERS: CharacterSpec[] = [
  {
    id: "generic-male",
    nameKey: "characters.generic-male",
    file: "generic-male.glb",
    glb: characterUrl("generic-male.glb"),
    ...HUMAN,
  },
  {
    id: "generic-female",
    nameKey: "characters.generic-female",
    file: "generic-female.glb",
    glb: characterUrl("generic-female.glb"),
    ...HUMAN,
  },
  {
    id: "citizen-1",
    nameKey: "characters.citizen-1",
    file: "citizen-1.glb",
    glb: characterUrl("citizen-1.glb"),
    ...HUMAN,
  },
  {
    id: "citizen-2",
    nameKey: "characters.citizen-2",
    file: "citizen-2.glb",
    glb: characterUrl("citizen-2.glb"),
    ...HUMAN,
  },
  {
    id: "citizen-3",
    nameKey: "characters.citizen-3",
    file: "citizen-3.glb",
    glb: characterUrl("citizen-3.glb"),
    ...HUMAN,
  },
  {
    id: "retail-worker",
    nameKey: "characters.retail-worker",
    file: "retail-worker.glb",
    glb: characterUrl("retail-worker.glb"),
    ...HUMAN,
  },
  {
    id: "food-worker",
    nameKey: "characters.food-worker",
    file: "food-worker.glb",
    glb: characterUrl("food-worker.glb"),
    ...HUMAN,
    targetHeight: 1.68,
    headScale: 0.68,
  },
  {
    id: "male-officer",
    nameKey: "characters.male-officer",
    file: "male-officer.glb",
    glb: characterUrl("male-officer.glb"),
    ...HUMAN,
    targetHeight: 1.68,
    headScale: 0.68,
  },
  {
    id: "female-officer",
    nameKey: "characters.female-officer",
    file: "female-officer.glb",
    glb: characterUrl("female-officer.glb"),
    ...HUMAN,
    targetHeight: 1.68,
    headScale: 0.68,
  },
  {
    id: "crypto-bro",
    nameKey: "characters.crypto-bro",
    file: "crypto-bro.glb",
    glb: characterUrl("crypto-bro.glb"),
    ...HUMAN,
  },
  {
    id: "prisoner",
    nameKey: "characters.prisoner",
    file: "prisoner.glb",
    glb: characterUrl("prisoner.glb"),
    ...HUMAN,
  },
  {
    id: "chicken-guy",
    nameKey: "characters.chicken-guy",
    file: "chicken-guy.glb",
    glb: characterUrl("chicken-guy.glb"),
    ...HUMAN,
    targetHeight: 1.74,
    headScale: 0.7,
  },
  {
    id: "rubber-duck",
    nameKey: "characters.rubber-duck",
    file: "rubber-duck.glb",
    glb: characterUrl("rubber-duck.glb"),
    targetHeight: 0.52,
    footprint: [0.38, 0.42],
    radius: 0.22,
    faces: "posZ",
    walkClipHints: WALK,
    idleClipHints: IDLE,
  },
];

const BY_ID: Record<string, CharacterSpec> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export const ALL_CHARACTERS: CharacterSpec[] = CHARACTERS;

export function isCharacterId(id: string | undefined | null): boolean {
  return typeof id === "string" && id in BY_ID;
}

export function getCharacter(id: string | undefined | null): CharacterSpec {
  if (id && BY_ID[id]) return BY_ID[id];
  return BY_ID[DEFAULT_CHARACTER_ID];
}

export function characterYawOffset(spec: CharacterSpec): number {
  return spec.faces === "negZ" ? Math.PI : 0;
}
