/**
 * Pure guard for map-editor window hotkeys.
 * Skip when a modal dialog is open, Escape was already handled, or focus is in a field.
 */
export function shouldSkipEditorHotkey(
  e: { defaultPrevented: boolean },
  options: { suspended: boolean; targetTagName?: string | null },
): boolean {
  if (options.suspended) return true;
  if (e.defaultPrevented) return true;
  const tag = options.targetTagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
