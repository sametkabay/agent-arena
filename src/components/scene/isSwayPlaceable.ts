export function isSwayPlaceable(placeableId: string, category?: string): boolean {
  if ((category === "nature" || category === "space") && placeableId.includes("tree")) {
    return true;
  }
  if (/^tree_/.test(placeableId)) return true;
  if (placeableId === "camping__tree") return true;
  return false;
}
