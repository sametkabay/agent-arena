/** Parse a coordinate field; empty/whitespace → NaN (never coerce to 0). */
export function parseCoordInput(raw: string): number {
  const trimmed = String(raw).trim();
  if (trimmed === "") return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

/** Always format with a period decimal, independent of browser locale. */
export function formatCoordValue(value: number): string {
  return value.toFixed(2);
}
