import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentConfig } from "@/lib/types";
import {
  ALL_POLY_PRESETS,
  CUSTOM_PRESET,
  getPolyPreset,
  isCustomPreset,
} from "@/lib/poly/presets";
import { createAgentDraft, useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";

export function AgentsTab() {
  const { t } = useTranslation();
  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const upsertAgent = useArenaStore((s) => s.upsertAgent);
  const deleteAgent = useArenaStore((s) => s.deleteAgent);
  const showToast = useArenaStore((s) => s.showToast);

  const [editing, setEditing] = useState<AgentConfig | null>(null);

  function startAdd() {
    if (models.length === 0) {
      showToast(t("settings.agents.needModel"));
      return;
    }
    const preset = getPolyPreset("explorer");
    setEditing(
      createAgentDraft({
        displayName: t(preset.nameKey),
        modelConfigId: models[0].id,
        polyPresetId: preset.id,
        systemPrompt: preset.defaultSystemPrompt,
        color: preset.defaultColor,
      }),
    );
  }

  function applyPreset(presetId: string) {
    if (!editing) return;
    const preset = getPolyPreset(presetId);
    const roleName = t(preset.nameKey);
    const custom = isCustomPreset(presetId);

    setEditing({
      ...editing,
      polyPresetId: presetId,
      // Built-in role → display name becomes the role. Custom → clear for typing.
      displayName: custom ? "" : roleName,
      systemPrompt: custom
        ? editing.systemPrompt || CUSTOM_PRESET.defaultSystemPrompt
        : preset.defaultSystemPrompt,
      color: custom ? editing.color || preset.defaultColor : preset.defaultColor,
    });
  }

  function save() {
    if (!editing) return;
    const name = editing.displayName.trim();
    if (!name || !editing.modelConfigId) return;
    upsertAgent({
      ...editing,
      displayName: name,
      bio: editing.bio?.trim() || undefined,
    });
    setEditing(null);
    showToast(t("settings.saved"));
  }

  if (editing) {
    return (
      <div className="form-grid">
        <p className="settings-hint">{t("settings.agents.rebuildNote")}</p>
        <p className="settings-hint">{t("settings.agents.customRoleHint")}</p>
        <div>
          <strong>{t("settings.agents.poly")}</strong>
          <div className="poly-grid" style={{ marginTop: 8 }}>
            {ALL_POLY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  "poly-card" + (editing.polyPresetId === p.id ? " is-selected" : "")
                }
                onClick={() => applyPreset(p.id)}
              >
                <div
                  className="poly-card__swatch"
                  style={{
                    background: `linear-gradient(145deg, ${p.defaultColor}, ${p.defaultColor}99)`,
                  }}
                />
                <div className="poly-card__name">{t(p.nameKey)}</div>
                <div className="poly-card__blurb">{t(p.blurbKey)}</div>
              </button>
            ))}
          </div>
        </div>
        <label>
          {t("settings.agents.displayName")}
          <input
            value={editing.displayName}
            onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
            placeholder={
              isCustomPreset(editing.polyPresetId)
                ? t("settings.agents.customRole")
                : undefined
            }
            autoFocus={isCustomPreset(editing.polyPresetId)}
          />
        </label>
        <label>
          {t("settings.agents.model")}
          <Select
            value={editing.modelConfigId}
            onChange={(v) => setEditing({ ...editing, modelConfigId: v })}
            options={models.map((m) => ({ value: m.id, label: m.name }))}
          />
        </label>
        <label>
          {t("settings.agents.systemPrompt")}
          <textarea
            value={editing.systemPrompt}
            onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
          />
        </label>
        <label>
          {t("settings.agents.color")}
          <input
            type="color"
            value={editing.color}
            onChange={(e) => setEditing({ ...editing, color: e.target.value })}
          />
        </label>
        <label>
          {t("settings.agents.bio")}
          <input
            value={editing.bio ?? ""}
            onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={save}>
            {t("settings.save")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
            {t("settings.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header-row">
        <p className="settings-hint" style={{ margin: 0 }}>
          {t("settings.agents.hint")}
        </p>
        <button type="button" className="btn btn--primary" onClick={startAdd}>
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
            return (
              <div key={a.id} className="card-item">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    className="agent-list__swatch"
                    style={{ background: a.color }}
                    aria-hidden
                  />
                  <div>
                    <div className="card-item__title">{a.displayName}</div>
                    <div className="card-item__sub">
                      {model?.name ?? "—"} · {t(role.nameKey)}
                    </div>
                  </div>
                </div>
                <div className="card-item__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setEditing({ ...a })}
                  >
                    {t("settings.edit")}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => deleteAgent(a.id)}
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
