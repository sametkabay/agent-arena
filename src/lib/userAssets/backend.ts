import type { UserAssetKind, UserAssetMeta } from "@/lib/userAssets/types";

/** Injectable persistence backend — IDB in prod, memory/miniIdb in tests. */
export interface UserAssetBackend {
  getMeta(id: string): Promise<UserAssetMeta | null>;
  listMeta(kind?: UserAssetKind): Promise<UserAssetMeta[]>;
  getFiles(id: string): Promise<Record<string, Blob> | null>;
  /** Atomic put of meta + blobs in one transaction when supported. */
  put(meta: UserAssetMeta, files: Record<string, Blob>): Promise<void>;
  putMeta(meta: UserAssetMeta): Promise<void>;
  remove(id: string): Promise<void>;
}
