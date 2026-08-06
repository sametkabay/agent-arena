export type AssetCategory = "furniture" | "nature" | "decor" | "ground" | "camping";

export type PlaceableId =
  | "desk"
  | "chair"
  | "lounge_chair"
  | "coffee_table"
  | "couch"
  | "plant"
  | "plant_small"
  | "monitor"
  | "bookshelf"
  | "table"
  | "cabinet"
  | "rug"
  | "floor_lamp"
  | "desk_lamp"
  | "trash"
  | "side_table"
  | "tree_birch"
  | "tree_pine"
  | "tree_simple"
  | "tree_stylized"
  | "tent"
  | "campfire"
  | "log"
  | "rock"
  | "bench"
  | "cardboard_box";

export interface PlaceableSpec {
  label: string;
  category: AssetCategory;
  pack: string;
  footprint: [number, number];
  glb?: string;
  scale: number;
  topY?: number;
  faces?: "posZ" | "negZ";
}

const FURN = "/assets/packs/furniture";
const TREES = "/assets/packs/trees";
const CAMP = "/assets/packs/camping";

function furn(name: string): string {
  return `${FURN}/${encodeURIComponent(name)}`;
}

function tree(name: string): string {
  return `${TREES}/${encodeURIComponent(name)}`;
}

function camp(name: string): string {
  return `${CAMP}/${encodeURIComponent(name)}`;
}

/** Placeable library — scales from measured AABB height → target meters. */
export const PLACEABLE_SPECS: Record<PlaceableId, PlaceableSpec> = {
  desk: {
    label: "Desk",
    category: "furniture",
    pack: "furniture",
    footprint: [1.45, 0.78],
    glb: furn("Desk.glb"),
    scale: 0.74 / 0.384,
    topY: 0.74,
    faces: "negZ",
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
  table: {
    label: "Table",
    category: "furniture",
    pack: "furniture",
    footprint: [1.5, 0.85],
    glb: furn("Table.glb"),
    scale: 0.75 / 0.327,
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
  },
  campfire: {
    label: "Campfire",
    category: "camping",
    pack: "camping",
    footprint: [0.8, 0.8],
    glb: camp("Campfire.glb"),
    scale: 0.7 / 0.4,
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
};

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
  "nature",
  "camping",
  "decor",
  "ground",
];

export const ASSET_PACKS = [
  "furniture",
  "trees",
  "camping",
  "cars",
  "animals",
  "farm-animals",
  "food",
  "cosmetics",
] as const;
