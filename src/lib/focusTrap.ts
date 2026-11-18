/** Minimal key event shape for pure focus-trap wrapping decisions. */
export type FocusTrapKeyEvent = {
  key: string;
  shiftKey: boolean;
};

/**
 * When Tab should wrap within a dialog, returns the focusable index to move to.
 * Returns null when the browser should handle Tab normally (or the key is not Tab).
 *
 * `activeIndex` is -1 when focus is outside the focusable set.
 */
export function resolveFocusTrapWrapIndex(
  event: FocusTrapKeyEvent,
  focusableCount: number,
  activeIndex: number,
): number | null {
  if (event.key !== "Tab" || focusableCount <= 0) return null;

  // Single control: always keep focus inside (prevent leaving the dialog).
  if (focusableCount === 1) return 0;

  if (event.shiftKey) {
    if (activeIndex <= 0) return focusableCount - 1;
    return null;
  }

  if (activeIndex < 0 || activeIndex >= focusableCount - 1) return 0;
  return null;
}

/** Selector for keyboard-focusable controls inside a dialog card. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Minimal shape for an element that can regain focus after a dialog closes. */
export type RestoreFocusTarget = {
  focus: () => void;
};

/**
 * Keep the first restore target. Later candidates (after autoFocus or effect
 * re-runs) must not overwrite the dialog opener.
 */
export function rememberRestoreFocusTarget<T extends RestoreFocusTarget>(
  previous: T | null,
  candidate: T | null,
): T | null {
  if (previous) return previous;
  return candidate;
}

/**
 * True when `el` can safely receive focus (still attached per `isAttached`).
 * Pass `document.contains.bind(document)` in the browser.
 */
export function canRestoreFocus<T extends RestoreFocusTarget>(
  el: T | null,
  isAttached: (node: T) => boolean,
): el is T {
  return !!el && typeof el.focus === "function" && isAttached(el);
}

/**
 * Whether effect cleanup should restore focus to the dialog opener.
 *
 * React StrictMode re-runs mount effect cleanup while the dialog DOM is still
 * connected. Skip restore in that case; on a real unmount the card is already
 * detached by the time cleanup runs.
 */
export function shouldRestoreFocusAfterTrapCleanup(
  card: { isConnected: boolean } | null | undefined,
): boolean {
  return !card?.isConnected;
}
