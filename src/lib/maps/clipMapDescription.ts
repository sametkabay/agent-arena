export const MAP_DESCRIPTION_MAX = 80;

/** Truncate a map card description for the Settings list / preset gallery. */
export function clipMapDescription(text: string): string {
  if (text.length <= MAP_DESCRIPTION_MAX) return text;
  return `${text.slice(0, MAP_DESCRIPTION_MAX - 1).trimEnd()}…`;
}
