/**
 * Resolve the stored zone name from an edit-field onChange value.
 *
 * The field shows a translated display name while the draft still holds the
 * English built-in default. If the typed value equals that translation (user
 * didn't meaningfully rename), keep the stored English default so saves /
 * exports / AI prompts stay locale-stable.
 */
export function zoneNameFromInput(opts: {
  typed: string;
  stored: string;
  displayName: string;
  /** Built-in JSON default; null/undefined → always store typed. */
  builtinDefault?: string | null;
}): string {
  const { typed, stored, displayName, builtinDefault } = opts;
  if (
    builtinDefault != null &&
    stored === builtinDefault &&
    typed === displayName &&
    displayName !== stored
  ) {
    return stored;
  }
  return typed;
}
