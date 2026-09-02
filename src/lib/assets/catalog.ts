import { PACK_GLB_INVENTORY } from "@/lib/assets/packInventory.generated";
import placeablesYaml from "@data/placeables.yaml";

export type AssetCategory =
  | "furniture"
  | "nature"
  | "space"
  | "decor"
  | "ground"
  | "camping"
  | "vehicles"
  | "animals"
  | "food";

/** Stable placeable id — curated short ids + `pack__slug` for pack fills. */
export type PlaceableId = string;

export interface PlaceableSpec {
  label: string;
  category: AssetCategory;
  pack: string;
  footprint: [number, number];
  glb?: string;
  /** Explicit group scale (curated measured ratios). Ignored when autoFit is set. */
  scale: number;
  /** Auto-normalize GLB to targetSize meters (lazy-measured AABB). */
  autoFit?: "height" | "xz";
  targetSize?: number;
  topY?: number;
  faces?: "posZ" | "negZ";
  /** Asset has a locomotion clip (Walk / Swim / …). */
  canWander?: boolean;
  /** Preferred clip name substrings (first match in GLB wins). */
  walkClipHints?: string[];
  idleClipHints?: string[];
  /** In-place mesh animation (e.g. Fire.glb flame stretch). */
  canAnimate?: boolean;
}

interface PlaceablesYaml {
  wander: Record<string, { walk: string[]; idle: string[] }>;
  curated: Record<
    string,
    {
      label: string;
      category: AssetCategory;
      pack: string;
      file?: string;
      footprint: [number, number];
      scale: number;
      autoFit?: "height" | "xz";
      targetSize?: number;
      topY?: number;
      faces?: "posZ" | "negZ";
      canAnimate?: boolean;
    }
  >;
}

const PLACEABLES = placeablesYaml as PlaceablesYaml;

/** Wander-capable pack files. Clip hints apply when the GLB includes animations. */
const WANDER_LOCOMOTION: Record<string, { walk: string[]; idle: string[] }> =
  PLACEABLES.wander;

function wanderMeta(
  pack: string,
  file: string,
): Pick<PlaceableSpec, "canWander" | "walkClipHints" | "idleClipHints"> | null {
  const entry = WANDER_LOCOMOTION[`${pack}/${file}`];
  if (!entry) return null;
  return {
    canWander: true,
    walkClipHints: entry.walk,
    idleClipHints: entry.idle,
  };
}

export function pickClipName(
  clipNames: string[],
  hints: string[] | undefined,
): string | undefined {
  if (!hints?.length || clipNames.length === 0) return undefined;
  for (const hint of hints) {
    const h = hint.toLowerCase();
    const hit = clipNames.find((n) => n.toLowerCase().includes(h));
    if (hit) return hit;
  }
  return undefined;
}

const ASSET_BASE = import.meta.env.BASE_URL;
const FURN = `${ASSET_BASE}assets/packs/furniture`;
const TREES = `${ASSET_BASE}assets/packs/trees`;
const CAMP = `${ASSET_BASE}assets/packs/camping`;

function furn(name: string): string {
  return `${FURN}/${encodeURIComponent(name)}`;
}

function tree(name: string): string {
  return `${TREES}/${encodeURIComponent(name)}`;
}

function camp(name: string): string {
  return `${CAMP}/${encodeURIComponent(name)}`;
}

function packUrl(pack: string, file: string): string {
  return `${ASSET_BASE}assets/packs/${pack}/${encodeURIComponent(file)}`;
}

