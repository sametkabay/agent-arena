import { PACK_GLB_INVENTORY } from "@/lib/assets/packInventory.generated";

export type AssetCategory =
  | "furniture"
  | "nature"
  | "space"
  | "decor"
  | "ground"
  | "camping"
  | "vehicles"
  | "animals"
  | "food"
  | "cosmetics";

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

/** Wander-capable pack files. Clip hints apply when the GLB includes animations. */
const WANDER_LOCOMOTION: Record<
  string,
  { walk: string[]; idle: string[] }
> = {
  "animals/Cat.glb": {
    walk: ["Walk"],
    idle: ["Idle"],
  },
  "animals/Fish.glb": {
    walk: ["Swim"],
    idle: ["Swim"],
  },
  "animals/Snake.glb": {
    walk: ["Snake_Walk", "Walk"],
    idle: ["Snake_Idle", "Idle"],
  },
  "animals/Spider.glb": {
    walk: ["Spider_Walk", "Walk"],
    idle: ["Spider_Idle", "Idle"],
  },
  "animals/Wolf.glb": {
    walk: ["Walk", "Gallop"],
    idle: ["Idle"],
  },
  "farm-animals/Cow.glb": {
    walk: ["Walk", "WalkSlow", "Run"],
    idle: ["Idle"],
  },
  "farm-animals/Horse.glb": {
    walk: ["Walk", "WalkSlow", "Run"],
    idle: ["Idle"],
  },
  "farm-animals/Zebra.glb": {
    walk: ["Walk", "WalkSlow", "Run"],
    idle: ["Idle"],
  },
  "space/Astronaut.glb": {
    walk: ["Walk"],
    idle: ["Idle"],
  },
};

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
  if (pack === "animals" || pack === "farm-animals") return "animals";
  if (pack === "food") return "food";
  if (pack === "cosmetics") return "cosmetics";
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
  if (category === "cosmetics") return [0.4, 0.4];
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
  if (category === "cosmetics") return { autoFit: "height", targetSize: 0.45 };
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

