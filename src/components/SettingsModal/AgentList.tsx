import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import type { AgentConfig, AiModelConfig } from "@/lib/types";
import { getPolyPreset } from "@/lib/poly/presets";
import { getCharacter } from "@/lib/assets/characters";
import { Switch } from "@/components/ui/Switch";
import {
  DeleteActionIcon,
  DuplicateActionIcon,
  EditActionIcon,
} from "@/components/SettingsModal/CardActionIcons";

export function AgentList({
  agents,
  models,
  onAdd,
  onExport,
  onImport,
  importButtonRef,
  exportButtonRef,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleEnabled,
}: {
  agents: AgentConfig[];
  models: AiModelConfig[];
  onAdd: () => void;
  onExport: () => void;
  onImport: () => void;
  importButtonRef?: Ref<HTMLButtonElement>;
  exportButtonRef?: Ref<HTMLButtonElement>;
  onEdit: (agent: AgentConfig) => void;
  onDuplicate: (agent: AgentConfig) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (agent: AgentConfig, enabled: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="header-row agents-tab__header">
        <p className="settings-hint" style={{ margin: 0 }}>
          {t("settings.agents.hint")}
        </p>
        <div className="agents-tab__actions">
          <button
            ref={exportButtonRef}
            type="button"
            className="btn btn--ghost agents-tab__io-btn"
            aria-label={t("settings.agents.exportRosterAria")}
            data-testid="agent-export-btn"
            onClick={onExport}
          >
            {t("settings.agents.exportRoster")}
          </button>
          <button
            ref={importButtonRef}
            type="button"
            className="btn btn--ghost agents-tab__io-btn"
            aria-label={t("settings.agents.importRosterAria")}
            onClick={onImport}
          >
            {t("settings.agents.importRoster")}
          </button>
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            {t("settings.add")}
          </button>
        </div>
      </div>
      {agents.length === 0 ? (
        <p className="settings-hint">{t("settings.agents.empty")}</p>
      ) : (
        <div className="card-list">
          {agents.map((a) => {
            const model = models.find((m) => m.id === a.modelConfigId);
            const role = getPolyPreset(a.polyPresetId);
            const look = getCharacter(a.characterId);
            const skillCount = a.skills?.length ?? 0;
            const enabled = a.enabled !== false;
            const editLabel = t("settings.edit");
            const deleteLabel = t("settings.delete");
            const duplicateLabel = t("settings.agents.duplicate");
            const duplicateAria = t("settings.agents.duplicateAria", {
              name: a.displayName,
            });
            return (
              <div
                key={a.id}
                id={`settings-agent-${a.id}`}
                className={"card-item" + (enabled ? "" : " is-disabled")}
              >
                <div className="card-item__main">
                  <span
                    className="agent-list__swatch"
                    style={{ background: a.color }}
                    aria-hidden
                  />
                  <div className="card-item__text">
                    <div className="card-item__title">{a.displayName}</div>
                    <div className="card-item__sub">
                      {model?.name ?? "—"} · {t(look.nameKey)} · {t(role.nameKey)}
                      {a.thinkingEnabled ? ` · ${t("settings.agents.thinkingOn")}` : ""}
                      {skillCount > 0
                        ? ` · ${t("settings.agents.skillCount", { count: skillCount })}`
                        : ""}
                      {!enabled ? ` · ${t("settings.agents.inactive")}` : ""}
                    </div>
                  </div>
                </div>
                <div className="card-item__actions">
                  <Switch
                    checked={enabled}
                    aria-label={t("settings.agents.enabled")}
                    onChange={(next) => onToggleEnabled(a, next)}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost"
                    aria-label={editLabel}
                    title={editLabel}
                    onClick={() => onEdit(a)}
                  >
                    <span className="card-item__action-label">{editLabel}</span>
                    <EditActionIcon />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    aria-label={duplicateAria}
                    title={duplicateLabel}
                    onClick={() => onDuplicate(a)}
                  >
                    <span className="card-item__action-label">
                      {duplicateLabel}
                    </span>
                    <DuplicateActionIcon />
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    onClick={() => onDelete(a.id)}
                  >
                    <span className="card-item__action-label">{deleteLabel}</span>
                    <DeleteActionIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
