import { describe, expect, it } from "vitest";
import {
  matchesPlaceableQuery,
  placeableDisplayLabel,
  placeableEnglishLabel,
  placeableLabelKey,
} from "@/lib/assets/placeableLabel";

describe("placeableLabel", () => {
  it("builds a stable i18n key", () => {
    expect(placeableLabelKey("desk")).toBe("placeables.desk");
  });

  it("returns the translation for built-ins", () => {
    const t = (key: string) => (key === "placeables.desk" ? "Schreibtisch" : "");
    expect(placeableDisplayLabel("desk", t)).toBe("Schreibtisch");
  });

  it("falls back to the English catalog label", () => {
    const t = () => "";
    expect(placeableDisplayLabel("desk", t)).toBe(placeableEnglishLabel("desk"));
    expect(placeableEnglishLabel("desk")).toBe("Desk workstation");
  });

  it("keeps custom / unknown ids as written (never translated)", () => {
    const t = (key: string) =>
      key.startsWith("placeables.") ? "TRANSLATED" : "should-not-use";
    expect(placeableDisplayLabel("user_abc123", t, "My Cube")).toBe("My Cube");
    expect(placeableDisplayLabel("not_a_real_id", t, "Weird")).toBe("Weird");
  });

  it("library search matches translated and English names", () => {
    expect(
      matchesPlaceableQuery("mülleimer", {
        id: "trash",
        englishLabel: "Trash can",
        translatedLabel: "Mülleimer",
      }),
    ).toBe(true);
    expect(
      matchesPlaceableQuery("trash", {
        id: "trash",
        englishLabel: "Trash can",
        translatedLabel: "Mülleimer",
      }),
    ).toBe(true);
    expect(
      matchesPlaceableQuery("ışık", {
        id: "floor_lamp",
        englishLabel: "Floor lamp",
        translatedLabel: "Lambader",
      }),
    ).toBe(false);
    expect(
      matchesPlaceableQuery("lambader", {
        id: "floor_lamp",
        englishLabel: "Floor lamp",
        translatedLabel: "Lambader",
      }),
    ).toBe(true);
  });

  it("matches translated name, English name, and custom name", () => {
    expect(
      matchesPlaceableQuery("schreibtisch", {
        id: "desk",
        englishLabel: "Desk workstation",
        translatedLabel: "Schreibtisch",
      }),
    ).toBe(true);
    expect(
      matchesPlaceableQuery("DESK", {
        id: "desk",
        englishLabel: "Desk workstation",
        translatedLabel: "Schreibtisch",
      }),
    ).toBe(true);
    expect(
      matchesPlaceableQuery("café", {
        id: "user_x",
        englishLabel: "Cafe Table",
        translatedLabel: "Cafe Table",
      }),
    ).toBe(true);
    expect(
      matchesPlaceableQuery("my cube", {
        id: "user_x",
        englishLabel: "My Cube",
        translatedLabel: "My Cube",
      }),
    ).toBe(true);
    expect(
      matchesPlaceableQuery("zzz", {
        id: "desk",
        englishLabel: "Desk workstation",
        translatedLabel: "Schreibtisch",
      }),
    ).toBe(false);
  });

  it("treats empty query as match-all", () => {
    expect(
      matchesPlaceableQuery("  ", {
        id: "desk",
        englishLabel: "Desk",
        translatedLabel: "Tisch",
      }),
    ).toBe(true);
  });
});
