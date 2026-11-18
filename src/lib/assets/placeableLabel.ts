import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import { isUserAssetId } from "@/lib/userAssets/ids";
import { foldText } from "@/lib/i18n/foldText";

type Translate = (key: string, options?: { defaultValue?: string }) => string;

/** i18n key for a built-in placeable label. */
export function placeableLabelKey(id: string): string {
  return `placeables.${id}`;
}

/**
 * Display label for a placeable id.
 * Built-ins use the active-locale translation (fallback: English catalog label).
 * Custom / imported models keep the user-authored name exactly.
 */
export function placeableDisplayLabel(
  id: string,
  t: Translate,
  englishFallback?: string,
): string {
  const english = englishFallback ?? PLACEABLE_SPECS[id]?.label ?? id;

  if (isUserAssetId(id) || !(id in PLACEABLE_SPECS)) {
    return english;
  }

  const translated = t(placeableLabelKey(id), { defaultValue: "" });
  return translated !== "" ? translated : english;
}

/** English catalog label for a built-in id (empty for unknown / custom). */
export function placeableEnglishLabel(id: string): string {
  return PLACEABLE_SPECS[id]?.label ?? "";
}

/**
 * Library search: match translated name, English name, or id
 * (case-insensitive, accent-tolerant).
 */
export function matchesPlaceableQuery(
  query: string,
  opts: {
    id: string;
    englishLabel: string;
    translatedLabel: string;
  },
): boolean {
  const q = foldText(query.trim());
  if (!q) return true;
  return (
    foldText(opts.translatedLabel).includes(q) ||
    foldText(opts.englishLabel).includes(q) ||
    foldText(opts.id).includes(q)
  );
}
