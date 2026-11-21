import { useEffect, useRef, useState } from "react";
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
  onCancel: () => void;
  onConfirm: (includeApiKeys: boolean) => void;
};

const WARNING_ID = "model-export-keys-warning";

export function ModelExportDialog({ onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const [includeApiKeys, setIncludeApiKeys] = useState(false);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const active =
      typeof document !== "undefined" &&
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
    focusable[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (shouldDismissOnEscape(e)) {
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

  const confirmLabel = includeApiKeys
    ? t("settings.models.exportDialog.confirmWithKeys")
    : t("settings.models.exportDialog.confirm");

  return (
    <div
      className="confirm-dialog model-export-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-export-dialog-title"
      aria-describedby={includeApiKeys ? WARNING_ID : undefined}
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        className="confirm-dialog__card model-export-dialog__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="model-export-dialog__body">
          <h3
            id="model-export-dialog-title"
            className="confirm-dialog__title"
          >
            {t("settings.models.exportDialog.title")}
          </h3>

          <label className="model-export-dialog__check">
            <input
              type="checkbox"
              checked={includeApiKeys}
              onChange={(e) => setIncludeApiKeys(e.target.checked)}
              data-testid="model-export-include-keys"
            />
            <span>{t("settings.models.exportDialog.includeKeys")}</span>
          </label>

          {includeApiKeys ? (
            <p
              id={WARNING_ID}
              className="model-export-dialog__warning"
              role="alert"
              data-testid="model-export-keys-warning"
            >
              {t("settings.models.exportDialog.keysWarning")}
            </p>
          ) : null}
        </div>

        <div className="confirm-dialog__actions model-export-dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t("settings.models.exportDialog.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onConfirm(includeApiKeys)}
            data-testid="model-export-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
