import { useEffect, useRef, type ReactNode } from "react";
import {
  FOCUSABLE_SELECTOR,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
} from "@/lib/focusTrap";
import { shouldDismissOnEscape } from "@/lib/overlayEscape";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  /** Dark chrome for map editor overlays. */
  variant?: "default" | "dark";
  /** Optional body slot (e.g. labeled rename field) inside the focus trap. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Compact confirmation overlay that matches settings/glass UI. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  variant = "default",
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    restoreFocusRef.current = rememberRestoreFocusTarget(
      restoreFocusRef.current,
      active,
    );
    const card = cardRef.current;
    const focusable = card
      ? Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    (focusable.find((el) => el.tagName === "INPUT") ?? focusable[0])?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (shouldDismissOnEscape(e)) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const nodes = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const current = document.activeElement;
      const activeIndex =
        current instanceof HTMLElement ? nodes.indexOf(current) : -1;
      const nextIndex = resolveFocusTrapWrapIndex(
        { key: e.key, shiftKey: e.shiftKey },
        nodes.length,
        activeIndex,
      );
      if (nextIndex !== null) {
        e.preventDefault();
        nodes[nextIndex]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className={
        "confirm-dialog" +
        (variant === "dark" ? " confirm-dialog--dark" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        className="confirm-dialog__card"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="confirm-dialog__title">
          {title}
        </h3>
        {message ? (
          <p className="confirm-dialog__message">{message}</p>
        ) : null}
        {children}
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={"btn " + (danger ? "btn--danger" : "btn--primary")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
