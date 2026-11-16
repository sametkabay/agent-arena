/**
 * Tiny unit-cube glTF / GLB fixtures for tests and Playwright.
 * No three.js dependency — pure bytes.
 */

function jsonBytes(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

function pad4(n: number): number {
  return (4 - (n % 4)) % 4;
}

/**
 * Unit cube with per-face verts (24) so POSITION + NORMAL stay aligned.
 * CCW winding, outward normals — matches builtin Kenney thumbs (lit from above).
 */
function cubePositionBuffer(): ArrayBuffer {
  const p = new Float32Array([
    // -Z
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // +Z
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // -Y
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // +Y
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // -X
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
    // +X
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
  ]);
  return p.buffer;
}

function cubeNormalBuffer(): ArrayBuffer {
  const n = new Float32Array([
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  ]);
  return n.buffer;
}

/** Two tris per face; CCW from outside. */
function cubeIndices(): ArrayBuffer {
  const idx = new Uint16Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 14, 13, 12, 15,
    14, 16, 19, 18, 16, 18, 17, 20, 21, 22, 20, 22, 23,
  ]);
  return idx.buffer;
}

/** Per-face UVs (24 verts) — full 0..1 quad on each face. */
function cubeUvBuffer(): ArrayBuffer {
  const uvs: number[] = [];
  for (let f = 0; f < 6; f++) {
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
  }
  return new Float32Array(uvs).buffer;
}

/**
 * Precomputed 2×2 solid deep-pink (#FF1493) PNG — no zlib dep at runtime.
 * Used so e2e can detect textured (non-black) pixels after the loader cache fix.
 */
export function solidPinkPng(): Uint8Array {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0,
    0, 0, 2, 8, 2, 0, 0, 0, 253, 212, 154, 115, 0, 0, 0, 18, 73, 68, 65, 84, 120,
    156, 99, 248, 47, 50, 249, 191, 200, 100, 6, 8, 5, 0, 47, 230, 6, 153, 16, 17,
    26, 96, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
}

function cubeGltfJson(opts: {
  bufferUri?: string | null;
  embedBuffer?: boolean;
  extensionsRequired?: string[];
}): Record<string, unknown> {
  const posBytes = new Float32Array(cubePositionBuffer()).byteLength;
  const norBytes = new Float32Array(cubeNormalBuffer()).byteLength;
  const indBytes = new Uint16Array(cubeIndices()).byteLength;
  const norOffset = posBytes + pad4(posBytes);
  const indOffset = norOffset + norBytes + pad4(norBytes);
  const total = indOffset + indBytes;

  const buffers: Record<string, unknown>[] = [];
  if (opts.embedBuffer) {
    buffers.push({ byteLength: total });
  } else if (opts.bufferUri != null) {
    buffers.push({ byteLength: total, uri: opts.bufferUri });
  } else {
    buffers.push({ byteLength: total, uri: "cube.bin" });
  }

  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "agent-arena-test" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: "VEC3",
        max: [0.5, 0.5, 0.5],
        min: [-0.5, -0.5, -0.5],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 24,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: 36,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes },
      { buffer: 0, byteOffset: norOffset, byteLength: norBytes },
      { buffer: 0, byteOffset: indOffset, byteLength: indBytes },
    ],
    buffers,
  };
  if (opts.extensionsRequired?.length) {
    json.extensionsRequired = opts.extensionsRequired;
  }
  return json;
}

function concatBin(): ArrayBuffer {
  const pos = new Uint8Array(cubePositionBuffer());
  const nor = new Uint8Array(cubeNormalBuffer());
  const ind = new Uint8Array(cubeIndices());
  const padPos = pad4(pos.byteLength);
  const padNor = pad4(nor.byteLength);
  const out = new Uint8Array(
    pos.byteLength + padPos + nor.byteLength + padNor + ind.byteLength,
  );
  out.set(pos, 0);
  out.set(nor, pos.byteLength + padPos);
  out.set(ind, pos.byteLength + padPos + nor.byteLength + padNor);
  return out.buffer;
}

/** Binary GLB of a unit cube. */
export function makeCubeGlb(): ArrayBuffer {
  const json = cubeGltfJson({ embedBuffer: true, bufferUri: null });
  // GLB: buffers[0] has no uri
  (json.buffers as Record<string, unknown>[])[0] = {
    byteLength: concatBin().byteLength,
  };
  let jsonArr = jsonBytes(json);
  const jsonPad = pad4(jsonArr.byteLength);
  if (jsonPad) {
    const padded = new Uint8Array(jsonArr.byteLength + jsonPad);
    padded.set(jsonArr);
    // spaces for JSON padding
    for (let i = jsonArr.byteLength; i < padded.byteLength; i++) padded[i] = 0x20;
    jsonArr = padded;
  }
  const bin = new Uint8Array(concatBin());
  const binPad = pad4(bin.byteLength);
  const total =
    12 + 8 + jsonArr.byteLength + 8 + bin.byteLength + binPad;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonArr.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonArr.byteLength).set(jsonArr);
  const binChunkStart = 20 + jsonArr.byteLength;
  view.setUint32(binChunkStart, bin.byteLength + binPad, true);
  view.setUint32(binChunkStart + 4, 0x004e4942, true);
  new Uint8Array(out, binChunkStart + 8, bin.byteLength).set(bin);
  return out;
}

