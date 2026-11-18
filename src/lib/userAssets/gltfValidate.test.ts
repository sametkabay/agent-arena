import { describe, expect, it } from "vitest";
import {
  collectUris,
  parseGlb,
  parseGltfJson,
} from "@/lib/userAssets/gltfValidate";
import { UserAssetError } from "@/lib/userAssets/errors";
import {
  makeCubeGlb,
  makeTexturedCubeGlb,
  makeCubeGltfPair,
  makeDracoRequiredGltf,
} from "@/lib/userAssets/testing/makeGltf";

describe("parseGlb", () => {
  it("parses a valid cube GLB", () => {
    const glb = makeCubeGlb();
    const parsed = parseGlb(glb);
    expect(parsed.json.asset).toMatchObject({ version: "2.0" });
    expect(parsed.bin).toBeTruthy();
  });

  it("parses a textured cube GLB with embedded PNG", () => {
    const glb = makeTexturedCubeGlb();
    const parsed = parseGlb(glb);
    expect(parsed.json.images).toHaveLength(1);
    expect(parsed.json.textures).toHaveLength(1);
    expect(parsed.json.materials).toHaveLength(1);
    const mat = (parsed.json.materials as { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[])[0];
    expect(mat?.pbrMetallicRoughness?.baseColorTexture?.index).toBe(0);
  });

  it("rejects wrong magic", () => {
    const buf = makeCubeGlb();
    new DataView(buf).setUint32(0, 0xdeadbeef, true);
    expect(() => parseGlb(buf)).toThrow(UserAssetError);
  });

  it("rejects version 1", () => {
    const buf = makeCubeGlb();
    new DataView(buf).setUint32(4, 1, true);
    expect(() => parseGlb(buf)).toThrow(UserAssetError);
  });

  it("rejects truncated length", () => {
    const buf = makeCubeGlb();
    new DataView(buf).setUint32(8, buf.byteLength + 100, true);
    expect(() => parseGlb(buf)).toThrow(UserAssetError);
  });

  it("accepts GLB without BIN chunk", () => {
    // Build JSON-only GLB
    const json = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: "2.0" },
        scenes: [{ nodes: [] }],
        nodes: [],
        buffers: [],
      }),
    );
    const pad = (4 - (json.byteLength % 4)) % 4;
    const jsonLen = json.byteLength + pad;
    const total = 12 + 8 + jsonLen;
    const out = new ArrayBuffer(total);
    const view = new DataView(out);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, jsonLen, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(out, 20, json.byteLength).set(json);
    for (let i = 0; i < pad; i++) new Uint8Array(out)[20 + json.byteLength + i] = 0x20;
    const parsed = parseGlb(out);
    expect(parsed.bin).toBeNull();
  });
});

describe("parseGltfJson", () => {
  it("parses cube gltf", () => {
    const { gltf } = makeCubeGltfPair();
    const parsed = parseGltfJson(gltf);
    expect(parsed.json.meshes).toBeTruthy();
  });

  it("strips BOM", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(
      JSON.stringify({ asset: { version: "2.0" }, scenes: [], nodes: [] }),
    )]);
    expect(parseGltfJson(bom).json.asset).toMatchObject({ version: "2.0" });
  });

  it("rejects version 1.0", () => {
    expect(() =>
      parseGltfJson(JSON.stringify({ asset: { version: "1.0" } })),
    ).toThrow(UserAssetError);
  });

  it("rejects out-of-range bufferView index", () => {
    expect(() =>
      parseGltfJson(
        JSON.stringify({
          asset: { version: "2.0" },
          buffers: [],
          bufferViews: [{ buffer: 3, byteLength: 1 }],
        }),
      ),
    ).toThrow(UserAssetError);
  });

  it("rejects Draco extensionsRequired", () => {
    expect(() => parseGltfJson(makeDracoRequiredGltf())).toThrow(UserAssetError);
  });

  it("rejects KTX2 basisu extensionsRequired", () => {
    expect(() =>
      parseGltfJson(
        JSON.stringify({
          asset: { version: "2.0" },
          extensionsRequired: ["KHR_texture_basisu"],
        }),
      ),
    ).toThrow(UserAssetError);
  });

  it("rejects non-object JSON", () => {
    expect(() => parseGltfJson("[]")).toThrow(UserAssetError);
    expect(() => parseGltfJson("{")).toThrow(UserAssetError);
  });

  it("rejects node cycles", () => {
    expect(() =>
      parseGltfJson(
        JSON.stringify({
          asset: { version: "2.0" },
          nodes: [{ children: [0] }],
        }),
      ),
    ).toThrow(UserAssetError);
  });

  it("rejects multi-parent / DAG bomb fan-in", () => {
    expect(() =>
      parseGltfJson(
        JSON.stringify({
          asset: { version: "2.0" },
          nodes: [
            { children: [2, 2] },
            { children: [2] },
            {},
          ],
        }),
      ),
    ).toThrow(UserAssetError);
  });

  it("rejects GLB with unaligned chunk length", () => {
    const buf = makeCubeGlb();
    // Corrupt first chunk length to 5 (not multiple of 4)
    new DataView(buf).setUint32(12, 5, true);
    expect(() => parseGlb(buf)).toThrow(UserAssetError);
  });
});

describe("collectUris", () => {
  it("skips GLB buffers[0] without uri", () => {
    const { json } = parseGlb(makeCubeGlb());
    const uris = collectUris(json, true);
    expect(uris.some((u) => u.kind === "buffer" && u.uri == null)).toBe(true);
  });

  it("collects external buffer uri from gltf", () => {
    const { gltf } = makeCubeGltfPair("https://cdn.example/x.bin");
    const { json } = parseGltfJson(gltf);
    const uris = collectUris(json, false);
    expect(uris.find((u) => u.kind === "buffer")?.uri).toContain("https://");
  });
});
