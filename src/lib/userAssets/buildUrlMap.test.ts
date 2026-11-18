import { describe, expect, it, vi } from "vitest";
import { buildUrlMap } from "@/lib/userAssets/buildUrlMap";
import type { UserAssetMeta } from "@/lib/userAssets/types";

function meta(partial: Partial<UserAssetMeta> = {}): UserAssetMeta {
  return {
    id: "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    kind: "placeable",
    name: "Cube",
    format: "gltf",
    entry: "cube.gltf",
    files: [],
    totalBytes: 10,
    externalUris: ["https://cdn.example/ok.bin"],
    bbox: null,
    targetSize: 1,
    fitScale: 1,
    footprint: [1, 1],
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe("buildUrlMap", () => {
  it("maps relative paths to blob URLs via modifier", () => {
    const created: string[] = [];
    const map = buildUrlMap(
      meta(),
      { "cube.gltf": new Blob(["{}"]), "cube.bin": new Blob([new Uint8Array(4)]) },
      {
        createObjectURL: (b) => {
          const u = `blob:test/${created.length}`;
          created.push(u);
          void b;
          return u;
        },
        revokeObjectURL: vi.fn(),
      },
    );
    expect(map.modifier("cube.bin")).toMatch(/^blob:test\//);
    expect(map.modifier("cube.gltf")).toMatch(/^blob:test\//);
  });

  it("allows listed external and blocks unlisted with data:,", () => {
    const map = buildUrlMap(
      meta(),
      {
        "cube.gltf": new Blob(["{}"]),
        "cube.bin": new Blob([new Uint8Array(2)]),
      },
      {
        createObjectURL: () => "blob:x",
        revokeObjectURL: () => {},
      },
    );
    expect(map.modifier("https://cdn.example/ok.bin")).toBe(
      "https://cdn.example/ok.bin",
    );
    expect(map.modifier("https://evil.example/x.bin")).toBe("data:,");
    expect(map.modifier("https://user-asset.local/cube.bin")).toBe("blob:x");
    expect(map.modifier("blob:http://localhost/abc/cube.bin")).toBe("blob:x");
  });

  it("revokes all unique object URLs", () => {
    const revoke = vi.fn();
    const map = buildUrlMap(
      meta(),
      { a: new Blob(["1"]), b: new Blob(["2"]) },
      {
        createObjectURL: (b) => `blob:${(b as Blob).size}`,
        revokeObjectURL: revoke,
      },
    );
    map.revokeAll();
    expect(revoke.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("resolves relative to entry directory and passes data/blob through", () => {
    const map = buildUrlMap(
      meta({ entry: "folder/cube.gltf" }),
      {
        "folder/cube.gltf": new Blob(["{}"]),
        "folder/cube.bin": new Blob([new Uint8Array(2)]),
      },
      {
        createObjectURL: () => "blob:mapped",
        revokeObjectURL: () => {},
      },
    );
    expect(map.modifier("cube.bin")).toBe("blob:mapped");
    expect(map.modifier("data:text/plain,hi")).toBe("data:text/plain,hi");
    // Loader-created blob URLs (embedded PNG bufferView) must pass through.
    expect(map.modifier("blob:already")).toBe("blob:already");
    expect(map.modifier("unknown.bin")).toBe("data:,");
    expect(map.modifier("//cdn.example/x")).toBe("data:,");
  });
});
