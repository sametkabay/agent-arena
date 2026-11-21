import { describe, expect, it } from "vitest";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import { BUILTIN_MAP_IDS, getBuiltinMap } from "@/lib/maps/runtime";
import { placeableLabelKey } from "@/lib/assets/placeableLabel";
import { builtinZoneNameKey } from "@/lib/maps/builtinRegionText";

const localeModules = import.meta.glob("../../i18n/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

function localeCode(path: string): string | null {
  return path.match(/\/([a-z]{2})\.json$/)?.[1] ?? null;
}

function dig(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Global leftover English fragments that must not appear in non-en labels. */
const ENGLISH_LEFTOVER_RE =
  /\b(can|tree|rock|plant|table|lamp|floor|Closed|Open|Wide|Hood|Coffee|Microwave|Cross|Rounded|Shower|Stairs|Side|Drawers|Small|Large|Big|Square|Round|Chair|Kitchen|Cream|Pot|Pan|Toaster|Ottoman|Laptop|Hotdog|Steak)\b/i;

/**
 * Asset-id hash junk like "-PImRvMqW1O" (≥8 alnum with both a digit and a letter).
 * Real hyphenated compounds (Design-Loungesessel) must not match.
 */
const HASH_JUNK_RE = /-(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{8,}/;

/**
 * Legitimate loanwords / shared terms per locale (whole-label or as words).
 * Keys are locale codes; values are case-insensitive word allowlists.
 */
const LOANWORD_ALLOW: Record<string, Set<string>> = {
  de: new Set([
    "suv",
    "taxi",
    "pizza",
    "burger",
    "donut",
    "hotdog",
    "cupcake",
    "steak",
    "couch",
    "monitor",
    "laptop",
    "radio",
    "toaster",
    "astronaut",
    "rover",
    "sofa",
    "design",
    "pod",
  ]),
  tr: new Set([
    "suv",
    "taxi",
    "taksi",
    "pizza",
    "burger",
    "donut",
    "cupcake",
    "rover",
    "lounge",
    "blender",
    "monitor",
    "monitör",
  ]),
  es: new Set([
    "suv",
    "taxi",
    "pizza",
    "burger",
    "donut",
    "cupcake",
    "radio",
    "monitor",
    "rover",
    "lounge",
    "vintage",
    // Spanish for bread:
    "pan",
  ]),
  fr: new Set([
    "suv",
    "taxi",
    "pizza",
    "burger",
    "donut",
    "cupcake",
    "soda",
    "radio",
    "rover",
    "lounge",
    "design",
    "vintage",
    // French nouns identical / natural:
    "table",
    "large",
    "pot",
  ]),
  pt: new Set([
    "suv",
    "taxi",
    "táxi",
    "pizza",
    "burger",
    "donut",
    "cupcake",
    "monitor",
    "rover",
    "lounge",
    "vintage",
  ]),
  ja: new Set(["suv"]),
  ko: new Set(["suv"]),
  ru: new Set(["suv", "rover"]),
  zh: new Set(["suv"]),
};

function leftoverHits(value: string, locale: string): string[] {
  const allow = LOANWORD_ALLOW[locale] ?? new Set<string>();
  const hits: string[] = [];
  for (const m of value.matchAll(
    /\b(can|tree|rock|plant|table|lamp|floor|Closed|Open|Wide|Hood|Coffee|Microwave|Cross|Rounded|Shower|Stairs|Side|Drawers|Small|Large|Big|Square|Round|Chair|Kitchen|Cream|Pot|Pan|Toaster|Ottoman|Laptop|Hotdog|Steak)\b/gi,
  )) {
    const word = m[0];
    if (allow.has(word.toLowerCase())) continue;
    // Whole-label loanwords that are exactly the allowlisted token.
    if (allow.has(value.toLowerCase())) continue;
    hits.push(word);
  }
  return hits;
}

describe("placeable / zone i18n coverage", () => {
  const locales = Object.entries(localeModules)
    .map(([path, data]) => {
      const code = localeCode(path);
      return code ? { code, data } : null;
    })
    .filter((x): x is { code: string; data: Record<string, unknown> } => !!x);

  it("loads all 10 locales", () => {
    expect(locales.map((l) => l.code).sort()).toEqual(
      ["de", "en", "es", "fr", "ja", "ko", "pt", "ru", "tr", "zh"].sort(),
    );
  });

  it("has a non-empty placeables.<id> for every built-in placeable", () => {
    const ids = Object.keys(PLACEABLE_SPECS);
    expect(ids.length).toBeGreaterThan(100);
    const missing: string[] = [];
    for (const { code, data } of locales) {
      for (const id of ids) {
        const val = dig(data, placeableLabelKey(id));
        if (typeof val !== "string" || val.trim() === "") {
          missing.push(`${code}:${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("has non-empty zone keys for every built-in region id (no per-id light keys)", () => {
    const missing: string[] = [];
    for (const mapId of BUILTIN_MAP_IDS) {
      const map = getBuiltinMap(mapId);
      expect(map).toBeTruthy();
      for (const z of map!.zones ?? []) {
        for (const { code, data } of locales) {
          const val = dig(data, builtinZoneNameKey(mapId, z.id));
          if (typeof val !== "string" || val.trim() === "") {
            missing.push(`${code}:zone:${mapId}/${z.id}`);
          }
        }
      }
      for (const { code, data } of locales) {
        const lights = dig(data, `maps.${mapId}.lights`);
        if (lights != null) {
          missing.push(`${code}:lights-should-be-absent:${mapId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("rejects hash junk in placeable labels (all locales)", () => {
    const bad: string[] = [];
    for (const { code, data } of locales) {
      for (const id of Object.keys(PLACEABLE_SPECS)) {
        const val = dig(data, placeableLabelKey(id));
        if (typeof val !== "string") continue;
        if (HASH_JUNK_RE.test(val)) bad.push(`${code}:${id}=${val}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("rejects leftover English words in non-en placeable labels", () => {
    const bad: string[] = [];
    for (const { code, data } of locales) {
      if (code === "en") continue;
      for (const id of Object.keys(PLACEABLE_SPECS)) {
        const val = dig(data, placeableLabelKey(id));
        if (typeof val !== "string") continue;
        const hits = leftoverHits(val, code);
        if (hits.length) bad.push(`${code}:${id}=${val} [${hits.join(",")}]`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("english leftover regex is wired (sanity)", () => {
    expect(ENGLISH_LEFTOVER_RE.test("Trash can")).toBe(true);
    expect(ENGLISH_LEFTOVER_RE.test("Mülleimer")).toBe(false);
    expect(ENGLISH_LEFTOVER_RE.test("Toaster")).toBe(true);
    expect(ENGLISH_LEFTOVER_RE.test("Ottoman")).toBe(true);
    expect(leftoverHits("Toaster", "es")).toEqual(["Toaster"]);
    expect(leftoverHits("Ottoman", "fr")).toEqual(["Ottoman"]);
    expect(leftoverHits("Tostadora", "es")).toEqual([]);
    expect(leftoverHits("Pouf", "fr")).toEqual([]);
  });

  it("hash junk regex requires digit+letter (hyphenated words pass)", () => {
    expect(HASH_JUNK_RE.test("Lounge Chair-PImRvMqW1O")).toBe(true);
    expect(HASH_JUNK_RE.test("Design-Loungesessel")).toBe(false);
    expect(HASH_JUNK_RE.test("Vintage-Fernseher")).toBe(false);
    expect(HASH_JUNK_RE.test("Table-Rectangular")).toBe(false);
  });
});
