/**
 * Display text for a built-in map's name or description.
 *
 * Shows the active-locale translation only while `stored` still equals the
 * built-in JSON default. Edited values, custom/imported maps, and missing
 * translations are returned as written — callers must not write the result
 * back into stored map data just because the locale changed.
 */
export function builtinDisplayText(opts: {
  stored: string;
  /** Built-in JSON default; omit/null for custom or imported maps. */
  builtinDefault?: string | null;
  /** Localized string for the active locale; omit/empty if missing. */
  translated?: string | null;
}): string {
  const { stored, builtinDefault, translated } = opts;
  // null/undefined → custom or imported (or caller opted out); "" is a valid default.
  if (builtinDefault == null) {
    return stored;
  }
  if (stored !== builtinDefault) {
    return stored;
  }
  if (translated != null && translated !== "") {
    return translated;
  }
  return stored;
}
