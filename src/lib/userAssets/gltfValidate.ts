import { UserAssetError } from "@/lib/userAssets/errors";

const GLB_MAGIC = 0x46546c67; // glTF
const CHUNK_JSON = 0x4e4f534a; // JSON
const CHUNK_BIN = 0x004e4942; // BIN\0

/** Draco / KTX2 basisu are hard-rejected via extensionsRequired (CDN decoders). */
export const HARD_REJECT_EXTENSIONS = new Set([
  "KHR_draco_mesh_compression",
  "KHR_texture_basisu",
]);

export interface ParsedGlb {
  json: Record<string, unknown>;
  bin: ArrayBuffer | null;
  jsonBytes: Uint8Array;
}

export interface ParsedGltfJson {
  json: Record<string, unknown>;
}

function fail(key: string, params?: Record<string, string | number>): never {
  throw new UserAssetError("invalid", key, params);
}

/** Soft caps against JSON bombs (node fan-out / huge tables). */
export const MAX_NODES = 8_192;
export const MAX_MESHES = 4_096;
export const MAX_ACCESSORS = 16_384;

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** Parse a GLB (glTF 2 binary). No network; validates header + chunks. */
export function parseGlb(buf: ArrayBuffer): ParsedGlb {
  if (buf.byteLength < 12) fail("errGlbHeader");
  const view = new DataView(buf);
  const magic = readU32(view, 0);
  const version = readU32(view, 4);
  const length = readU32(view, 8);
  if (magic !== GLB_MAGIC) fail("errGlbHeader");
  if (version !== 2) fail("errGlbHeader");
  if (length !== buf.byteLength) fail("errGlbHeader");

  let offset = 12;
  let jsonBytes: Uint8Array | null = null;
  let bin: ArrayBuffer | null = null;
  let chunkIndex = 0;

  while (offset + 8 <= buf.byteLength) {
    const chunkLength = readU32(view, offset);
    const chunkType = readU32(view, offset + 4);
    offset += 8;
    if (chunkLength < 0 || offset + chunkLength > buf.byteLength) {
      fail("errGlbHeader");
    }
    if (chunkLength % 4 !== 0) fail("errGlbHeader");
    const chunkData = new Uint8Array(buf, offset, chunkLength);
    offset += chunkLength;

    if (chunkIndex === 0) {
      if (chunkType !== CHUNK_JSON) {
        fail("errGlbHeader");
      }
      jsonBytes = chunkData;
    } else if (chunkType === CHUNK_BIN) {
      bin = chunkData.slice().buffer;
    }
    chunkIndex += 1;
  }

  if (!jsonBytes) fail("errGlbHeader");
  const text = new TextDecoder("utf-8").decode(jsonBytes);
  const parsed = parseGltfJson(text);
  return { json: parsed.json, bin, jsonBytes };
}

/** Parse glTF JSON text/bytes. Validates version and index bounds. */
export function parseGltfJson(input: string | Uint8Array | ArrayBuffer): ParsedGltfJson {
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else {
    const bytes =
      input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    // Strip UTF-8 BOM
    const start =
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
        ? 3
        : 0;
    text = new TextDecoder("utf-8").decode(bytes.subarray(start));
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    fail("errGltfJson");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    fail("errGltfJson");
  }
  const obj = json as Record<string, unknown>;
  const asset = obj.asset;
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    fail("errGltfJson");
  }
  const version = String((asset as { version?: unknown }).version ?? "");
  if (!version.startsWith("2.")) {
    fail("errVersion", { version: version || "?" });
  }

  const required = obj.extensionsRequired;
  if (Array.isArray(required)) {
    for (const ext of required) {
      if (typeof ext === "string" && HARD_REJECT_EXTENSIONS.has(ext)) {
        fail("errExtension", { ext });
      }
    }
  }

  validateIndexBounds(obj);
  return { json: obj };
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

