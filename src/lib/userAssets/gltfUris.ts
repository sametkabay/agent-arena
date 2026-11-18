import { UserAssetError } from "@/lib/userAssets/errors";
import {
  collectUris,
  parseGlb,
  parseGltfJson,
} from "@/lib/userAssets/gltfValidate";

export type UriClass =
  | { kind: "data"; byteLength: number }
  | { kind: "relative-in-selection"; path: string; fileName: string }
  | { kind: "relative-missing"; path: string; fileName: string }
  | { kind: "external"; url: string; host: string }
  | { kind: "rejected"; uri: string; reason: string }
  | { kind: "ambiguous"; path: string; matches: string[] };

export interface SelectedFile {
  /** Relative path as reported by the file picker (webkitRelativePath or name). */
  path: string;
  /** Basename for fallback matching. */
  name: string;
  size: number;
  mime?: string;
}

export interface ImportPlan {
  entry: string;
  format: "glb" | "gltf";
  needed: string[];
  unused: string[];
  missing: string[];
  external: { url: string; host: string }[];
  rejected: { uri: string; reason: string }[];
  ambiguous: { path: string; matches: string[] }[];
  totalBytes: number;
  /** Parsed JSON for bounds / further steps. */
  json: Record<string, unknown>;
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i >= 0 ? norm.slice(i + 1) : norm;
}

function dirname(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i >= 0 ? norm.slice(0, i) : "";
}

/** Normalize ./ and ../ segments; no leading slash. */
export function normalizeRelPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

function decodeUriPath(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

function dataUriByteLength(uri: string): number {
  const comma = uri.indexOf(",");
  if (comma < 0) return 0;
  const meta = uri.slice(0, comma);
  const data = uri.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    const padded = data.replace(/\s/g, "");
    const padding = padded.endsWith("==") ? 2 : padded.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((padded.length * 3) / 4) - padding);
  }
  try {
    return decodeURIComponent(data).length;
  } catch {
    return data.length;
  }
}

/**
 * Classify a glTF buffer/image URI against the multi-select file list.
 * Relative URIs resolve from the entry file's directory.
 */
export function classifyUri(
  uri: string,
  baseDir: string,
  selection: SelectedFile[],
): UriClass {
  const trimmed = uri.trim();
  if (!trimmed) {
    return { kind: "rejected", uri, reason: "empty" };
  }
  if (/^data:/i.test(trimmed)) {
    return { kind: "data", byteLength: dataUriByteLength(trimmed) };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      return { kind: "external", url: trimmed, host: u.host };
    } catch {
      return { kind: "rejected", uri: trimmed, reason: "bad-url" };
    }
  }
  // Protocol-relative and any non-data/http(s) scheme (file:, blob:, ftp:, …)
  if (trimmed.startsWith("//")) {
    return { kind: "rejected", uri: trimmed, reason: "scheme" };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^data:/i.test(trimmed)) {
    return { kind: "rejected", uri: trimmed, reason: "scheme" };
  }
  // UNC / odd absolute forms that should never be treated as relatives
  if (/^\\\\/.test(trimmed) || /^\/\\/.test(trimmed)) {
    return { kind: "rejected", uri: trimmed, reason: "scheme" };
  }

  const decoded = decodeUriPath(trimmed.split("?")[0]!.split("#")[0]!);
  const joined = baseDir
    ? normalizeRelPath(`${baseDir}/${decoded}`)
    : normalizeRelPath(decoded);
  const base = basename(joined);

  const byPath = selection.filter(
    (f) => normalizeRelPath(f.path) === joined || normalizeRelPath(f.name) === joined,
  );
  if (byPath.length === 1) {
    return {
      kind: "relative-in-selection",
      path: normalizeRelPath(byPath[0]!.path || byPath[0]!.name),
      fileName: byPath[0]!.name,
    };
  }
  if (byPath.length > 1) {
    return {
      kind: "ambiguous",
      path: joined,
      matches: byPath.map((f) => f.path || f.name),
    };
  }

  const byBase = selection.filter(
    (f) => basename(f.path || f.name).toLowerCase() === base.toLowerCase(),
  );
  if (byBase.length === 1) {
    return {
      kind: "relative-in-selection",
      path: normalizeRelPath(byBase[0]!.path || byBase[0]!.name),
      fileName: byBase[0]!.name,
    };
  }
  if (byBase.length > 1) {
    return {
      kind: "ambiguous",
      path: joined,
      matches: byBase.map((f) => f.path || f.name),
    };
  }
  return { kind: "relative-missing", path: joined, fileName: base };
}

