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
  onDelete,
  onToggleEnabled,
}: {
  agents: AgentConfig[];
  models: AiModelConfig[];
  onAdd: () => void;
  onEdit: (agent: AgentConfig) => void;
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
            return (
              <div
                key={a.id}
                className={"card-item" + (enabled ? "" : " is-disabled")}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    className="agent-list__swatch"
                    style={{ background: a.color }}
                    aria-hidden
                  />
                  <div>
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
                    onClick={() => onEdit(a)}
                  >
                    {t("settings.edit")}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => onDelete(a.id)}
                  >
                    {t("settings.delete")}
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
