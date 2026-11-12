/**
 * Toast placement relative to modal / bottom-sheet dialogs with action rows.
 * Mobile toasts anchor near the bottom; those dialogs also sit at the bottom,
 * so a leftover (or in-dialog) toast can cover Overwrite / Cancel / Import.
 */

export type ToastPlacement = "standard" | "above-modal";

export type ToastPlacementInput = {
  /** True when a confirm / conflict / import dialog (`.confirm-dialog`) is open. */
  modalWithActionsOpen: boolean;
};

/**
 * Prefer top anchoring while a modal/bottom-sheet with actions is open so the
 * toast never covers the action row. New toasts raised by the dialog itself
 * (e.g. quota failure) stay visible — they just move above the sheet.
 */
export function resolveToastPlacement(
  input: ToastPlacementInput,
): ToastPlacement {
  return input.modalWithActionsOpen ? "above-modal" : "standard";
}

/** Extra class on `.toast` for the non-standard placement (empty when standard). */
export function toastPlacementClassName(placement: ToastPlacement): string {
  return placement === "above-modal" ? "toast--above-modal" : "";
}

/**
 * Selector for dialogs that own an action footer (ConfirmDialog,
 * MapImportConflictDialog, AgentImportDialog). Settings uses a different
 * root and is intentionally excluded.
 */
export const TOAST_BLOCKING_DIALOG_SELECTOR = ".confirm-dialog";
