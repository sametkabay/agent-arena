import { describe, expect, it } from "vitest";
import {
  ASSET_CATEGORIES,
  getPlaceableSpec,
  isPlaceableId,
  listPlaceables,
  setUserPlaceableMetas,
  subscribeUserPlaceableMetas,
} from "@/lib/assets/placeableSpec";
import type { UserAssetMeta } from "@/lib/userAssets/types";

const U1 = "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const U2 = "user:bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const U3 = "user:cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const UMissing = "user:dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const meta = (id: string, name = "Cube"): UserAssetMeta => ({
  id,
  kind: "placeable",
  name,
  format: "glb",
  entry: "cube.glb",
  files: [],
  totalBytes: 1,
  externalUris: [],
  bbox: { min: [0, 0, 0], max: [1, 1, 1] },
  targetSize: 1,
  fitScale: 1,
  footprint: [1, 1],
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
});

describe("placeableSpec bridge", () => {
  it("includes custom category and lists user metas", () => {
    expect(ASSET_CATEGORIES).toContain("custom");
    setUserPlaceableMetas([
      meta(U1),
      { ...meta(U2), kind: "character" },
    ]);
    expect(listPlaceables("custom")).toEqual([U1]);
    expect(isPlaceableId(U1)).toBe(true);
    expect(getPlaceableSpec(U1)?.label).toBe("Cube");
    expect(getPlaceableSpec(UMissing)?.category).toBe("custom");
    expect(getPlaceableSpec("user:not-a-uuid")).toBeUndefined();
    expect(getPlaceableSpec("not-real")).toBeUndefined();
  });

  it("notifies subscribers", () => {
    let n = 0;
    const unsub = subscribeUserPlaceableMetas(() => {
      n += 1;
    });
    setUserPlaceableMetas([meta(U3)]);
    expect(n).toBe(1);
    unsub();
    setUserPlaceableMetas([]);
    expect(n).toBe(1);
  });
});
