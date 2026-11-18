export type {
  UserAssetKind,
  UserAssetFormat,
  UserAssetMeta,
  UserAssetFileMeta,
  UserAssetBBox,
  UserAssetErrorCode,
  StorageEstimate,
} from "@/lib/userAssets/types";
export { UserAssetError, isUserAssetError, classifyUserAssetError } from "@/lib/userAssets/errors";
export { isUserAssetId, makeUserAssetId, shortUserAssetLabel } from "@/lib/userAssets/ids";
export {
  computeFitScale,
  computeFootprint,
  clampTargetSize,
  bboxMaxExtent,
} from "@/lib/userAssets/scale";
export {
  parseGlb,
  parseGltfJson,
  collectUris,
  HARD_REJECT_EXTENSIONS,
  MAX_NODES,
  MAX_MESHES,
  MAX_ACCESSORS,
} from "@/lib/userAssets/gltfValidate";
export {
  classifyUri,
  planImport,
  importBlocked,
  normalizeRelPath,
  type SelectedFile,
  type ImportPlan,
  type UriClass,
} from "@/lib/userAssets/gltfUris";
export { gltfBounds } from "@/lib/userAssets/gltfBounds";
export { buildUrlMap, type UrlMap } from "@/lib/userAssets/buildUrlMap";
export {
  countUsage,
  stripPlaceableIds,
  stripUserAssetIds,
  collectUserAssetIds,
  shouldWarnExportMissingModels,
  type UsageCount,
} from "@/lib/userAssets/cascade";
export {
  resolveUserMeshState,
  selectUserMeshMeta,
  userMeshCacheKey,
  type UserMeshState,
} from "@/lib/userAssets/meshState";
export type { UserAssetBackend } from "@/lib/userAssets/backend";
export { createMemoryBackend } from "@/lib/userAssets/memoryBackend";
export {
  createIdbBackend,
  USER_ASSETS_DB,
  META_STORE,
  BLOBS_STORE,
} from "@/lib/userAssets/idbBackend";
export {
  createUserAssetStore,
  type UserAssetStore,
  type PutAssetInput,
} from "@/lib/userAssets/userAssetStore";
