import { describe, expect, it } from "vitest";
import {
  collectUserAssetIds,
  countUsage,
  shouldWarnExportMissingModels,
  stripPlaceableIds,
} from "@/lib/userAssets/cascade";
import { blankMap } from "@/lib/maps/schema";
import type { ArenaMapDefinition } from "@/lib/maps/schema";

const UA = "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const UB = "user:bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const UX = "user:cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function mapWith(
  id: string,
  name: string,
  placeableIds: string[],
): ArenaMapDefinition {
  const m = blankMap({
    id,
    name,
    floor: { size: 18, style: "surface", color: "#ccc", surface: "office" },
  });
  m.placeables = placeableIds.map((placeableId, i) => ({
    id: `p${i}`,
    placeableId,
    position: [i, 0, 0] as [number, number, number],
    rotationY: 0,
  }));
  return m;
}

describe("cascade helpers", () => {
  it("countUsage across maps and draft without double-counting", () => {
    const maps = [
      mapWith("m1", "Alpha", [UA, "chair", UA]),
      mapWith("m2", "Beta", [UB]),
    ];
    const draft = mapWith("m1", "Alpha", [UA]);
    const usage = countUsage(UA, maps, draft);
    expect(usage.maps).toEqual([{ id: "m1", name: "Alpha", count: 2 }]);
    expect(usage.draftCount).toBe(1);
    expect(usage.totalObjects).toBe(2);
    expect(usage.displayCount).toBe(2); // draft is saved map m1
  });

  it("displayCount adds draft when it is not a saved map", () => {
    const maps = [mapWith("m1", "Alpha", [UA, UA])];
    const draft = mapWith("draft", "Scratch", [UA]);
    const usage = countUsage(UA, maps, draft);
    expect(usage.displayCount).toBe(3);
  });

  it("stripPlaceableIds removes matching instances", () => {
    const m = mapWith("m", "M", [UA, "chair", UA]);
    const next = stripPlaceableIds(m, [UA]);
    expect(next.placeables).toHaveLength(1);
    expect(next.placeables[0]!.placeableId).toBe("chair");
  });

  it("collectUserAssetIds and export warning", () => {
    const m = mapWith("m", "M", ["chair", UX]);
    expect(collectUserAssetIds(m)).toEqual([UX]);
    expect(shouldWarnExportMissingModels(m)).toBe(true);
    expect(
      shouldWarnExportMissingModels(mapWith("n", "N", ["chair"])),
    ).toBe(false);
  });
});