/** Curated office set — stable short ids used by maps / layoutGrowth. */
const CURATED_SPECS: Record<string, PlaceableSpec> = {
  desk: {
    label: "Desk workstation",
    category: "furniture",
    pack: "furniture",
    // Desk by Robbobin — display floor + blue wall removed; grounded.
    footprint: [1.6, 1.15],
    glb: furn("Desk.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 1.05,
    topY: 0.67,
    faces: "posZ",
  },
  chair: {
    label: "Desk chair",
    category: "furniture",
    pack: "furniture",
    footprint: [0.6, 0.6],
    glb: furn("Chair Desk.glb"),
    scale: 1.05 / 0.608,
    faces: "negZ",
  },
  lounge_chair: {
    label: "Lounge chair",
    category: "furniture",
    pack: "furniture",
    footprint: [0.85, 0.75],
    glb: furn("Lounge Chair.glb"),
    scale: 0.95 / 0.46,
    faces: "negZ",
  },
  coffee_table: {
    label: "Coffee table",
    category: "furniture",
    pack: "furniture",
    footprint: [1.15, 0.7],
    glb: furn("Table Coffee.glb"),
    scale: 0.42 / 0.23,
  },
  couch: {
    label: "Couch",
    category: "furniture",
    pack: "furniture",
    footprint: [1.9, 0.8],
    glb: furn("Lounge Sofa.glb"),
    scale: 0.9 / 0.46,
    faces: "negZ",
  },
  plant: {
    label: "Potted plant",
    category: "decor",
    pack: "furniture",
    footprint: [0.5, 0.5],
    glb: furn("Potted Plant.glb"),
    scale: 1.05 / 0.654,
  },
  plant_small: {
    label: "Small plant",
    category: "decor",
    pack: "furniture",
    footprint: [0.45, 0.45],
    glb: furn("Plant Small.glb"),
    scale: 0.85 / 0.14,
  },
  monitor: {
    label: "Monitor",
    category: "furniture",
    pack: "furniture",
    footprint: [0.55, 0.2],
    glb: furn("Computer Screen.glb"),
    scale: 0.38 / 0.294,
    faces: "negZ",
  },
  bookshelf: {
    label: "Bookshelf",
    category: "furniture",
    pack: "furniture",
    footprint: [1.05, 0.5],
    glb: furn("Bookcase Open.glb"),
    scale: 1.75 / 0.88,
    faces: "negZ",
  },
  bookcase_books: {
    label: "Office cabinet",
    category: "furniture",
    pack: "furniture",
    footprint: [1.05, 0.4],
    glb: furn("BookcaseWithBooks.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 1.85,
    faces: "negZ",
  },
  table: {
    label: "Table",
    category: "furniture",
    pack: "furniture",
    footprint: [1.5, 0.85],
    glb: furn("Table.glb"),
    scale: 0.75 / 0.327,
  },
  ping_pong_table: {
    label: "Ping pong table",
    category: "furniture",
    pack: "furniture",
    footprint: [1.55, 2.15],
    glb: furn("PingPongTable.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.76,
  },
  table_large: {
    label: "Large table",
    category: "furniture",
    pack: "furniture",
    footprint: [1.2, 2.0],
    glb: furn("TableJeremy.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.75,
  },
  cabinet: {
    label: "Cabinet",
    category: "furniture",
    pack: "furniture",
    footprint: [0.7, 0.6],
    glb: furn("Cabinet Bed Drawer.glb"),
    scale: 0.85 / 0.263,
    faces: "negZ",
  },
  rug: {
    label: "Rug",
    category: "ground",
    pack: "furniture",
    footprint: [2.4, 1.4],
    glb: furn("Rug Rectangle.glb"),
    scale: 2.4 / 1.57,
  },
  floor_lamp: {
    label: "Floor lamp",
    category: "decor",
    pack: "furniture",
    footprint: [0.35, 0.35],
    glb: furn("Lamp Round Floor.glb"),
    scale: 1.55 / 0.86,
  },
  desk_lamp: {
    label: "Desk lamp",
    category: "decor",
    pack: "furniture",
    footprint: [0.25, 0.25],
    glb: furn("Lamp Round Table.glb"),
    scale: 0.42 / 0.314,
  },
  trash: {
    label: "Trash can",
    category: "decor",
    pack: "furniture",
    footprint: [0.35, 0.35],
    glb: furn("Trashcan.glb"),
    scale: 0.55 / 0.428,
  },
  side_table: {
    label: "Side table",
    category: "furniture",
    pack: "furniture",
    footprint: [0.7, 0.4],
    glb: furn("Side Table.glb"),
    scale: 0.6 / 0.384,
  },
  tree_birch: {
    label: "Birch tree",
    category: "nature",
    pack: "trees",
    footprint: [1.2, 1.2],
    glb: tree("Birch Tree.glb"),
    scale: 3.2 / 1.0,
  },
  tree_pine: {
    label: "Pine tree",
    category: "nature",
    pack: "trees",
    footprint: [1.4, 1.4],
    glb: tree("Pine Tree.glb"),
    scale: 3.6 / 1.0,
  },
  tree_simple: {
    label: "Simple tree",
    category: "nature",
    pack: "trees",
    footprint: [1.1, 1.1],
    glb: tree("Simple Tree.glb"),
    scale: 3.0 / 1.0,
  },
  tree_stylized: {
    label: "Stylized tree",
    category: "nature",
    pack: "trees",
    footprint: [1.3, 1.3],
    glb: tree("Stylized Tree.glb"),
    scale: 3.4 / 1.0,
  },
  tent: {
    label: "Tent",
    category: "camping",
    pack: "camping",
    footprint: [2.2, 2.0],
    glb: camp("Tent.glb"),
    scale: 2.0 / 1.0,
    faces: "negZ",
  },
  campfire: {
    label: "Campfire",
    category: "camping",
    pack: "camping",
    footprint: [0.8, 0.8],
    glb: camp("Campfire.glb"),
    scale: 0.7 / 0.4,
  },
  fire: {
    label: "Fire",
    category: "camping",
    pack: "camping",
    footprint: [0.55, 0.55],
    glb: camp("Fire.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.85,
    canAnimate: true,
  },
  island: {
    label: "Island",
    category: "ground",
    pack: "camping",
    footprint: [3.0, 3.0],
    glb: camp("Island.glb"),
    scale: 1,
    autoFit: "xz",
    targetSize: 3.2,
  },
  log: {
    label: "Log",
    category: "camping",
    pack: "camping",
    footprint: [1.2, 0.4],
    glb: camp("Log.glb"),
    scale: 0.9 / 0.5,
  },
  rock: {
    label: "Rock",
    category: "nature",
    pack: "camping",
    footprint: [0.7, 0.7],
    glb: camp("Rock.glb"),
    scale: 0.55 / 0.35,
  },
  bench: {
    label: "Bench",
    category: "furniture",
    pack: "furniture",
    footprint: [1.4, 0.5],
    glb: furn("Bench.glb"),
    scale: 0.55 / 0.35,
  },
  cardboard_box: {
    label: "Cardboard box",
    category: "decor",
    pack: "furniture",
    footprint: [0.5, 0.5],
    glb: furn("Cardboard Box Closed.glb"),
    scale: 0.45 / 0.3,
  },
  rock_small: {
    label: "Small rock",
    category: "nature",
    pack: "camping",
    footprint: [0.4, 0.4],
    glb: camp("Rock.glb"),
    scale: 0.32 / 0.35,
  },
  rock_large: {
    label: "Large rock",
    category: "nature",
    pack: "camping",
    footprint: [1.35, 1.35],
    glb: camp("Rock.glb"),
    scale: 1.05 / 0.35,
  },
  space_boulder: {
    label: "Space boulder",
    category: "space",
    pack: "procedural",
    footprint: [1.6, 1.4],
    scale: 1,
  },
  space_rock: {
    label: "Space rock",
    category: "space",
    pack: "procedural",
    footprint: [0.85, 0.75],
    scale: 1,
  },
  supply_crate: {
    label: "Supply crate",
    category: "decor",
    pack: "procedural",
    footprint: [0.85, 0.65],
    scale: 1,
  },
  beacon: {
    label: "Beacon light",
    category: "decor",
    pack: "procedural",
    footprint: [0.4, 0.4],
    scale: 1,
  },
  antenna: {
    label: "Antenna",
    category: "decor",
    pack: "procedural",
    footprint: [0.55, 0.55],
    scale: 1,
  },
  wall_solid: {
    label: "Wall",
    category: "furniture",
    pack: "procedural",
    footprint: [2.0, 0.22],
    scale: 1,
  },
  door: {
    label: "Door",
    category: "furniture",
    pack: "furniture",
    footprint: [2.0, 0.35],
    glb: furn("Doorway.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 2.6,
    faces: "posZ",
  },
  work_stool: {
    label: "Work stool",
    category: "furniture",
    pack: "furniture",
    footprint: [0.45, 0.45],
    glb: furn("Bar Stool.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.85,
  },
  box_open: {
    label: "Open box",
    category: "decor",
    pack: "furniture",
    footprint: [0.5, 0.5],
    glb: furn("Cardboard Box Open.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.45,
  },
  lamp_square: {
    label: "Square floor lamp",
    category: "decor",
    pack: "furniture",
    footprint: [0.35, 0.35],
    glb: furn("Lamp Square Floor.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 1.55,
  },
  fridge: {
    label: "Fridge",
    category: "furniture",
    pack: "furniture",
    footprint: [0.7, 0.7],
    glb: furn("Kitchen Fridge.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 1.85,
  },
  coat_rack: {
    label: "Coat rack",
    category: "decor",
    pack: "furniture",
    footprint: [0.4, 0.4],
    glb: furn("Coat Rack Standing.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 1.7,
  },
  ottoman: {
    label: "Ottoman",
    category: "furniture",
    pack: "furniture",
    footprint: [0.7, 0.7],
    glb: furn("Lounge Sofa Ottoman.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.42,
  },
  round_table: {
    label: "Round table",
    category: "furniture",
    pack: "furniture",
    footprint: [1.2, 1.2],
    glb: furn("Round Table.glb"),
    scale: 1,
    autoFit: "height",
    targetSize: 0.75,
  },
};

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
  "cosmetics",
];

export const ASSET_PACKS = [
  "furniture",
  "trees",
  "nature",
  "camping",
  "cars",
  "animals",
  "farm-animals",
  "food",
  "cosmetics",
  "space",
] as const;
