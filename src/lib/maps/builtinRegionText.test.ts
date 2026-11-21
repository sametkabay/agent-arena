import { describe, expect, it } from "vitest";
import {
  builtinLightDisplayName,
  builtinZoneDisplayName,
  builtinZoneNameKey,
  lightDisplayName,
  lightListIndex,
  zoneDisplayName,
} from "@/lib/maps/builtinRegionText";
import { getBuiltinMap } from "@/lib/maps/runtime";
import type { MapLightPoint, MapZone } from "@/lib/maps/mapRegions";

describe("builtinRegionText", () => {
  const tZone = (key: string, opts?: Record<string, unknown>) => {
    if (key === "maps.office.zones.zone_lounge") return "Loungebereich";
    if (key === "mapEditor.lightListItem") return `Licht ${opts?.n}`;
    return (opts?.defaultValue as string) ?? "";
  };

  it("exposes stable zone keys", () => {
    expect(builtinZoneNameKey("office", "zone_lounge")).toBe(
      "maps.office.zones.zone_lounge",
    );
  });

  it("translates a zone while stored equals the built-in default", () => {
    expect(
      builtinZoneDisplayName({
        stored: "Lounge",
        mapId: "office",
        zoneId: "zone_lounge",
        builtinDefault: "Lounge",
        t: tZone,
      }),
    ).toBe("Loungebereich");
  });

  it("keeps a renamed zone as stored", () => {
    expect(
      builtinZoneDisplayName({
        stored: "VIP Lounge",
        mapId: "office",
        zoneId: "zone_lounge",
        builtinDefault: "Lounge",
        t: tZone,
      }),
    ).toBe("VIP Lounge");
  });

  it("keeps custom maps as stored (no builtin default)", () => {
    expect(
      builtinZoneDisplayName({
        stored: "Workshop",
        mapId: "custom_1",
        zoneId: "z1",
        builtinDefault: null,
        t: tZone,
      }),
    ).toBe("Workshop");
  });

  it("names lights by 1-based list index via lightListItem", () => {
    expect(builtinLightDisplayName({ index: 3, t: tZone })).toBe("Licht 3");
    expect(builtinLightDisplayName({ index: 1, t: tZone })).toBe("Licht 1");
  });

  it("lightListIndex is 1-based and 0 when missing", () => {
    const office = getBuiltinMap("office")!;
    const id = office.lights![2]!.id;
    expect(lightListIndex(office.lights, id)).toBe(3);
    expect(lightListIndex(office.lights, "missing")).toBe(0);
    expect(lightListIndex(undefined, id)).toBe(0);
  });

  it("zoneDisplayName / lightDisplayName wrap draft + builtin base", () => {
    const office = getBuiltinMap("office")!;
    const lounge = office.zones!.find((z) => z.id === "zone_lounge")!;
    expect(zoneDisplayName(lounge, office, office, tZone)).toBe("Loungebereich");

    const renamed: MapZone = { ...lounge, name: "VIP" };
    expect(zoneDisplayName(renamed, office, office, tZone)).toBe("VIP");

    const customDraft = { ...office, builtin: false, id: "custom_1" };
    expect(zoneDisplayName(lounge, customDraft, null, tZone)).toBe(lounge.name);

    const light = office.lights![2] as MapLightPoint;
    expect(lightDisplayName(light, office, 3, tZone)).toBe("Licht 3");
  });
});