/** Two-file cube: .gltf JSON + .bin. */
export function makeCubeGltfPair(bufferUri = "cube.bin"): {
  gltf: string;
  bin: ArrayBuffer;
  gltfBytes: Uint8Array;
} {
  const json = cubeGltfJson({ bufferUri });
  const text = JSON.stringify(json, null, 2);
  return {
    gltf: text,
    bin: concatBin(),
    gltfBytes: new TextEncoder().encode(text),
  };
}

/** glTF whose buffer points at an external https URL (for warning tests). */
export function makeExternalUriGltf(
  url = "https://cdn.example.test/cube.bin",
): string {
  return JSON.stringify(cubeGltfJson({ bufferUri: url }), null, 2);
}

/** glTF requiring Draco — should be rejected. */
export function makeDracoRequiredGltf(): string {
  return JSON.stringify(
    cubeGltfJson({
      bufferUri: "cube.bin",
      extensionsRequired: ["KHR_draco_mesh_compression"],
    }),
  );
}

export function makeCubeGlbBlob(): Blob {
  return new Blob([makeCubeGlb()], { type: "model/gltf-binary" });
}

function concatTexturedBin(): {
  bin: ArrayBuffer;
  posBytes: number;
  norOffset: number;
  norBytes: number;
  uvOffset: number;
  uvBytes: number;
  indOffset: number;
  indBytes: number;
  imgOffset: number;
  imgBytes: number;
} {
  const pos = new Uint8Array(cubePositionBuffer());
  const nor = new Uint8Array(cubeNormalBuffer());
  const uv = new Uint8Array(cubeUvBuffer());
  const ind = new Uint8Array(cubeIndices());
  const png = solidPinkPng();
  const padPos = pad4(pos.byteLength);
  const padNor = pad4(nor.byteLength);
  const padUv = pad4(uv.byteLength);
  const padInd = pad4(ind.byteLength);
  const norOffset = pos.byteLength + padPos;
  const uvOffset = norOffset + nor.byteLength + padNor;
  const indOffset = uvOffset + uv.byteLength + padUv;
  const imgOffset = indOffset + ind.byteLength + padInd;
  const out = new Uint8Array(imgOffset + png.byteLength);
  out.set(pos, 0);
  out.set(nor, norOffset);
  out.set(uv, uvOffset);
  out.set(ind, indOffset);
  out.set(png, imgOffset);
  return {
    bin: out.buffer,
    posBytes: pos.byteLength,
    norOffset,
    norBytes: nor.byteLength,
    uvOffset,
    uvBytes: uv.byteLength,
    indOffset,
    indBytes: ind.byteLength,
    imgOffset,
    imgBytes: png.byteLength,
  };
}

/**
 * Unit cube GLB with an embedded PNG baseColorTexture.
 * Regression fixture for the loader-cache ImageBitmap dispose bug.
 */
export function makeTexturedCubeGlb(): ArrayBuffer {
  const packed = concatTexturedBin();
  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "agent-arena-test-textured" },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: "VEC3",
        max: [0.5, 0.5, 0.5],
        min: [-0.5, -0.5, -0.5],
      },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 24, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: packed.posBytes },
      {
        buffer: 0,
        byteOffset: packed.norOffset,
        byteLength: packed.norBytes,
      },
      {
        buffer: 0,
        byteOffset: packed.uvOffset,
        byteLength: packed.uvBytes,
      },
      {
        buffer: 0,
        byteOffset: packed.indOffset,
        byteLength: packed.indBytes,
        target: 34963,
      },
      {
        buffer: 0,
        byteOffset: packed.imgOffset,
        byteLength: packed.imgBytes,
      },
    ],
    buffers: [{ byteLength: packed.bin.byteLength }],
    images: [{ mimeType: "image/png", bufferView: 4 }],
    textures: [{ source: 0 }],
    materials: [
      {
        name: "pink",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
  };

  let jsonArr = jsonBytes(json);
  const jsonPad = pad4(jsonArr.byteLength);
  if (jsonPad) {
    const padded = new Uint8Array(jsonArr.byteLength + jsonPad);
    padded.set(jsonArr);
    for (let i = jsonArr.byteLength; i < padded.byteLength; i++) padded[i] = 0x20;
    jsonArr = padded;
  }
  const bin = new Uint8Array(packed.bin);
  const binPad = pad4(bin.byteLength);
  const total = 12 + 8 + jsonArr.byteLength + 8 + bin.byteLength + binPad;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonArr.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonArr.byteLength).set(jsonArr);
  const binChunkStart = 20 + jsonArr.byteLength;
  view.setUint32(binChunkStart, bin.byteLength + binPad, true);
  view.setUint32(binChunkStart + 4, 0x004e4942, true);
  new Uint8Array(out, binChunkStart + 8, bin.byteLength).set(bin);
  return out;
}

export function makeTexturedCubeGlbBlob(): Blob {
  return new Blob([makeTexturedCubeGlb()], { type: "model/gltf-binary" });
}

export function makeCubeGltfFiles(): {
  gltf: Blob;
  bin: Blob;
  names: { gltf: string; bin: string };
} {
  const pair = makeCubeGltfPair("cube.bin");
  return {
    gltf: new Blob([pair.gltf], { type: "model/gltf+json" }),
    bin: new Blob([pair.bin], { type: "application/octet-stream" }),
    names: { gltf: "cube.gltf", bin: "cube.bin" },
  };
}
