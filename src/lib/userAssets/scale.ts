import type { UserAssetBBox } from "@/lib/userAssets/types";

const DEFAULT_TARGET = 1;

/** Largest axis of a bbox; NaN/zero → null. */
export function bboxMaxExtent(bbox: UserAssetBBox | null | undefined): number | null {
  if (!bbox) return null;
  const dx = bbox.max[0] - bbox.min[0];
  const dy = bbox.max[1] - bbox.min[1];
  const dz = bbox.max[2] - bbox.min[2];
  const m = Math.max(dx, dy, dz);
  if (!Number.isFinite(m) || m <= 1e-8) return null;
  return m;
}

export function computeFitScale(
  bbox: UserAssetBBox | null | undefined,
  targetSize: number = DEFAULT_TARGET,
): number {
  const extent = bboxMaxExtent(bbox);
  const target =
    Number.isFinite(targetSize) && targetSize > 0 ? targetSize : DEFAULT_TARGET;
  if (extent == null) return 1;
  return target / extent;
}

/** Footprint [x, z] after applying fitScale. Falls back to 1×1. */
export function computeFootprint(
  bbox: UserAssetBBox | null | undefined,
  fitScale: number,
): [number, number] {
  const s = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
  if (!bbox) return [1, 1];
  const w = (bbox.max[0] - bbox.min[0]) * s;
  const d = (bbox.max[2] - bbox.min[2]) * s;
  return [
    Number.isFinite(w) && w > 0.05 ? w : 1,
    Number.isFinite(d) && d > 0.05 ? d : 1,
  ];
}

export function clampTargetSize(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_TARGET;
  return Math.min(50, Math.max(0.05, v));
}
