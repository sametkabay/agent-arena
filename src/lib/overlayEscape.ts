/**
 * Helpers so an open overlay menu (Select, etc.) can eat Escape without
 * dismissing a parent dialog that also listens for Escape.
 */

/** Call from an open-menu keydown handler (prefer capture phase on window). */
export function consumeEscapeForOpenMenu(e: {
  key: string;
  preventDefault(): void;
  stopPropagation(): void;
}): boolean {
  if (e.key !== "Escape") return false;
  e.preventDefault();
  e.stopPropagation();
  return true;
}

/** Parent dialog/overlay: only dismiss when Escape was not already handled. */
export function shouldDismissOnEscape(e: {
  key: string;
  defaultPrevented: boolean;
}): boolean {
  return e.key === "Escape" && !e.defaultPrevented;
}
