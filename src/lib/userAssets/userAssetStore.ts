import type { UserAssetBackend } from "@/lib/userAssets/backend";
import { UserAssetError } from "@/lib/userAssets/errors";
import { gltfBounds } from "@/lib/userAssets/gltfBounds";
import {
  importBlocked,
  normalizeRelPath,
  planImport,
  type SelectedFile,
} from "@/lib/userAssets/gltfUris";
import { parseGlb, parseGltfJson } from "@/lib/userAssets/gltfValidate";
import { makeUserAssetId } from "@/lib/userAssets/ids";
import {
  clampTargetSize,
  computeFitScale,
  computeFootprint,
} from "@/lib/userAssets/scale";
import type {
  StorageEstimate,
  UserAssetKind,
  UserAssetMeta,
} from "@/lib/userAssets/types";

export interface PutAssetInput {
  kind: UserAssetKind;
  name: string;
  files: { path: string; blob: Blob; mime?: string }[];
  targetSize?: number;
  /** Pre-confirmed external URIs from the import dialog. */
  allowExternal?: string[];
}

export interface UserAssetStore {
  put(
    input: PutAssetInput,
    opts?: { signal?: AbortSignal },
  ): Promise<UserAssetMeta>;
  get(id: string): Promise<{ meta: UserAssetMeta; files: Record<string, Blob> } | null>;
  list(kind?: UserAssetKind): Promise<UserAssetMeta[]>;
  rename(id: string, name: string): Promise<UserAssetMeta>;
  replace(
    id: string,
    files: PutAssetInput["files"],
    opts?: { signal?: AbortSignal; allowExternal?: string[] },
  ): Promise<UserAssetMeta>;
  delete(id: string): Promise<void>;
  setTargetSize(id: string, targetSize: number): Promise<UserAssetMeta>;
  /** Persist a Box3-measured bbox when import-time min/max was absent. */
  recordMeasuredBBox(
    id: string,
    bbox: NonNullable<UserAssetMeta["bbox"]>,
  ): Promise<UserAssetMeta>;
  estimate(): Promise<StorageEstimate | null>;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new UserAssetError("aborted", "cancelled");
}

function mimeFor(path: string, fallback?: string): string {
  if (fallback) return fallback;
  const lower = path.toLowerCase();
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".bin")) return "application/octet-stream";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function readAll(
  files: PutAssetInput["files"],
  signal?: AbortSignal,
): Promise<{
  selected: SelectedFile[];
  contents: Map<string, ArrayBuffer>;
  blobs: Record<string, Blob>;
}> {
  const selected: SelectedFile[] = [];
  const contents = new Map<string, ArrayBuffer>();
  const blobs: Record<string, Blob> = {};
  let i = 0;
  for (const f of files) {
    throwIfAborted(signal);
    const path = normalizeRelPath(f.path);
    selected.push({
      path,
      name: path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path,
      size: f.blob.size,
      mime: f.mime,
    });
    const buf = await f.blob.arrayBuffer();
    throwIfAborted(signal);
    contents.set(path, buf);
    blobs[path] = f.blob.type
      ? f.blob
      : new Blob([buf], { type: mimeFor(path, f.mime) });
    i += 1;
    void i;
  }
  return { selected, contents, blobs };
}

function buildMetaFromPlan(
  id: string,
  kind: UserAssetKind,
  name: string,
  targetSize: number,
  plan: ReturnType<typeof planImport>,
  blobs: Record<string, Blob>,
  now: number,
  rev: number,
  createdAt: number,
): UserAssetMeta {
  if (importBlocked(plan)) {
    if (plan.missing.length) {
      throw new UserAssetError("invalid", "warnMissing", {
        files: plan.missing.join(", "),
      });
    }
    if (plan.rejected.length) {
      throw new UserAssetError("invalid", "errUri", {
        uri: plan.rejected[0]!.uri,
      });
    }
    throw new UserAssetError("invalid", "warnAmbiguous", {
      files: plan.ambiguous.map((a) => a.path).join(", "),
    });
  }
  // External allowed only when listed
  const bbox = gltfBounds(plan.json);
  const fitScale = computeFitScale(bbox, targetSize);
  const footprint = computeFootprint(bbox, fitScale);
  const fileMetas = plan.needed.map((path) => {
    const blob = blobs[path];
    return {
      path,
      size: blob?.size ?? 0,
      mime: blob?.type || mimeFor(path),
    };
  });
  const storedBlobs: Record<string, Blob> = {};
  for (const path of plan.needed) {
    if (blobs[path]) storedBlobs[path] = blobs[path]!;
  }
  return {
    id,
    kind,
    name: name.trim() || plan.entry,
    format: plan.format,
    entry: plan.entry,
    files: fileMetas,
    totalBytes: plan.totalBytes,
    externalUris: plan.external.map((e) => e.url),
    bbox,
    targetSize,
    fitScale,
    footprint,
    rev,
    createdAt,
    updatedAt: now,
  };
}

