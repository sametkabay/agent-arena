import { registerUserPlaceable, unregisterUserPlaceable, USER_PLACEABLE_PREFIX } from "@/lib/assets/catalog";
import {
  deleteUserAssetRecord,
  listUserAssetRecords,
  putUserAssetRecord,
  type UserAssetRecord,
} from "@/lib/assets/userAssetDb";
import { specFromMeta, validateGlbImport, type ImportAssetForm } from "@/lib/assets/userAssetValidation";
import { uid } from "@/lib/storage";
import type { UserAssetMeta } from "@/lib/types";

export type { ImportAssetForm } from "@/lib/assets/userAssetValidation";

/** Tracks the blob: URL each hydrated/imported asset is registered under, for cleanup. */
const objectUrls = new Map<string, string>();

function registerFromBlob(meta: UserAssetMeta, blob: Blob): void {
  const prev = objectUrls.get(meta.id);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  objectUrls.set(meta.id, url);
  registerUserPlaceable(meta.id, specFromMeta(meta, url));
}

/**
 * Load every imported GLB from IndexedDB and register it in the shared
 * placeable catalog. Call once at startup. A record whose blob can't be
 * read (evicted storage, corrupt entry) is simply left unregistered — maps
 * referencing it fall back to the existing "unknown placeableId" skip.
 */
export async function hydrateUserAssets(): Promise<UserAssetMeta[]> {
  let records: UserAssetRecord[];
  try {
    records = await listUserAssetRecords();
  } catch (err) {
    console.warn("[userAssets] failed to read IndexedDB", err);
    return [];
  }
  const metas: UserAssetMeta[] = [];
  for (const { blob, ...meta } of records) {
    try {
      registerFromBlob(meta, blob);
      metas.push(meta);
    } catch (err) {
      console.warn(`[userAssets] failed to register ${meta.id}`, err);
    }
  }
  return metas;
}

/** Import a picked file: validate, persist to IndexedDB, register in the catalog. */
export async function importUserAsset(
  file: File,
  form: ImportAssetForm,
  currentCount: number,
): Promise<{ meta: UserAssetMeta } | { error: string }> {
  const error = validateGlbImport(file, currentCount);
  if (error) return { error };

  const meta: UserAssetMeta = {
    id: `${USER_PLACEABLE_PREFIX}${uid()}`,
    label: form.label.trim() || file.name.replace(/\.(glb|gltf)$/i, ""),
    category: form.category,
    fileName: file.name,
    size: file.size,
    footprint: [0.85, 0.85],
    scale: 1,
    autoFit: form.autoFit,
    targetSize: form.targetSize,
    createdAt: Date.now(),
  };

  registerFromBlob(meta, file);
  try {
    await putUserAssetRecord({ ...meta, blob: file });
  } catch (err) {
    unregisterUserPlaceable(meta.id);
    const url = objectUrls.get(meta.id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.delete(meta.id);
    }
    console.warn("[userAssets] failed to persist import", err);
    return { error: "storageFailed" };
  }
  return { meta };
}

export async function removeUserAsset(id: string): Promise<void> {
  unregisterUserPlaceable(id);
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
  try {
    await deleteUserAssetRecord(id);
  } catch (err) {
    console.warn(`[userAssets] failed to delete ${id}`, err);
  }
}
