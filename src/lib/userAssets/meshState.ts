import type { UserAssetMeta } from "@/lib/userAssets/types";

export type UserMeshState = "ready" | "missing" | "error" | "unavailable";

/**
 * Decide what to render for a user placeable.
 * Pure — used by the scene and unit tests.
 */
export function resolveUserMeshState(
  meta: UserAssetMeta | null | undefined,
  files: Record<string, Blob> | null | undefined,
  opts?: { error?: boolean; unavailable?: boolean },
): UserMeshState {
  if (opts?.unavailable) return "unavailable";
  if (opts?.error) return "error";
  if (!meta) return "missing";
  if (!files || !files[meta.entry]) return "missing";
  return "ready";
}

/**
 * Pure reactivity helper: pick the live meta for a placed user asset.
 * Mirrors what UserPlaceableMesh should re-render on (replace rev, targetSize,
 * hydrate, cross-tab invalidate).
 */
export function selectUserMeshMeta(
  metas: readonly UserAssetMeta[],
  id: string,
): UserAssetMeta | null {
  return metas.find((m) => m.id === id) ?? null;
}

/** True when scene should remount / reload the GLB for this meta. */
export function userMeshCacheKey(meta: UserAssetMeta | null): string | null {
  if (!meta) return null;
  return `${meta.id}@${meta.rev}@${meta.fitScale}@${meta.targetSize}`;
}
