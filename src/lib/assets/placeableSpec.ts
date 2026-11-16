import {
  ASSET_CATEGORIES as BUILTIN_CATEGORIES,
  ASSET_PACKS as BUILTIN_PACKS,
  PLACEABLE_SPECS,
  isPlaceableId as isBuiltinPlaceableId,
  listPlaceables as listBuiltinPlaceables,
  type AssetCategory as BuiltinCategory,
  type PlaceableId,
  type PlaceableSpec,
} from "@/lib/assets/catalog";
import { isUserAssetId } from "@/lib/userAssets/ids";
import type { UserAssetMeta } from "@/lib/userAssets/types";

/** Builtin categories plus the single "Custom" library group for user imports. */
export type AssetCategory = BuiltinCategory | "custom";

export type UserPlaceableSpec = Omit<PlaceableSpec, "category"> & {
  category: "custom";
  userAsset: true;
  userAssetId: string;
  external?: boolean;
  fitScale: number;
  rev: number;
};

export type AnyPlaceableSpec = PlaceableSpec | UserPlaceableSpec;

let userMetas: UserAssetMeta[] = [];
const listeners = new Set<() => void>();

export function setUserPlaceableMetas(metas: UserAssetMeta[]): void {
  userMetas = metas.filter((m) => m.kind === "placeable");
  for (const l of listeners) l();
}

export function getUserPlaceableMetas(): UserAssetMeta[] {
  return userMetas;
}

export function subscribeUserPlaceableMetas(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function metaToSpec(meta: UserAssetMeta): UserPlaceableSpec {
  return {
    label: meta.name,
    category: "custom",
    pack: "custom",
    footprint: meta.footprint,
    scale: meta.fitScale,
    targetSize: meta.targetSize,
    userAsset: true,
    userAssetId: meta.id,
    external: meta.externalUris.length > 0,
    fitScale: meta.fitScale,
    rev: meta.rev,
  };
}

export function getPlaceableSpec(id: string): AnyPlaceableSpec | undefined {
  if (id in PLACEABLE_SPECS) return PLACEABLE_SPECS[id as PlaceableId];
  if (isUserAssetId(id)) {
    const meta = userMetas.find((m) => m.id === id);
    if (meta) return metaToSpec(meta);
    // Known user id with missing meta — still "known" for placement/hydrate.
    return {
      label: id,
      category: "custom",
      pack: "custom",
      footprint: [1, 1],
      scale: 1,
      userAsset: true,
      userAssetId: id,
      fitScale: 1,
      rev: 0,
    };
  }
  return undefined;
}

export function isPlaceableId(id: string): id is PlaceableId {
  return isBuiltinPlaceableId(id) || isUserAssetId(id);
}

export function listPlaceables(category?: AssetCategory): PlaceableId[] {
  if (category === "custom") {
    return userMetas.map((m) => m.id);
  }
  const builtin = listBuiltinPlaceables(category as BuiltinCategory | undefined);
  if (!category) {
    return [...builtin, ...userMetas.map((m) => m.id)];
  }
  return builtin;
}

export function listPlaceablesWithUser(category?: AssetCategory): PlaceableId[] {
  return listPlaceables(category);
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  ...BUILTIN_CATEGORIES,
  "custom",
];

export const ASSET_PACKS = [...BUILTIN_PACKS, "custom"] as const;

export { PLACEABLE_SPECS, type PlaceableId, type PlaceableSpec };
