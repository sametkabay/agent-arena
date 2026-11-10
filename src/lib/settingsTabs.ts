/** Minimal key event shape for settings tablist keyboard navigation. */
export type TabKeyEvent = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

/**
 * Resolves Left/Right/Up/Down/Home/End into the next tab index.
 * Returns null for other keys, any modifier, or when `count <= 0`.
 * Left/Right and Up/Down wrap; Home → 0; End → count - 1.
 */
export function resolveTabKeyIndex(
  event: TabKeyEvent,
  currentIndex: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;

  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp":
      return (currentIndex - 1 + count) % count;
    case "ArrowRight":
    case "ArrowDown":
      return (currentIndex + 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Scroll offset that centers a tab in a horizontal strip, clamped to the
 * reachable range `[0, scrollWidth - clientWidth]` (no-op when nothing overflows).
 */
export function centeredScrollLeft({
  tabLeft,
  tabWidth,
  stripClientWidth,
  stripScrollWidth,
}: {
  tabLeft: number;
  tabWidth: number;
  stripClientWidth: number;
  stripScrollWidth: number;
}): number {
  const maxScroll = Math.max(0, stripScrollWidth - stripClientWidth);
  const ideal = tabLeft + tabWidth / 2 - stripClientWidth / 2;
  return Math.min(maxScroll, Math.max(0, ideal));
}

/**
 * When focus leaves the tablist, return `selectedIndex` so roving tabindex
 * resets to the selected tab. Returns null while focus stays inside
 * (`relatedTargetInsideTablist === true`, e.g. arrowing between tabs).
 * Callers compute containment via `tablist.contains(relatedTarget)`.
 */
export function resolveTablistBlurFocusIndex(
  relatedTargetInsideTablist: boolean,
  selectedIndex: number,
): number | null {
  if (relatedTargetInsideTablist) return null;
  return selectedIndex;
}

/**
 * Which edges of a horizontal tab strip still have overflow content.
 * Used to drive edge-fade mask cues on phones.
 */
export function tabStripScrollEdges({
  scrollLeft,
  clientWidth,
  scrollWidth,
  epsilon = 1,
}: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  epsilon?: number;
}): { left: boolean; right: boolean } {
  return {
    left: scrollLeft > epsilon,
    right: scrollLeft + clientWidth < scrollWidth - epsilon,
  };
}

/** Space-separated `data-scroll-edge` value for left/right overflow cues. */
export function tabStripScrollEdgeAttr(edges: {
  left: boolean;
  right: boolean;
}): string {
  const parts: string[] = [];
  if (edges.left) parts.push("left");
  if (edges.right) parts.push("right");
  return parts.join(" ");
}
