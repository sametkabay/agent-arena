const DOCK_MAX_WIDTH = 520;
const DOCK_VIEWPORT_GUTTER = 48;
/** Bottom offset used when the panel does not overlap the arena dock. */
const DESKTOP_EDGE_CLEARANCE = 18;
/**
 * Bottom clearance when the floating chat panel overlaps the centered dock.
 * Keeps the Say button and composer reachable (matches ChatPanel DOCK_CLEARANCE).
 */
const DOCK_OVERLAP_CLEARANCE = 112;

/**
 * Bottom clearance for the desktop (floating) chat panel default layout.
 * Returns a larger clearance when the panel would cover the arena dock.
 */
export function dockClearanceFor({
  panelLeft,
  panelWidth,
  viewportWidth,
}: {
  panelLeft: number;
  panelWidth: number;
  viewportWidth: number;
}): number {
  const dockWidth = Math.min(DOCK_MAX_WIDTH, viewportWidth - DOCK_VIEWPORT_GUTTER);
  const dockLeft = (viewportWidth - dockWidth) / 2;
  const dockRight = dockLeft + dockWidth;
  const panelRight = panelLeft + panelWidth;
  const overlaps = panelLeft < dockRight && panelRight > dockLeft;
  return overlaps ? DOCK_OVERLAP_CLEARANCE : DESKTOP_EDGE_CLEARANCE;
}
