import type { UserAssetMeta } from "@/lib/userAssets/types";
import { normalizeRelPath } from "@/lib/userAssets/gltfUris";

export interface UrlMap {
  /** normalizedPath → blob URL */
  urls: Map<string, string>;
  /** GLTFLoader / LoadingManager URL modifier. */
  modifier: (url: string) => string;
  revokeAll: () => void;
}

export interface UrlMapDeps {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

function basename(p: string): string {
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
}

/**
 * Build a blob-URL map for a stored asset.
 * External http(s) URIs are passed through only if listed in meta.externalUris;
 * otherwise they resolve to "data:," so nothing is fetched silently.
 */
export function buildUrlMap(
  meta: UserAssetMeta,
  files: Record<string, Blob>,
  deps: UrlMapDeps = {},
): UrlMap {
  const createURL =
    deps.createObjectURL ??
    ((b: Blob) =>
      typeof URL !== "undefined" && URL.createObjectURL
        ? URL.createObjectURL(b)
        : `blob:fake/${Math.random()}`);
  const revokeURL =
    deps.revokeObjectURL ??
    ((u: string) => {
      if (typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(u);
    });

  const urls = new Map<string, string>();
  const byBase = new Map<string, string>();
  for (const [path, blob] of Object.entries(files)) {
    const norm = normalizeRelPath(path);
    const objectUrl = createURL(blob);
    urls.set(norm, objectUrl);
    // Basename is a fallback only — full path wins on collision.
    const base = basename(norm);
    if (!byBase.has(base)) byBase.set(base, objectUrl);
  }

  const allowedExternal = new Set(meta.externalUris);
  const knownBlobUrls = new Set(urls.values());

  const resolveLocal = (raw: string): string | null => {
    const clean = raw.split("?")[0]!.split("#")[0]!;
    const stripped = clean.replace(/^blob:[^/]*\//, "");
    const norm = normalizeRelPath(stripped);
    // Prefer full path before basename (folder import / #8).
    if (urls.has(norm)) return urls.get(norm)!;
    const entryDir = meta.entry.includes("/")
      ? meta.entry.slice(0, meta.entry.lastIndexOf("/"))
      : "";
    const base = basename(clean);
    if (entryDir) {
      const joined = normalizeRelPath(`${entryDir}/${base}`);
      if (urls.has(joined)) return urls.get(joined)!;
    }
    if (byBase.has(base)) return byBase.get(base)!;
    if (urls.has(base)) return urls.get(base)!;
    return null;
  };

  const modifier = (url: string): string => {
    // Virtual base used by the scene loader so relatives stay path-like.
    if (/^https:\/\/user-asset\.local\//i.test(url)) {
      const path = url.replace(/^https:\/\/user-asset\.local\//i, "");
      return resolveLocal(path) ?? "data:,";
    }
    if (/^https?:\/\//i.test(url)) {
      return allowedExternal.has(url) ? url : "data:,";
    }
    if (/^data:/i.test(url)) return url;
    // Blob URLs: keep ours; also pass through loader-created blobs for
    // embedded bufferView images (GLTFLoader createObjectURL). Rewriting
    // those to "data:," made textured models render black.
    if (/^blob:/i.test(url)) {
      if (knownBlobUrls.has(url)) return url;
      return resolveLocal(url) ?? url;
    }
    // Protocol-relative / unknown schemes never pass through.
    if (url.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return "data:,";
    }

    return resolveLocal(url) ?? "data:,";
  };

  const revokeAll = () => {
    const seen = new Set<string>();
    for (const u of urls.values()) {
      if (seen.has(u)) continue;
      seen.add(u);
      revokeURL(u);
    }
    urls.clear();
  };

  return { urls, modifier, revokeAll };
}
