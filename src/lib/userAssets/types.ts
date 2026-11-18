/** Shared kinds — placeables (#7) and character looks (#8). */
export type UserAssetKind = "placeable" | "character";

export type UserAssetFormat = "glb" | "gltf";

export interface UserAssetFileMeta {
  path: string;
  size: number;
  mime: string;
}

export interface UserAssetBBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface UserAssetMeta {
  id: string;
  kind: UserAssetKind;
  name: string;
  format: UserAssetFormat;
  /** Entry file path inside `files` (e.g. "model.glb" or "scene.gltf"). */
  entry: string;
  files: UserAssetFileMeta[];
  totalBytes: number;
  /** http(s) URIs the user confirmed at import. */
  externalUris: string[];
  /** From glTF POSITION min/max; null if absent (measure on first load). */
  bbox: UserAssetBBox | null;
  /** Desired largest-axis size in meters (default 1). */
  targetSize: number;
  /** Stored scale = targetSize / max(bbox extents); 1 when bbox unknown. */
  fitScale: number;
  /** Footprint [x,z] after fitScale (meters). */
  footprint: [number, number];
  /** Bumps on replace so loaders invalidate. */
  rev: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserAssetBlobRecord {
  id: string;
  files: Record<string, Blob>;
}

export type UserAssetErrorCode =
  | "quota"
  | "unavailable"
  | "aborted"
  | "not_found"
  | "invalid";

export interface StorageEstimate {
  usage: number | null;
  quota: number | null;
}
