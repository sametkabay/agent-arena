import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";
import {
  hasGlbExtension,
  specFromMeta,
  validateGlbImport,
} from "@/lib/assets/userAssetValidation";
import type { UserAssetMeta } from "@/lib/types";

describe("hasGlbExtension", () => {
  it("accepts .glb and .gltf, case-insensitively", () => {
    expect(hasGlbExtension("Chair.glb")).toBe(true);
    expect(hasGlbExtension("chair.GLTF")).toBe(true);
    expect(hasGlbExtension("chair.png")).toBe(false);
    expect(hasGlbExtension("chair")).toBe(false);
  });
});

describe("validateGlbImport", () => {
  it("rejects a non-GLB file", () => {
    expect(validateGlbImport({ name: "chair.png", size: 100 }, 0)).toBe("invalidType");
  });

  it("rejects an empty file", () => {
    expect(validateGlbImport({ name: "chair.glb", size: 0 }, 0)).toBe("empty");
  });

  it("rejects a file over the size cap", () => {
    const tooBig = appConfig.userAssets.maxFileBytes + 1;
    expect(validateGlbImport({ name: "chair.glb", size: tooBig }, 0)).toBe("tooLarge");
  });

  it("rejects once the import count cap is reached", () => {
    expect(
      validateGlbImport({ name: "chair.glb", size: 100 }, appConfig.userAssets.maxCount),
    ).toBe("tooMany");
  });

  it("accepts a valid file under the caps", () => {
    expect(validateGlbImport({ name: "chair.glb", size: 100 }, 0)).toBeNull();
  });
});

describe("specFromMeta", () => {
  it("builds a placeable spec pointing at the given URL", () => {
    const meta: UserAssetMeta = {
      id: "user__abc",
      label: "My chair",
      category: "furniture",
      fileName: "chair.glb",
      size: 100,
      footprint: [0.6, 0.6],
      scale: 1,
      autoFit: "height",
      targetSize: 0.9,
      createdAt: 0,
    };
    const spec = specFromMeta(meta, "blob:mock-url");
    expect(spec).toEqual({
      label: "My chair",
      category: "furniture",
      pack: "user",
      footprint: [0.6, 0.6],
      glb: "blob:mock-url",
      scale: 1,
      autoFit: "height",
      targetSize: 0.9,
    });
  });
});
