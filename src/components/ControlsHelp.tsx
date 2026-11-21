import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CONTROLS_HELP_ROWS } from "@/lib/onboarding";
import {
  FOCUSABLE_SELECTOR,
  canRestoreFocus,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
  shouldRestoreFocusAfterTrapCleanup,
} from "@/lib/focusTrap";

type Props = {
  /** Auto-open mode shows "Don't show again" (default checked). */
  auto: boolean;
  onClose: (dontShowAgain: boolean) => void;
};

export function ControlsHelp({ auto, onClose }: Props) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Latest close inputs for the mount-only key listener (avoids re-running
  // cleanup, which would restore focus while the dialog is still open).
  const closeRef = useRef({ auto, dontShowAgain, onClose });
  closeRef.current = { auto, dontShowAgain, onClose };

  // Capture the opener during render — before autoFocus moves focus in commit.
  // useEffect would be too late (activeElement is already the Close button).
  const active =
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  restoreFocusRef.current = rememberRestoreFocusTarget(
    restoreFocusRef.current,
    active,
  );

  useEffect(() => {
    // Capture at effect start so StrictMode's simulated cleanup can detect that
    // the card is still mounted and skip restoring focus to the opener.
    const card = cardRef.current;
    const onKey = (e: KeyboardEvent) => {
      const { auto: isAuto, dontShowAgain: skip, onClose: close } = closeRef.current;
      if (e.key === "Escape") {
        close(isAuto ? skip : true);
        return;
      }

      const liveCard = cardRef.current;
      if (!liveCard || e.key !== "Tab") return;

      const focusable = Array.from(
        liveCard.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const active = document.activeElement;
      const activeIndex =
        active instanceof HTMLElement ? focusable.indexOf(active) : -1;
      const nextIndex = resolveFocusTrapWrapIndex(
        { key: e.key, shiftKey: e.shiftKey },
        focusable.length,
        activeIndex,
      );
      if (nextIndex !== null) {
        e.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Skip when the card is still connected (StrictMode re-run in dev).
      if (!shouldRestoreFocusAfterTrapCleanup(card)) return;
      const prev = restoreFocusRef.current;
      if (canRestoreFocus(prev, (el) => document.contains(el))) {
        prev.focus();
      }
    };
  }, []);

  const actionLabel = t("controlsHelp.action");
  const mouseLabel = t("controlsHelp.mouse");
  const touchLabel = t("controlsHelp.touch");
  const howLabel = t("controlsHelp.how");

  return (
    <div
      className="confirm-dialog controls-help"
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-help-title"
      onClick={() => onClose(auto ? dontShowAgain : true)}
    >
      <div
        ref={cardRef}
        className="confirm-dialog__card controls-help__card"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="controls-help-title" className="confirm-dialog__title">
          {t("controlsHelp.title")}
        </h3>
        <div className="controls-help__table-wrap">
          <table className="controls-help__table">
            <thead>
              <tr>
                <th scope="col">{actionLabel}</th>
                <th scope="col">{mouseLabel}</th>
                <th scope="col">{touchLabel}</th>
              </tr>
            </thead>
            <tbody>
              {CONTROLS_HELP_ROWS.map((row) => {
                const action = t(`controlsHelp.rows.${row.id}.action`);
                if (row.split) {
                  return (
                    <tr key={row.id}>
                      <td data-label={actionLabel}>{action}</td>
                      <td data-label={mouseLabel}>
                        {t(`controlsHelp.rows.${row.id}.mouse`)}
                      </td>
                      <td data-label={touchLabel}>
                        {t(`controlsHelp.rows.${row.id}.touch`)}
                      </td>
                    </tr>
                  );
                }
                const how = t(`controlsHelp.rows.${row.id}.how`, {
                  send: t("chat.arena.send"),
                  setting: t("settings.general.chatterMode"),
                  tab: t("settings.tabs.general"),
                });
                return (
                  <tr key={row.id}>
                    <td data-label={actionLabel}>{action}</td>
                    <td data-label={howLabel} colSpan={2}>
                      {how}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="controls-help__footer">
          {auto && (
            <label className="controls-help__dont-show">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                aria-label={t("onboarding.dontShowAgain")}
              />
              <span>{t("onboarding.dontShowAgain")}</span>
            </label>
          )}
          <div className="confirm-dialog__actions">
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => onClose(auto ? dontShowAgain : true)}
            >
              {t("settings.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
