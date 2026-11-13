export { MAPS, getMap, mapsToMeta, shadowMapSize } from "@/lib/maps/types";
export type { MapId, MapMeta, MapTheme, ShadowQuality } from "@/lib/maps/types";
export { DEFAULT_GRAPHICS } from "@/lib/config";
export type {
  ArenaMapDefinition,
  MapFloor,
  MapSpawnPoint,
  FloorStyle,
} from "@/lib/maps/schema";
export {
  AAMF_VERSION,
  FLOOR_SIZE_MIN,
  FLOOR_SIZE_MAX,
  FLOOR_STYLES,
  blankMap,
  cloneMap,
  clampFloorSize,
  isArenaMapDefinition,
  isFloorStyle,
  migrateLegacyFloorStyle,
  migrateLegacyMapFloorStyles,
} from "@/lib/maps/schema";
export type { FloorSurfaceId, FloorPattern, FloorSurfaceSpec } from "@/lib/maps/floorSurfaces";
export {
  FLOOR_SURFACES,
  FLOOR_SURFACE_IDS,
  FLOOR_BORDER_METERS,
  FLOOR_TOP_Y,
  getFloorSurface,
  applyFloorSurface,
  cellsForFloorSize,
  isFloorSurfaceId,
} from "@/lib/maps/floorSurfaces";
export {
  BUILTIN_MAP_IDS,
  listBuiltinMaps,
  getBuiltinMap,
  resolveMapDefinition,
  buildMapRuntime,
  placeAgentsOnMap,
  syncRuntimeAgents,
  parseMapJson,
  exportMapJson,
  createCustomMapFromBuiltin,
  createBlankCustomMap,
  isBuiltinMapId,
} from "@/lib/maps/runtime";
export {
  mapWantsRoomLights,
  surfaceWantsRoomLights,
} from "@/lib/maps/mapRegions";
export type {
  MapZone,
  MapZoneKind,
  MapLightPoint,
} from "@/lib/maps/mapRegions";
export {
  MAP_PRESETS,
  createMapFromPreset,
  resolvePresetDefinition,
  presetTakenNames,
} from "@/lib/maps/presets";
export type {
  MapPresetId,
  MapPresetMeta,
  CreateMapFromPresetOptions,
} from "@/lib/maps/presets";
export {
  buildMapThumbnail,
  worldToView,
  MAP_THUMBNAIL_PROP_CAP,
} from "@/lib/maps/mapThumbnail";
export type {
  MapThumbnailModel,
  MapThumbnailFloor,
  MapThumbnailZone,
  MapThumbnailProp,
} from "@/lib/maps/mapThumbnail";
export {
  MAP_DESCRIPTION_MAX,
  clipMapDescription,
} from "@/lib/maps/clipMapDescription";
export {
  newCustomMapId,
  resolveImportedMapId,
  findMapIdCollision,
  prepareMapImport,
  buildMapImportCopy,
} from "@/lib/maps/importCollision";
export type {
  PreparedMapImport,
  MapImportCommitMode,
} from "@/lib/maps/importCollision";