function validateIndexBounds(json: Record<string, unknown>): void {
  const buffers = asArray(json.buffers) ?? [];
  const bufferViews = asArray(json.bufferViews) ?? [];
  const accessors = asArray(json.accessors) ?? [];
  const images = asArray(json.images) ?? [];
  const meshes = asArray(json.meshes) ?? [];
  const materials = asArray(json.materials) ?? [];
  const textures = asArray(json.textures) ?? [];
  const samplers = asArray(json.samplers) ?? [];
  const nodes = asArray(json.nodes) ?? [];
  const scenes = asArray(json.scenes) ?? [];

  if (nodes.length > MAX_NODES) fail("errGltfJson");
  if (meshes.length > MAX_MESHES) fail("errGltfJson");
  if (accessors.length > MAX_ACCESSORS) fail("errGltfJson");

  for (const bv of bufferViews) {
    if (!bv || typeof bv !== "object") continue;
    const bi = (bv as { buffer?: unknown }).buffer;
    if (typeof bi === "number" && (bi < 0 || bi >= buffers.length)) {
      fail("errGltfJson");
    }
  }
  for (const acc of accessors) {
    if (!acc || typeof acc !== "object") continue;
    const bvi = (acc as { bufferView?: unknown }).bufferView;
    if (typeof bvi === "number" && (bvi < 0 || bvi >= bufferViews.length)) {
      fail("errGltfJson");
    }
  }
  for (const img of images) {
    if (!img || typeof img !== "object") continue;
    const bvi = (img as { bufferView?: unknown }).bufferView;
    if (typeof bvi === "number" && (bvi < 0 || bvi >= bufferViews.length)) {
      fail("errGltfJson");
    }
  }
  for (const tex of textures) {
    if (!tex || typeof tex !== "object") continue;
    const si = (tex as { sampler?: unknown }).sampler;
    const si2 = (tex as { source?: unknown }).source;
    if (typeof si === "number" && (si < 0 || si >= samplers.length)) {
      fail("errGltfJson");
    }
    if (typeof si2 === "number" && (si2 < 0 || si2 >= images.length)) {
      fail("errGltfJson");
    }
  }
  for (const mesh of meshes) {
    if (!mesh || typeof mesh !== "object") continue;
    const prims = asArray((mesh as { primitives?: unknown }).primitives) ?? [];
    for (const p of prims) {
      if (!p || typeof p !== "object") continue;
      const mat = (p as { material?: unknown }).material;
      if (typeof mat === "number" && (mat < 0 || mat >= materials.length)) {
        fail("errGltfJson");
      }
      const attrs = (p as { attributes?: unknown }).attributes;
      if (attrs && typeof attrs === "object") {
        for (const v of Object.values(attrs as Record<string, unknown>)) {
          if (typeof v === "number" && (v < 0 || v >= accessors.length)) {
            fail("errGltfJson");
          }
        }
      }
      const indices = (p as { indices?: unknown }).indices;
      if (
        typeof indices === "number" &&
        (indices < 0 || indices >= accessors.length)
      ) {
        fail("errGltfJson");
      }
    }
  }
  const parentCount = new Int32Array(nodes.length);
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const mesh = (node as { mesh?: unknown }).mesh;
    if (typeof mesh === "number" && (mesh < 0 || mesh >= meshes.length)) {
      fail("errGltfJson");
    }
    const children = asArray((node as { children?: unknown }).children) ?? [];
    for (const c of children) {
      if (typeof c !== "number" || c < 0 || c >= nodes.length) {
        fail("errGltfJson");
      }
      parentCount[c]! += 1;
      if (parentCount[c]! > 1) fail("errGltfJson"); // multi-parent / DAG bomb
    }
  }
  for (const scene of scenes) {
    if (!scene || typeof scene !== "object") continue;
    const ns = asArray((scene as { nodes?: unknown }).nodes) ?? [];
    for (const n of ns) {
      if (typeof n === "number" && (n < 0 || n >= nodes.length)) {
        fail("errGltfJson");
      }
    }
  }

  // Iterative DFS: reject cycles (self-child, A→B→A, …).
  const visited = new Uint8Array(nodes.length);
  const stack: number[] = [];
  const onStack = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    if (visited[i]) continue;
    stack.push(i);
    while (stack.length) {
      const idx = stack[stack.length - 1]!;
      if (!onStack[idx]) {
        onStack[idx] = 1;
        visited[idx] = 1;
        const node = nodes[idx];
        const children =
          node && typeof node === "object"
            ? (asArray((node as { children?: unknown }).children) ?? [])
            : [];
        for (const c of children) {
          if (typeof c !== "number") continue;
          if (onStack[c]) fail("errGltfJson"); // cycle
          if (!visited[c]) stack.push(c);
        }
        continue;
      }
      onStack[idx] = 0;
      stack.pop();
    }
  }
}

/** Collect buffer/image URI strings from parsed glTF JSON. */
export function collectUris(
  json: Record<string, unknown>,
  isGlb: boolean,
): { kind: "buffer" | "image"; index: number; uri: string | null }[] {
  const out: {
    kind: "buffer" | "image";
    index: number;
    uri: string | null;
  }[] = [];
  const buffers = asArray(json.buffers) ?? [];
  buffers.forEach((b, index) => {
    const uri =
      b && typeof b === "object" && typeof (b as { uri?: unknown }).uri === "string"
        ? (b as { uri: string }).uri
        : null;
    // GLB buffers[0] without uri is the BIN chunk — not a URI dependency.
    if (isGlb && index === 0 && uri == null) {
      out.push({ kind: "buffer", index, uri: null });
      return;
    }
    out.push({ kind: "buffer", index, uri });
  });
  const images = asArray(json.images) ?? [];
  images.forEach((img, index) => {
    if (!img || typeof img !== "object") {
      out.push({ kind: "image", index, uri: null });
      return;
    }
    const o = img as { uri?: unknown; bufferView?: unknown };
    if (typeof o.bufferView === "number") {
      out.push({ kind: "image", index, uri: null });
      return;
    }
    out.push({
      kind: "image",
      index,
      uri: typeof o.uri === "string" ? o.uri : null,
    });
  });
  return out;
}
