import { isUserAssetId } from "@/lib/userAssets/ids";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import type { PlaceableInstance } from "@/lib/types";
import type { UserAssetKind } from "@/lib/userAssets/types";

export interface UsageMapEntry {
  id: string;
  name: string;
  count: number;
}

export interface UsageCount {
  maps: UsageMapEntry[];
  draftCount: number;
  totalObjects: number;
  /** Objects to show in the confirm copy (maps + draft, no double-count). */
  displayCount: number;
}

function countInPlaceables(
  placeables: PlaceableInstance[] | undefined,
  id: string,
): number {
  if (!placeables) return 0;
  return placeables.reduce((n, p) => (p.placeableId === id ? n + 1 : n), 0);
}

/**
 * Count placed objects referencing `id` across saved maps + optional draft.
 * `displayCount` avoids double-counting when the open draft is a saved map.
 */
export function countUsage(
  id: string,
  customMaps: ArenaMapDefinition[],
  draft: ArenaMapDefinition | null | undefined,
  _kind: UserAssetKind = "placeable",
): UsageCount {
  void _kind; // #8: character looks will count a different registry
  const maps: UsageMapEntry[] = [];
  let totalObjects = 0;
  for (const m of customMaps) {
    const count = countInPlaceables(m.placeables, id);
    if (count > 0) {
      maps.push({ id: m.id, name: m.name, count });
      totalObjects += count;
    }
  }
  const draftCount = draft ? countInPlaceables(draft.placeables, id) : 0;
  const draftIsSaved =
    !!draft && customMaps.some((m) => m.id === draft.id);
  const displayCount = draftIsSaved
    ? totalObjects
    : totalObjects + draftCount;
  return { maps, draftCount, totalObjects, displayCount };
}

/** Strip placeables with the given ids from a map definition (immutable). */
export function stripPlaceableIds(
  def: ArenaMapDefinition,
  ids: ReadonlySet<string> | string[],
): ArenaMapDefinition {
  const set = ids instanceof Set ? ids : new Set(ids);
  return {
    ...def,
    placeables: def.placeables.filter((p) => !set.has(p.placeableId)),
  };
}

/** Kind-aware strip — placeables today; #8 can extend for characters. */
export function stripUserAssetIds(
  def: ArenaMapDefinition,
  ids: ReadonlySet<string> | string[],
  kind: UserAssetKind = "placeable",
): ArenaMapDefinition {
  if (kind !== "placeable") return def;
  return stripPlaceableIds(def, ids);
}

/** Collect unique user: placeable ids referenced by a map. */
export function collectUserAssetIds(
  def: ArenaMapDefinition,
  kind: UserAssetKind = "placeable",
): string[] {
  if (kind !== "placeable") return [];
  const out = new Set<string>();
  for (const p of def.placeables) {
    if (isUserAssetId(p.placeableId)) out.add(p.placeableId);
  }
  return [...out];
}

/** Whether export should warn about private models (follow-up: issue #57). */
export function shouldWarnExportMissingModels(
  def: ArenaMapDefinition,
  kind: UserAssetKind = "placeable",
): boolean {
  return collectUserAssetIds(def, kind).length > 0;
}
