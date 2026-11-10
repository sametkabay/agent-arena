import { useTranslation } from "react-i18next";
import type { AgentConfig, AiModelConfig } from "@/lib/types";
import { getPolyPreset } from "@/lib/poly/presets";
import { getCharacter } from "@/lib/assets/characters";
import { Switch } from "@/components/ui/Switch";

export function AgentList({
  agents,
  models,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleEnabled,
}: {
  agents: AgentConfig[];
  models: AiModelConfig[];
  onAdd: () => void;
  onEdit: (agent: AgentConfig) => void;
  onDuplicate: (agent: AgentConfig) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (agent: AgentConfig, enabled: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="header-row">
        <p className="settings-hint" style={{ margin: 0 }}>
          {t("settings.agents.hint")}
        </p>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          {t("settings.add")}
        </button>
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
                    <svg
                      className="card-item__action-icon"
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      focusable="false"
                    >
                      <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5.5 12.5 2.5 13.5l1-3z" />
                    </svg>
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
                    <svg
                      className="card-item__action-icon"
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      focusable="false"
                    >
                      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
                      <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    onClick={() => onDelete(a.id)}
                  >
                    <span className="card-item__action-label">{deleteLabel}</span>
                    <svg
                      className="card-item__action-icon"
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      focusable="false"
                    >
                      <path d="M3 4.5h10M6 4.5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4.5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-8" />
                    </svg>
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
