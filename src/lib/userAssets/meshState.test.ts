import { describe, expect, it } from "vitest";
import {
  resolveUserMeshState,
  selectUserMeshMeta,
  userMeshCacheKey,
} from "@/lib/userAssets/meshState";
import type { UserAssetMeta } from "@/lib/userAssets/types";

const meta: UserAssetMeta = {
  id: "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  kind: "placeable",
  name: "Cube",
  format: "glb",
  entry: "cube.glb",
  files: [],
  totalBytes: 1,
  externalUris: [],
  bbox: null,
  targetSize: 1,
  fitScale: 1,
  footprint: [1, 1],
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
};

describe("resolveUserMeshState", () => {
  it("ready when meta and entry blob exist", () => {
    expect(
      resolveUserMeshState(meta, { "cube.glb": new Blob(["x"]) }),
    ).toBe("ready");
  });

  it("missing without meta or entry", () => {
    expect(resolveUserMeshState(null, {})).toBe("missing");
    expect(resolveUserMeshState(meta, {})).toBe("missing");
  });

  it("error / unavailable flags", () => {
    expect(
      resolveUserMeshState(meta, { "cube.glb": new Blob(["x"]) }, { error: true }),
    ).toBe("error");
    expect(resolveUserMeshState(meta, null, { unavailable: true })).toBe(
      "unavailable",
    );
  });
});

describe("user mesh reactivity helpers", () => {
  it("selects meta by id and changes cache key on rev/fitScale", () => {
    expect(selectUserMeshMeta([meta], meta.id)).toEqual(meta);
    expect(selectUserMeshMeta([meta], "user:00000000-0000-4000-8000-000000000000")).toBeNull();
    const a = userMeshCacheKey(meta);
    const b = userMeshCacheKey({ ...meta, rev: 2 });
    const c = userMeshCacheKey({ ...meta, fitScale: 2, targetSize: 2 });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(userMeshCacheKey(null)).toBeNull();
  });
});
