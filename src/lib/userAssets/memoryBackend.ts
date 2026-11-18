import type { UserAssetBackend } from "@/lib/userAssets/backend";
import { UserAssetError } from "@/lib/userAssets/errors";
import type { UserAssetMeta } from "@/lib/userAssets/types";

export interface MemoryBackendOptions {
  quotaBytes?: number;
  unavailable?: boolean;
}

export function createMemoryBackend(
  opts: MemoryBackendOptions = {},
): UserAssetBackend & {
  _metas: Map<string, UserAssetMeta>;
  _files: Map<string, Record<string, Blob>>;
  setUnavailable: (v: boolean) => void;
  setQuotaBytes: (n: number | undefined) => void;
} {
  const metas = new Map<string, UserAssetMeta>();
  const files = new Map<string, Record<string, Blob>>();
  let unavailable = opts.unavailable === true;
  let quotaBytes = opts.quotaBytes;

  const usedBytes = () => {
    let n = 0;
    for (const m of metas.values()) n += m.totalBytes;
    return n;
  };

  const guard = () => {
    if (unavailable) throw new UserAssetError("unavailable");
  };

  const checkQuota = (meta: UserAssetMeta, replacingId?: string) => {
    if (quotaBytes == null) return;
    const prev = replacingId ? metas.get(replacingId)?.totalBytes ?? 0 : 0;
    if (usedBytes() - prev + meta.totalBytes > quotaBytes) {
      throw new UserAssetError("quota");
    }
  };

  return {
    _metas: metas,
    _files: files,
    setUnavailable(v) {
      unavailable = v;
    },
    setQuotaBytes(n) {
      quotaBytes = n;
    },
    async getMeta(id) {
      guard();
      return metas.get(id) ?? null;
    },
    async listMeta(kind) {
      guard();
      const all = [...metas.values()];
      return kind ? all.filter((m) => m.kind === kind) : all;
    },
    async getFiles(id) {
      guard();
      const f = files.get(id);
      return f ? { ...f } : null;
    },
    async put(meta, fileMap) {
      guard();
      checkQuota(meta, meta.id);
      metas.set(meta.id, { ...meta });
      files.set(meta.id, { ...fileMap });
    },
    async putMeta(meta) {
      guard();
      if (!metas.has(meta.id)) throw new UserAssetError("not_found");
      metas.set(meta.id, { ...meta });
    },
    async remove(id) {
      guard();
      metas.delete(id);
      files.delete(id);
    },
  };
}
