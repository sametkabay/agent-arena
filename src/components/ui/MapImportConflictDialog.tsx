import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FOCUSABLE_SELECTOR,
  canRestoreFocus,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
  shouldRestoreFocusAfterTrapCleanup,
} from "@/lib/focusTrap";
import { shouldDismissOnEscape } from "@/lib/overlayEscape";

type Props = {
  existingName: string;
  /** When overwriting the map open in the editor with unsaved edits. */
  warnUnsavedChanges?: boolean;
  onOverwrite: () => void;
  onCopy: () => void;
  onCancel: () => void;
};

/**
 * Accessible map-id collision dialog (#41).
 * Patterns match AgentImportDialog: focus trap, Esc=Cancel, StrictMode-safe
 * restore focus to the Import trigger.
 */
export function MapImportConflictDialog({
  existingName,
  warnUnsavedChanges = false,
  onOverwrite,
  onCopy,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const committingRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const active =
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  restoreFocusRef.current = rememberRestoreFocusTarget(
    restoreFocusRef.current,
    active,
  );

  useEffect(() => {
    const card = cardRef.current;
    copyBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (shouldDismissOnEscape(e)) {
        e.preventDefault();
        onCancelRef.current();
        return;
      }

      const liveCard = cardRef.current;
      if (!liveCard || e.key !== "Tab") return;

      const nodes = Array.from(
        liveCard.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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
    return () => {
      window.removeEventListener("keydown", onKey);
      if (!shouldRestoreFocusAfterTrapCleanup(card)) return;
      const prev = restoreFocusRef.current;
      if (canRestoreFocus(prev, (el) => document.contains(el))) {
        prev.focus();
      }
    };
  }, []);

  const runOnce = (action: () => void) => {
    if (committingRef.current) return;
    committingRef.current = true;
    action();
  };

  return (
    <div
      className="confirm-dialog map-import-conflict-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        className="confirm-dialog__card map-import-conflict-dialog__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="map-import-conflict-dialog__body">
          <h3 id={titleId} className="confirm-dialog__title">
            {t("settings.map.importConflict.title")}
          </h3>
          <p id={bodyId} className="confirm-dialog__message">
            {t("settings.map.importConflict.body", { name: existingName })}
            {warnUnsavedChanges ? (
              <>
                {" "}
                {t("settings.map.importConflict.unsavedWarning")}
              </>
            ) : null}
          </p>
        </div>
        <div className="confirm-dialog__actions map-import-conflict-dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t("settings.map.importConflict.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => runOnce(onOverwrite)}
          >
            {t("settings.map.importConflict.overwrite")}
          </button>
          <button
            ref={copyBtnRef}
            type="button"
            className="btn btn--primary"
            onClick={() => runOnce(onCopy)}
          >
            {t("settings.map.importConflict.copy")}
          </button>
        </div>
      </div>
    </div>
  );
}
