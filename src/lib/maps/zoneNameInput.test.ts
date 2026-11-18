import { describe, expect, it } from "vitest";
import { zoneNameFromInput } from "@/lib/maps/zoneNameInput";

describe("zoneNameFromInput", () => {
  it("keeps the English default when typed equals the translated display", () => {
    expect(
      zoneNameFromInput({
        typed: "Loungebereich",
        stored: "Lounge",
        displayName: "Loungebereich",
        builtinDefault: "Lounge",
      }),
    ).toBe("Lounge");
  });

  it("stores a real rename", () => {
    expect(
      zoneNameFromInput({
        typed: "VIP Lounge",
        stored: "Lounge",
        displayName: "Loungebereich",
        builtinDefault: "Lounge",
      }),
    ).toBe("VIP Lounge");
  });

  it("stores typed value for custom / non-builtin zones", () => {
    expect(
      zoneNameFromInput({
        typed: "Workshop",
        stored: "Workshop",
        displayName: "Workshop",
        builtinDefault: null,
      }),
    ).toBe("Workshop");
  });

  it("stores typed when already customized away from the default", () => {
    expect(
      zoneNameFromInput({
        typed: "Loungebereich",
        stored: "VIP",
        displayName: "VIP",
        builtinDefault: "Lounge",
      }),
    ).toBe("Loungebereich");
  });
});
