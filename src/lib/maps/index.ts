export { MAPS, getMap, mapsToMeta, shadowMapSize } from "@/lib/maps/types";
export type { MapId, MapMeta, MapTheme, ShadowQuality } from "@/lib/maps/types";
export { DEFAULT_GRAPHICS } from "@/lib/config";
export type {
  ArenaMapDefinition,
  MapFloor,
  MapSpawnPoint,
  MapInteractionKind,
  MapInteractionSeat,
  MapInteractionSpot,
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
export { MAP_PRESETS, createMapFromPreset } from "@/lib/maps/presets";
export type { MapPresetId, MapPresetMeta } from "@/lib/maps/presets";
