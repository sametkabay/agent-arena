import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FOCUSABLE_SELECTOR,
  canRestoreFocus,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
  shouldRestoreFocusAfterTrapCleanup,
} from "@/lib/focusTrap";
import { shouldDismissOnEscape } from "@/lib/overlayEscape";
import { useArenaStore } from "@/store/arenaStore";

type Props = {
  onCancel: () => void;
  onSuccess: () => void;
};

const TITLE_ID = "reset-playground-title";
const BODY_ID = "reset-playground-body";

export function ResetPlaygroundDialog({ onCancel, onSuccess }: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [keepModels, setKeepModels] = useState(false);

  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const customMaps = useArenaStore((s) => s.customMaps);
  const resetPlayground = useArenaStore((s) => s.resetPlayground);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);
  const setSettingsFocusExport = useArenaStore((s) => s.setSettingsFocusExport);
  const setMapId = useArenaStore((s) => s.setMapId);

  const keepId = useId();

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
    const resetBtn = focusable.find((el) =>
      el.classList.contains("btn--danger"),
    );
    (resetBtn ?? focusable[0])?.focus();

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

  function goBackup(target: "agents" | "models" | "map") {
    if (target === "map") {
      const s = useArenaStore.getState();
      const firstCustom = s.customMaps[0];
      if (!firstCustom) return;
      const activeIsCustom = s.customMaps.some((m) => m.id === s.mapId);
      if (!activeIsCustom) setMapId(firstCustom.id);
    }
    onCancel();
    setSettingsFocusExport(target);
    setSettingsTab(target);
  }

  function onConfirm() {
    if (busyRef.current) return;
    busyRef.current = true;
    const doneMsg = t("settings.general.reset.done");
    const result = resetPlayground({ keepModels });
    if (!result.ok) {
      busyRef.current = false;
      return;
    }
    // Disable after success path starts; dialog unmounts via onSuccess.
    setBusy(true);
    useArenaStore.getState().showToast(doneMsg);
    onSuccess();
  }

  return (
    <div
      className="confirm-dialog reset-playground-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      aria-describedby={BODY_ID}
      data-testid="reset-playground-dialog"
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        className="confirm-dialog__card reset-playground-dialog__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reset-playground-dialog__body">
          <h3 id={TITLE_ID} className="confirm-dialog__title">
            {t("settings.general.reset.confirmTitle")}
          </h3>
          <p id={BODY_ID} className="confirm-dialog__message">
            {t("settings.general.reset.confirmBody")}
          </p>
          <p className="settings-hint reset-playground-dialog__keeps">
            {t("settings.general.reset.keeps")}
          </p>

          <div className="reset-playground-dialog__backup">
            <strong>{t("settings.general.reset.backupTitle")}</strong>
            <p className="settings-hint">
              {t("settings.general.reset.backupHint")}
            </p>
            <div className="reset-playground-dialog__backup-actions">
              {agents.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="reset-backup-agents"
                  onClick={() => goBackup("agents")}
                >
                  {t("settings.general.reset.backupAgents")}
                </button>
              ) : null}
              {models.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="reset-backup-models"
                  onClick={() => goBackup("models")}
                >
                  {t("settings.general.reset.backupModels")}
                </button>
              ) : null}
              {customMaps.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  data-testid="reset-backup-maps"
                  onClick={() => goBackup("map")}
                >
                  {t("settings.general.reset.backupMaps")}
                </button>
              ) : null}
            </div>
            {customMaps.length > 0 ? (
              <p className="settings-hint">
                {t("settings.general.reset.backupMapsHint")}
              </p>
            ) : null}
          </div>

          <label
            className="reset-playground-dialog__check"
            htmlFor={keepId}
          >
            <input
              id={keepId}
              type="checkbox"
              checked={keepModels}
              onChange={(e) => setKeepModels(e.target.checked)}
              data-testid="reset-keep-models"
            />
            <span>
              <span className="reset-playground-dialog__check-label">
                {t("settings.general.reset.keepModels")}
              </span>
              <span className="settings-hint reset-playground-dialog__check-hint">
                {t("settings.general.reset.keepModelsHint")}
              </span>
            </span>
          </label>
        </div>

        <div className="confirm-dialog__actions reset-playground-dialog__footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {t("settings.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            data-testid="reset-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {t("settings.general.reset.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
