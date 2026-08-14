import { describe, expect, it } from "vitest";
import {
  FLOOR_SURFACE_IDS,
  applyFloorSurface,
  cellsForFloorSize,
  getFloorSurface,
  isFloorSurfaceId,
} from "@/lib/maps/floorSurfaces";
import {
  isMapLightPoint,
  isMapZone,
  mapWantsRoomLights,
  surfaceWantsRoomLights,
} from "@/lib/maps/mapRegions";
import { blankMap } from "@/lib/maps/schema";
import { appConfig } from "@/lib/config";

describe("floor surfaces", () => {
  it("looks up surfaces and applies them to a floor", () => {
    expect(FLOOR_SURFACE_IDS.length).toBeGreaterThan(0);
    expect(isFloorSurfaceId(FLOOR_SURFACE_IDS[0])).toBe(true);
    expect(isFloorSurfaceId("nope")).toBe(false);
    expect(getFloorSurface(undefined).id).toBeTruthy();
    const applied = applyFloorSurface(20, FLOOR_SURFACE_IDS[0]!);
    expect(applied.size).toBe(20);
    expect(applied.cells).toBe(cellsForFloorSize(20));
    expect(applied.color).toMatch(/^#/);
  });
});

describe("map regions", () => {
  it("validates zones and lights", () => {
    expect(isMapZone(null)).toBe(false);
    expect(
      isMapZone({
        id: "z",
        name: "Lounge",
        kind: "indoor",
        center: [0, 0, 0],
        radius: 3,
      }),
    ).toBe(true);
    expect(isMapLightPoint(null)).toBe(false);
    expect(
      isMapLightPoint({
        id: "l",
        position: [0, 1, 0],
        color: "#fff",
        intensity: 1,
        distance: 4,
      }),
    ).toBe(true);
  });

  it("decides room lights from surface or explicit flag", () => {
    const indoor = appConfig.maps.indoorSurfaces[0];
    if (indoor) expect(surfaceWantsRoomLights(indoor)).toBe(true);
    expect(surfaceWantsRoomLights(undefined)).toBe(false);
    const forced = blankMap({ roomLights: false, floor: { size: 16, style: "surface", color: "#000", surface: indoor } });
    expect(mapWantsRoomLights(forced)).toBe(false);
    const inferred = blankMap({ floor: { size: 16, style: "surface", color: "#000", surface: indoor } });
    expect(mapWantsRoomLights(inferred)).toBe(surfaceWantsRoomLights(indoor));
  });
});
