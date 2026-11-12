import { useSyncExternalStore } from "react";
import {
  TOAST_BLOCKING_DIALOG_SELECTOR,
  resolveToastPlacement,
  toastPlacementClassName,
} from "@/lib/toastPlacement";

type ToastProps = {
  message: string;
};

function subscribeDialogOpen(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}

function getDialogOpen() {
  return !!document.querySelector(TOAST_BLOCKING_DIALOG_SELECTOR);
}

/**
 * Global toast host. While a confirm / bottom-sheet dialog (`.confirm-dialog`)
 * is open, placement switches to `above-modal` so the toast never covers the
 * action row. CSS `.app:has(.confirm-dialog) .toast` mirrors the same rule for
 * the first paint before the store subscription catches up.
 */
export function Toast({ message }: ToastProps) {
  const modalWithActionsOpen = useSyncExternalStore(
    subscribeDialogOpen,
    getDialogOpen,
    () => false,
  );
  const placement = resolveToastPlacement({ modalWithActionsOpen });
  const modifier = toastPlacementClassName(placement);

  return (
    <div
      className={modifier ? `toast ${modifier}` : "toast"}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
