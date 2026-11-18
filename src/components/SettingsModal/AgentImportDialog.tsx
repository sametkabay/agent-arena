import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig } from "@/lib/types";
import type { ImportedAgent } from "@/lib/agentRoster";
import { applyAllModelIds } from "@/lib/agentRoster";
import {
  FOCUSABLE_SELECTOR,
  canRestoreFocus,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
  shouldRestoreFocusAfterTrapCleanup,
} from "@/lib/focusTrap";
import { remapModelIds } from "@/lib/agentRoster";
import { shouldDismissOnEscape } from "@/lib/overlayEscape";
import { Select } from "@/components/ui/Select";

type Props = {
  agents: ImportedAgent[];
  skipped: number;
  models: AiModelConfig[];
  onCancel: () => void;
  onConfirm: (modelIds: string[]) => void;
};

export function AgentImportDialog({
  agents,
  skipped,
  models,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const defaultModelId = models[0]?.id ?? "";
  const [modelIds, setModelIds] = useState(() =>
    applyAllModelIds(agents.length, defaultModelId),
  );
  const [applyAll, setApplyAll] = useState(defaultModelId);

  const modelOptions = useMemo(
    () => models.map((m) => ({ value: m.id, label: m.name })),
    [models],
  );

  useEffect(() => {
    const availableIds = models.map((m) => m.id);
    setModelIds((prev) => remapModelIds(prev, availableIds));
    setApplyAll((prev) => remapModelIds([prev], availableIds)[0] ?? "");
  }, [models]);

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

  function setAll(modelId: string) {
    setApplyAll(modelId);
    setModelIds(applyAllModelIds(agents.length, modelId));
  }

  function setOne(index: number, modelId: string) {
    setModelIds((prev) => prev.map((id, i) => (i === index ? modelId : id)));
  }

  const count = agents.length;

  return (
    <div
      className="confirm-dialog agent-import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-import-dialog-title"
      aria-describedby="agent-import-dialog-summary"
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        className="confirm-dialog__card agent-import-dialog__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="agent-import-dialog__body">
          <h3
            id="agent-import-dialog-title"
            className="confirm-dialog__title"
          >
            {t("settings.agents.importDialog.title")}
          </h3>
          <p
            id="agent-import-dialog-summary"
            className="confirm-dialog__message agent-import-dialog__summary"
          >
            {t("settings.agents.importDialog.summary", { count })}
            {skipped > 0
              ? ` ${t("settings.agents.importDialog.skipped", { count: skipped })}`
              : ""}
          </p>

          <label className="agent-import-dialog__apply-all">
            <span>{t("settings.agents.importDialog.applyAll")}</span>
            <Select
              value={applyAll}
              options={modelOptions}
              onChange={setAll}
              aria-label={t("settings.agents.importDialog.applyAll")}
            />
          </label>

          <ul className="agent-import-dialog__list">
            {agents.map((agent, index) => (
              <li key={`${agent.displayName}-${index}`} className="agent-import-dialog__row">
                <span
                  className="agent-list__swatch"
                  style={{ background: agent.color }}
                  aria-hidden
                />
                <span className="agent-import-dialog__name">
                  {agent.displayName}
                </span>
                <Select
                  value={modelIds[index] ?? defaultModelId}
                  options={modelOptions}
                  onChange={(id) => setOne(index, id)}
                  aria-label={t("settings.agents.importDialog.modelFor", {
                    name: agent.displayName,
                  })}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="confirm-dialog__actions agent-import-dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t("settings.agents.importDialog.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onConfirm(modelIds)}
          >
            {t("settings.agents.importDialog.confirm", { count })}
          </button>
        </div>
      </div>
    </div>
  );
}
