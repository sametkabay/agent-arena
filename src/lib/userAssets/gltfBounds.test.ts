import { describe, expect, it } from "vitest";
import { gltfBounds } from "@/lib/userAssets/gltfBounds";
import { makeCubeGltfPair } from "@/lib/userAssets/testing/makeGltf";
import { parseGltfJson } from "@/lib/userAssets/gltfValidate";

describe("gltfBounds", () => {
  it("reads cube POSITION min/max", () => {
    const { gltf } = makeCubeGltfPair();
    const { json } = parseGltfJson(gltf);
    const box = gltfBounds(json);
    expect(box).not.toBeNull();
    expect(box!.min[0]).toBeCloseTo(-0.5);
    expect(box!.max[0]).toBeCloseTo(0.5);
  });

  it("applies node translation", () => {
    const { gltf } = makeCubeGltfPair();
    const { json } = parseGltfJson(gltf);
    (json.nodes as Record<string, unknown>[])[0]!.translation = [2, 0, 0];
    const box = gltfBounds(json)!;
    expect(box.min[0]).toBeCloseTo(1.5);
    expect(box.max[0]).toBeCloseTo(2.5);
  });

  it("applies nested node matrix", () => {
    const json = {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [
        { children: [1] },
        {
          mesh: 0,
          matrix: [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1],
        },
      ],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0 } }],
        },
      ],
      accessors: [
        {
          componentType: 5126,
          count: 1,
          type: "VEC3",
          min: [0, 0, 0],
          max: [1, 1, 1],
        },
      ],
    };
    const box = gltfBounds(json)!;
    expect(box.max[0]).toBeCloseTo(2);
  });

  it("returns null when min/max missing", () => {
    const json = {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ componentType: 5126, count: 1, type: "VEC3" }],
    };
    expect(gltfBounds(json)).toBeNull();
  });
});
