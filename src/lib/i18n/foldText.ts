/**
 * Case- and accent-insensitive fold for search matching.
 * "café" / "CAFE" → "cafe". Only strips Latin diacritics (U+0300–036F) so
 * Japanese dakuten / other non-Latin marks stay intact.
 *
 * Turkish: maps both dotted İ and dotless ı to ASCII "i" so "ışık" / "Işık" /
 * "isik" all match (default toLowerCase alone leaves ı vs i mismatched).
 */
export function foldText(value: string): string {
  return (
    value
      // Capital İ → i before lowercasing avoids the "i" + combining-dot path.
      .replace(/İ/g, "i")
      .toLowerCase()
      .normalize("NFD")
      // Strip combining marks (incl. leftover dotted-i from İ → i̇).
      .replace(/[\u0300-\u036f]/g, "")
      .normalize("NFC")
      // Dotless ı (and any remaining) → ASCII i.
      .replace(/ı/g, "i")
  );
}
