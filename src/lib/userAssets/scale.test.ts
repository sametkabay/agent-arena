import { describe, expect, it } from "vitest";
import {
  clampTargetSize,
  computeFitScale,
  computeFootprint,
} from "@/lib/userAssets/scale";

describe("scale helpers", () => {
  it("computes fitScale from largest axis", () => {
    const bbox = { min: [0, 0, 0] as [number, number, number], max: [2, 1, 0.5] as [number, number, number] };
    expect(computeFitScale(bbox, 1)).toBeCloseTo(0.5);
    expect(computeFootprint(bbox, 0.5)).toEqual([1, 0.25]);
  });

  it("returns 1 for null/zero/NaN bbox", () => {
    expect(computeFitScale(null)).toBe(1);
    expect(
      computeFitScale({
        min: [0, 0, 0],
        max: [0, 0, 0],
      }),
    ).toBe(1);
    expect(
      computeFitScale({
        min: [NaN, 0, 0],
        max: [1, 1, 1],
      }),
    ).toBe(1);
  });

  it("clamps target size", () => {
    expect(clampTargetSize(0)).toBe(0.05);
    expect(clampTargetSize(100)).toBe(50);
    expect(clampTargetSize(NaN)).toBe(1);
  });
});