export function createUserAssetStore(backend: UserAssetBackend): UserAssetStore {
  return {
    async put(input, opts) {
      throwIfAborted(opts?.signal);
      const { selected, contents, blobs } = await readAll(input.files, opts?.signal);
      throwIfAborted(opts?.signal);
      const plan = planImport(selected, contents);
      // Re-validate entry bytes explicitly for clearer errors
      const entryBuf = contents.get(plan.entry);
      if (!entryBuf) throw new UserAssetError("invalid", "errNoEntry");
      if (plan.format === "glb") parseGlb(entryBuf);
      else parseGltfJson(entryBuf);
      throwIfAborted(opts?.signal);

      if (plan.external.length) {
        const allowed = new Set(input.allowExternal ?? []);
        for (const e of plan.external) {
          if (!allowed.has(e.url)) {
            throw new UserAssetError("invalid", "errUri", { uri: e.url });
          }
        }
      }

      const now = Date.now();
      const id = makeUserAssetId();
      const targetSize = clampTargetSize(input.targetSize ?? 1);
      const meta = buildMetaFromPlan(
        id,
        input.kind,
        input.name,
        targetSize,
        plan,
        blobs,
        now,
        1,
        now,
      );
      // Keep only needed files
      const stored: Record<string, Blob> = {};
      for (const path of plan.needed) {
        if (blobs[path]) stored[path] = blobs[path]!;
      }
      throwIfAborted(opts?.signal);
      try {
        await backend.put(meta, stored);
      } catch (err) {
        if (err instanceof UserAssetError) throw err;
        throw err;
      }
      // Honor cancel after the IDB put: roll back so Cancel during "Saving…" sticks.
      if (opts?.signal?.aborted) {
        try {
          await backend.remove(id);
        } catch {
          /* best-effort */
        }
        throw new UserAssetError("aborted", "cancelled");
      }
      return meta;
    },

    async get(id) {
      const meta = await backend.getMeta(id);
      if (!meta) return null;
      const files = await backend.getFiles(id);
      if (!files) return { meta, files: {} };
      return { meta, files };
    },

    async list(kind) {
      return backend.listMeta(kind);
    },

    async rename(id, name) {
      const meta = await backend.getMeta(id);
      if (!meta) throw new UserAssetError("not_found");
      const next = {
        ...meta,
        name: name.trim() || meta.name,
        updatedAt: Date.now(),
      };
      await backend.putMeta(next);
      return next;
    },

    async replace(id, files, opts) {
      throwIfAborted(opts?.signal);
      const existing = await backend.getMeta(id);
      if (!existing) throw new UserAssetError("not_found");
      const { selected, contents, blobs } = await readAll(files, opts?.signal);
      throwIfAborted(opts?.signal);
      const plan = planImport(selected, contents);
      const entryBuf = contents.get(plan.entry);
      if (!entryBuf) throw new UserAssetError("invalid", "errNoEntry");
      if (plan.format === "glb") parseGlb(entryBuf);
      else parseGltfJson(entryBuf);

      if (plan.external.length) {
        const allowed = new Set(opts?.allowExternal ?? []);
        for (const e of plan.external) {
          if (!allowed.has(e.url)) {
            throw new UserAssetError("invalid", "errUri", { uri: e.url });
          }
        }
      }

      const now = Date.now();
      // Re-read meta inside the replace path so a concurrent delete can't resurrect.
      const stillThere = await backend.getMeta(id);
      if (!stillThere) throw new UserAssetError("not_found");
      const meta = buildMetaFromPlan(
        id,
        stillThere.kind,
        stillThere.name,
        stillThere.targetSize,
        plan,
        blobs,
        now,
        stillThere.rev + 1,
        stillThere.createdAt,
      );
      const stored: Record<string, Blob> = {};
      for (const path of plan.needed) {
        if (blobs[path]) stored[path] = blobs[path]!;
      }
      throwIfAborted(opts?.signal);
      await backend.put(meta, stored);
      // Replace cannot safely roll back after put; UI disables Cancel during commit.
      return meta;
    },

    async delete(id) {
      await backend.remove(id);
    },

    async setTargetSize(id, targetSize) {
      const meta = await backend.getMeta(id);
      if (!meta) throw new UserAssetError("not_found");
      const nextSize = clampTargetSize(targetSize);
      const fitScale = computeFitScale(meta.bbox, nextSize);
      const footprint = computeFootprint(meta.bbox, fitScale);
      const next = {
        ...meta,
        targetSize: nextSize,
        fitScale,
        footprint,
        updatedAt: Date.now(),
      };
      await backend.putMeta(next);
      return next;
    },

    async recordMeasuredBBox(id, bbox) {
      const meta = await backend.getMeta(id);
      if (!meta) throw new UserAssetError("not_found");
      if (meta.bbox) return meta;
      const fitScale = computeFitScale(bbox, meta.targetSize);
      const footprint = computeFootprint(bbox, fitScale);
      const next = {
        ...meta,
        bbox,
        fitScale,
        footprint,
        updatedAt: Date.now(),
      };
      await backend.putMeta(next);
      return next;
    },

    async estimate() {
      const nav =
        typeof navigator !== "undefined"
          ? (navigator as Navigator & {
              storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> };
            })
          : undefined;
      if (!nav?.storage?.estimate) return null;
      try {
        const e = await nav.storage.estimate();
        return {
          usage: typeof e.usage === "number" ? e.usage : null,
          quota: typeof e.quota === "number" ? e.quota : null,
        };
      } catch {
        return null;
      }
    },
  };
}