function extOf(name: string): string {
  const b = basename(name).toLowerCase();
  const i = b.lastIndexOf(".");
  return i >= 0 ? b.slice(i) : "";
}

/**
 * Plan an import from a multi-file selection.
 * Exactly one .glb or one .gltf entry is required.
 * Does not fetch anything.
 */
export function planImport(
  files: SelectedFile[],
  contents?: Map<string, ArrayBuffer>,
): ImportPlan {
  const entries = files.filter((f) => {
    const e = extOf(f.path || f.name);
    return e === ".glb" || e === ".gltf";
  });
  if (entries.length === 0) {
    throw new UserAssetError("invalid", "errNoEntry");
  }
  if (entries.length > 1) {
    throw new UserAssetError("invalid", "errMultipleEntries");
  }
  const entryFile = entries[0]!;
  const entryPath = normalizeRelPath(entryFile.path || entryFile.name);
  const format: "glb" | "gltf" = extOf(entryPath) === ".glb" ? "glb" : "gltf";
  const baseDir = dirname(entryPath);

  let json: Record<string, unknown>;
  if (contents) {
    const key =
      [...contents.keys()].find(
        (k) => normalizeRelPath(k) === entryPath || basename(k) === basename(entryPath),
      ) ?? entryPath;
    const buf = contents.get(key);
    if (!buf) throw new UserAssetError("invalid", "errNoEntry");
    if (format === "glb") {
      json = parseGlb(buf).json;
    } else {
      json = parseGltfJson(buf).json;
    }
  } else {
    // Structural plan without bytes — empty json; caller validates later.
    json = { asset: { version: "2.0" } };
  }

  const uris = collectUris(json, format === "glb");
  const needed = new Set<string>([entryPath]);
  const missing: string[] = [];
  const external: { url: string; host: string }[] = [];
  const rejected: { uri: string; reason: string }[] = [];
  const ambiguous: { path: string; matches: string[] }[] = [];
  let totalBytes = files
    .filter((f) => normalizeRelPath(f.path || f.name) === entryPath)
    .reduce((n, f) => n + f.size, 0);

  for (const u of uris) {
    if (u.uri == null) continue;
    const cls = classifyUri(u.uri, baseDir, files);
    switch (cls.kind) {
      case "data":
        totalBytes += cls.byteLength;
        break;
      case "relative-in-selection":
        needed.add(cls.path);
        break;
      case "relative-missing":
        missing.push(cls.path || cls.fileName);
        break;
      case "external":
        external.push({ url: cls.url, host: cls.host });
        break;
      case "rejected":
        rejected.push({ uri: cls.uri, reason: cls.reason });
        break;
      case "ambiguous":
        ambiguous.push({ path: cls.path, matches: cls.matches });
        break;
    }
  }

  // Sum sizes of needed relative files (avoid double-counting entry).
  for (const path of needed) {
    if (path === entryPath) continue;
    const f = files.find(
      (x) =>
        normalizeRelPath(x.path || x.name) === path ||
        basename(x.path || x.name) === basename(path),
    );
    if (f) totalBytes += f.size;
  }

  const selectedPaths = new Set(
    files.map((f) => normalizeRelPath(f.path || f.name)),
  );
  const unused = [...selectedPaths].filter((p) => !needed.has(p));

  return {
    entry: entryPath,
    format,
    needed: [...needed],
    unused,
    missing,
    external,
    rejected,
    ambiguous,
    totalBytes,
    json,
  };
}

/** True when import must be blocked (missing / rejected / ambiguous). */
export function importBlocked(plan: ImportPlan): boolean {
  return (
    plan.missing.length > 0 ||
    plan.rejected.length > 0 ||
    plan.ambiguous.length > 0
  );
}
