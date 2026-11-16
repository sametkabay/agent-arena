import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import {
  buildMapThumbnail,
  worldToView,
  MAP_THUMBNAIL_PROP_CAP,
} from "@/lib/maps/mapThumbnail";

describe("worldToView", () => {
  it("maps corners and center of a floor into the viewBox", () => {
    const size = 20;
    expect(worldToView(-10, -10, size)).toEqual({ x: 0, y: 0 });
    expect(worldToView(10, 10, size)).toEqual({ x: 20, y: 20 });
    expect(worldToView(0, 0, size)).toEqual({ x: 10, y: 10 });
    expect(worldToView(-10, 10, size)).toEqual({ x: 0, y: 20 });
    expect(worldToView(10, -10, size)).toEqual({ x: 20, y: 0 });
  });
});

describe("buildMapThumbnail", () => {
  it("sets viewBox/floor from the map size and surface color", () => {
    const def = blankMap({
      id: "t1",
      name: "Thumb",
      floor: {
        size: 20,
        style: "surface",
        color: "#ff0000",
        surface: "concrete",
      },
      theme: {
        floor: "#ff0000",
        accent: "#00ff00",
        background: "#abcdef",
        fog: "#ccc",
        ambient: "#fff",
        hemiSky: "#fff",
        hemiGround: "#888",
        sun: "#fff",
      },
    });
    const model = buildMapThumbnail(def, 96);
    expect(model.viewBox).toBe("0 0 96 96");
    expect(model.background).toBe("#abcdef");
    expect(model.floor).toMatchObject({ x: 0, y: 0, w: 96, h: 96 });
    expect(model.floor.fill).toBeTruthy();
    expect(model.floor.fill).not.toBe("#ff0000"); // surface color preferred
  });

  it("places rotated props and falls back for unknown placeables", () => {
    const def = blankMap({
      id: "t2",
      name: "Props",
      floor: { size: 10, style: "surface", color: "#ccc", surface: "office" },
      placeables: [
        {
          id: "p1",
          placeableId: "not_a_real_placeable_xyz",
          position: [0, 0, 0],
          rotationY: Math.PI / 2,
          scale: 2,
        },
      ],
      theme: {
        floor: "#ccc",
        accent: "#112233",
        background: "#eee",
        fog: "#ddd",
        ambient: "#fff",
        hemiSky: "#fff",
        hemiGround: "#888",
        sun: "#fff",
      },
    });
    const model = buildMapThumbnail(def, 100);
    expect(model.props).toHaveLength(1);
    const prop = model.props[0]!;
    expect(prop.fill).toBe("#888888");
    expect(prop.rotate).toBeCloseTo(-90);
    // footprint fallback 0.6 * scale 2 = 1.2 world → 12 view units at size 100/10
    expect(prop.w).toBeCloseTo(12);
    expect(prop.h).toBeCloseTo(12);
    expect(prop.x + prop.w / 2).toBeCloseTo(50);
    expect(prop.y + prop.h / 2).toBeCloseTo(50);
  });

  it("mirrors 3D rotationY so SVG matches the scene (π/4)", () => {
    const def = blankMap({
      id: "t2b",
      name: "Angle",
      floor: { size: 10, style: "surface", color: "#ccc", surface: "office" },
      placeables: [
        {
          id: "p1",
          placeableId: "not_a_real_placeable_xyz",
          position: [0, 0, 0],
          rotationY: Math.PI / 4,
        },
      ],
      theme: {
        floor: "#ccc",
        accent: "#112233",
        background: "#eee",
        fog: "#ddd",
        ambient: "#fff",
        hemiSky: "#fff",
        hemiGround: "#888",
        sun: "#fff",
      },
    });
    const model = buildMapThumbnail(def, 100);
    expect(model.props[0]!.rotate).toBeCloseTo(-45);
  });

  it("emits rect thumbnail fields (w/h, r:0) for sized zones", () => {
    const def = blankMap({
      id: "t-rect",
      name: "RectZones",
      floor: { size: 20, style: "surface", color: "#aaa", surface: "office" },
      zones: [
        {
          id: "z1",
          name: "Pad",
          kind: "custom",
          center: [0, 0, 0],
          radius: 2,
          size: [4, 6],
        },
      ],
      theme: {
        floor: "#aaa",
        accent: "#00ffaa",
        background: "#111",
        fog: "#222",
        ambient: "#fff",
        hemiSky: "#fff",
        hemiGround: "#888",
        sun: "#fff",
      },
    });
    const model = buildMapThumbnail(def, 100);
    expect(model.zones).toHaveLength(1);
    expect(model.zones[0]!.r).toBe(0);
    expect(model.zones[0]!.w).toBeCloseTo(20); // 4m * (100/20)
    expect(model.zones[0]!.h).toBeCloseTo(30); // 6m * (100/20)
    expect(model.zones[0]!.fill).toBe("#00ffaa");
  });

  it("caps props and paints zones with theme accent", () => {
    const placeables = Array.from({ length: MAP_THUMBNAIL_PROP_CAP + 25 }, (_, i) => ({
      id: `p${i}`,
      placeableId: "not_a_real_placeable_xyz",
      position: [0, 0, 0] as [number, number, number],
      rotationY: 0,
    }));
    const def = blankMap({
      id: "t3",
      name: "Busy",
      floor: { size: 16, style: "surface", color: "#aaa", surface: "office" },
      placeables,
      zones: [
        {
          id: "z1",
          name: "Pad",
          kind: "yard",
          center: [0, 0, 0],
          radius: 4,
        },
      ],
      theme: {
        floor: "#aaa",
        accent: "#ff00aa",
        background: "#111",
        fog: "#222",
        ambient: "#fff",
        hemiSky: "#fff",
        hemiGround: "#888",
        sun: "#fff",
      },
    });
    const model = buildMapThumbnail(def, 96);
    expect(model.props).toHaveLength(MAP_THUMBNAIL_PROP_CAP);
    expect(model.zones).toHaveLength(1);
    expect(model.zones[0]!.fill).toBe("#ff00aa");
    expect(model.zones[0]!.cx).toBeCloseTo(48);
    expect(model.zones[0]!.cy).toBeCloseTo(48);
    expect(model.zones[0]!.r).toBeCloseTo(24);
  });
});