function slugify(file: string): string {
  return file
    .replace(/\.glb$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function labelFromFile(file: string): string {
  return file.replace(/\.glb$/i, "").replace(/\s+/g, " ").trim();
}

function inferCategory(pack: string, file: string): AssetCategory {
  const n = file.toLowerCase();
  if (pack === "space") return "space";
  if (pack === "trees" || pack === "nature") return "nature";
  if (pack === "cars") return "vehicles";
  if (pack === "animals") return "animals";
  if (pack === "food") return "food";
  if (pack === "camping") {
    if (n.includes("tree") || n === "rock.glb") return "nature";
    return "camping";
  }
  if (/rug|mat\b/.test(n)) return "ground";
  if (
    /plant|lamp|trash|cardboard|box|duck|keyboard|mouse|laptop|phone|radio|speaker|pencil|sticky|picture|painting|trophy|toiletpaper|toilet paper|cup|mug|plate|bowl|book(?!case)/.test(
      n,
    )
  ) {
    return "decor";
  }
  return "furniture";
}

function defaultFootprint(category: AssetCategory, file: string): [number, number] {
  const n = file.toLowerCase();
  if (category === "ground") return [2.2, 1.4];
  if (category === "vehicles") return [2.2, 1.1];
  if (category === "animals") return [1.0, 0.7];
  if (category === "food") return [0.35, 0.35];
  if (category === "nature") {
    if (n.includes("tree")) return [1.2, 1.2];
    if (n.includes("grass blades")) return [0.35, 0.35];
    if (n.includes("grass clump")) return [0.55, 0.55];
    if (n.includes("grass")) return [0.7, 0.7];
    return [0.7, 0.7];
  }
  if (category === "space") {
    if (n.includes("house pod")) return [12.5, 4.5];
    if (n.includes("house long")) return [2.4, 4.6];
    if (n.includes("house cylinder")) return [3.3, 3.3];
    if (n.includes("house single support")) return [3.2, 3.2];
    if (n.includes("house")) return [2.5, 2.3];
    if (n.includes("base")) return [4.5, 4.5];
    if (n.includes("rover")) return [1.5, 1.5];
    if (n.includes("astronaut")) return [0.8, 0.7];
    if (n.includes("rock large")) return [3.4, 3.3];
    if (n.includes("tree")) return [1.8, 1.6];
    if (n.includes("bush")) return [0.9, 0.6];
    if (n.includes("grass")) return [0.45, 0.4];
    if (n.includes("plant")) return [0.55, 0.5];
    return [0.8, 0.8];
  }
  if (category === "camping") {
    if (n.includes("tent")) return [2.2, 2.0];
    if (n.includes("island")) return [2.5, 2.5];
    return [0.9, 0.9];
  }
  if (/sofa|couch|bed|bathtub|desk|table|wardrobe|fridge|bookcase|shelf|wall/.test(n)) {
    return [1.4, 0.8];
  }
  if (/chair|stool|bench/.test(n)) return [0.65, 0.65];
  return [0.85, 0.85];
}

function defaultAutoFit(
  category: AssetCategory,
  file: string,
): { autoFit: "height" | "xz"; targetSize: number } {
  const n = file.toLowerCase();
  if (category === "ground") return { autoFit: "xz", targetSize: 2.2 };
  if (category === "nature") {
    if (n.includes("tree")) return { autoFit: "height", targetSize: 3.2 };
    if (n.includes("grass blades")) return { autoFit: "height", targetSize: 0.28 };
    if (n.includes("grass clump")) return { autoFit: "height", targetSize: 0.4 };
    if (n.includes("grass")) return { autoFit: "height", targetSize: 0.55 };
  }
  if (category === "space") {
    if (n.includes("house single support")) return { autoFit: "xz", targetSize: 3.2 };
    if (n.includes("house pod")) return { autoFit: "height", targetSize: 2.2 };
    if (n.includes("house")) return { autoFit: "height", targetSize: 2.4 };
    if (n.includes("base")) return { autoFit: "height", targetSize: 2.6 };
    if (n.includes("rover")) return { autoFit: "height", targetSize: 1.35 };
    if (n.includes("astronaut")) return { autoFit: "height", targetSize: 1.7 };
    if (n.includes("rock large")) return { autoFit: "height", targetSize: 1.45 };
    if (n.includes("rock")) return { autoFit: "height", targetSize: 0.65 };
    if (n.includes("tree lava") || n.includes("tree light")) {
      return { autoFit: "height", targetSize: 2.3 };
    }
    if (n.includes("tree")) return { autoFit: "height", targetSize: 3.2 };
    if (n.includes("bush")) return { autoFit: "height", targetSize: 0.85 };
    if (n.includes("grass")) return { autoFit: "height", targetSize: 0.32 };
    if (n.includes("plant")) return { autoFit: "height", targetSize: 0.75 };
    return { autoFit: "height", targetSize: 1.0 };
  }
  if (category === "vehicles") return { autoFit: "height", targetSize: 1.4 };
  if (category === "animals") return { autoFit: "height", targetSize: 1.0 };
  if (category === "food") return { autoFit: "height", targetSize: 0.28 };
  if (category === "camping") {
    if (n.includes("tent")) return { autoFit: "height", targetSize: 2.0 };
    if (n.includes("island")) return { autoFit: "xz", targetSize: 3.4 };
    if (n === "fire.glb") return { autoFit: "height", targetSize: 0.9 };
    return { autoFit: "height", targetSize: 0.7 };
  }
  if (/^wall |wall window|wall doorway/.test(n)) {
    return { autoFit: "height", targetSize: 2.6 };
  }
  if (/door|wardrobe|closet|fridge|bookcase|shelf/.test(n)) {
    return { autoFit: "height", targetSize: 1.85 };
  }
  if (/chair|stool|sofa|couch|bench/.test(n)) {
    return { autoFit: "height", targetSize: 0.95 };
  }
  if (/lamp/.test(n) && /floor/.test(n)) {
    return { autoFit: "height", targetSize: 1.55 };
  }
  return { autoFit: "height", targetSize: 0.85 };
}

function packFileUrl(pack: string, file: string): string {
  if (pack === "furniture") return furn(file);
  if (pack === "trees") return tree(file);
  if (pack === "camping") return camp(file);
  return packUrl(pack, file);
}

function curatedSpecs(): Record<string, PlaceableSpec> {
  const out: Record<string, PlaceableSpec> = {};
  for (const [id, spec] of Object.entries(PLACEABLES.curated)) {
    out[id] = {
      label: spec.label,
      category: spec.category,
      pack: spec.pack,
      footprint: spec.footprint,
      scale: spec.scale,
      glb: spec.file ? packFileUrl(spec.pack, spec.file) : undefined,
      autoFit: spec.autoFit,
      targetSize: spec.targetSize,
      topY: spec.topY,
      faces: spec.faces,
      canAnimate: spec.canAnimate,
    };
  }
  return out;
}

/** Curated office set — stable short ids used by maps / layoutGrowth. */
const CURATED_SPECS: Record<string, PlaceableSpec> = curatedSpecs();

function buildCatalog(): Record<PlaceableId, PlaceableSpec> {
  const specs: Record<PlaceableId, PlaceableSpec> = { ...CURATED_SPECS };
  const claimed = new Set(
    Object.values(CURATED_SPECS)
      .map((s) => s.glb)
      .filter((g): g is string => Boolean(g)),
  );

  for (const { pack, file } of PACK_GLB_INVENTORY) {
    const glb = packUrl(pack, file);
    if (claimed.has(glb)) continue;

    const baseId = `${pack}__${slugify(file)}`;
    let id = baseId;
    let n = 2;
    while (id in specs) {
      id = `${baseId}_${n++}`;
    }

    const category = inferCategory(pack, file);
    const fit = defaultAutoFit(category, file);
    const wander = wanderMeta(pack, file);
    const canAnimate = /^Fire\.glb$/i.test(file);
    specs[id] = {
      label: labelFromFile(file),
      category,
      pack,
      footprint: defaultFootprint(category, file),
      glb,
      scale: 1,
      autoFit: fit.autoFit,
      targetSize: fit.targetSize,
      ...wander,
      ...(canAnimate ? { canAnimate: true } : {}),
    };
  }

  return specs;
}

/** Full placeable library — curated short ids + every pack GLB. */
export const PLACEABLE_SPECS: Record<PlaceableId, PlaceableSpec> = buildCatalog();

export function placeableCanWander(placeableId: string): boolean {
  return Boolean(PLACEABLE_SPECS[placeableId]?.canWander);
}

export function placeableCanAnimate(placeableId: string): boolean {
  return Boolean(PLACEABLE_SPECS[placeableId]?.canAnimate);
}

/** Yaw so a Kenney prop’s front faces toward `to`. */
export function yawToward(
  from: [number, number, number],
  to: [number, number, number],
  faces: "posZ" | "negZ" = "negZ",
): number {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const yaw = Math.atan2(dx, dz);
  return faces === "negZ" ? yaw + Math.PI : yaw;
}

export function isPlaceableId(id: string): id is PlaceableId {
  return id in PLACEABLE_SPECS;
}

/** Prefix for ids of GLBs a user imported in the browser (never a shipped pack). */
export const USER_PLACEABLE_PREFIX = "user__";

export function isUserPlaceableId(id: string): boolean {
  return id.startsWith(USER_PLACEABLE_PREFIX);
}

/**
 * Add or replace a user-imported placeable in the shared catalog so it can be
 * used anywhere a builtin id is (library, paint, inspector, favorites, save).
 * Callers are responsible for the object URL's lifetime (see lib/assets/userAssets).
 */
export function registerUserPlaceable(id: PlaceableId, spec: PlaceableSpec): void {
  PLACEABLE_SPECS[id] = spec;
}

export function unregisterUserPlaceable(id: PlaceableId): void {
  delete PLACEABLE_SPECS[id];
}

export function listPlaceables(category?: AssetCategory): PlaceableId[] {
  const ids = Object.keys(PLACEABLE_SPECS) as PlaceableId[];
  if (!category) return ids;
  return ids.filter((id) => PLACEABLE_SPECS[id].category === category);
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  "furniture",
  "decor",
  "ground",
  "nature",
  "space",
  "camping",
  "vehicles",
  "animals",
  "food",
];

export const ASSET_PACKS = [
  "furniture",
  "trees",
  "nature",
  "camping",
  "cars",
  "animals",
  "food",
  "space",
  "user",
] as const;
