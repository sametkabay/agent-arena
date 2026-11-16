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
  isMapZone,
  isMapLightPoint,
  isRectZone,
  MAP_ZONE_KINDS,
  MAX_ZONES,
  MAX_LIGHTS,
  ZONE_NAME_MAX,
  ZONE_RADIUS_MIN,
  ZONE_RADIUS_DEFAULT,
  ZONE_SIZE_MIN,
  ZONE_SIZE_DEFAULT,
  LIGHT_INTENSITY_MIN,
  LIGHT_INTENSITY_MAX,
  LIGHT_INTENSITY_STEP,
  LIGHT_INTENSITY_DEFAULT,
  LIGHT_DISTANCE_MIN,
  LIGHT_DISTANCE_MAX,
  LIGHT_DISTANCE_DEFAULT,
  LIGHT_HEIGHT_MIN,
  LIGHT_HEIGHT_MAX,
  LIGHT_HEIGHT_DEFAULT,
  LIGHT_COLOR_DEFAULT,
} from "@/lib/maps/mapRegions";
export type {
  MapZone,
  MapZoneKind,
  MapLightPoint,
} from "@/lib/maps/mapRegions";
export {
  snapCoord,
  clampToFloor,
} from "@/lib/maps/floorBounds";
export {
  createZone,
  createLight,
  updateZone,
  updateLight,
  clampZoneToFloor,
  convertZoneToRect,
  sanitizeZoneName,
  nextZoneName,
  moveTargets,
  deleteTargets,
  clampRegionsToFloor,
  targetKind,
  canAddZone,
  canAddLight,
  normalizeHex,
  rectCompatRadius,
  zoneRadiusMax,
  zoneSizeMax,
  zonesEqual,
  lightsEqual,
} from "@/lib/maps/mapRegionEdit";
export type {
  ZonePatch,
  LightPatch,
  EditorTargetKind,
} from "@/lib/maps/mapRegionEdit";
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
