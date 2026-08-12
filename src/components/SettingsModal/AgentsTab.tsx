import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentConfig, AgentSkill } from "@/lib/types";
import {
  ALL_POLY_PRESETS,
  CUSTOM_PRESET,
  getPolyPreset,
  isCustomPreset,
} from "@/lib/poly/presets";
import { uid } from "@/lib/storage";
import { createAgentDraft, useArenaStore } from "@/store/arenaStore";
import { ColorField } from "@/components/ui/ColorField";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { clampChattiness } from "@/lib/storage";
import { useSettingsBack } from "@/components/SettingsModal/SettingsNavContext";

export function AgentsTab() {
  const { t } = useTranslation();
  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const upsertAgent = useArenaStore((s) => s.upsertAgent);
  const deleteAgent = useArenaStore((s) => s.deleteAgent);
  const showToast = useArenaStore((s) => s.showToast);
  const settingsFocusAgentId = useArenaStore((s) => s.settingsFocusAgentId);
  const clearSettingsFocusAgent = useArenaStore((s) => s.clearSettingsFocusAgent);

  const [editing, setEditing] = useState<AgentConfig | null>(null);
  useSettingsBack(editing != null, () => setEditing(null));

  useEffect(() => {
    if (!settingsFocusAgentId) return;
    const agent = agents.find((a) => a.id === settingsFocusAgentId);
    clearSettingsFocusAgent();
    if (!agent) return;
    setEditing({
      ...agent,
      enabled: agent.enabled !== false,
      thinkingEnabled: agent.thinkingEnabled === true,
      chattiness: clampChattiness(agent.chattiness),
      skills: agent.skills ?? [],
    });
  }, [settingsFocusAgentId, agents, clearSettingsFocusAgent]);

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
        thinkingEnabled: false,
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
      enabled: editing.enabled !== false,
      thinkingEnabled: editing.thinkingEnabled === true,
      chattiness: clampChattiness(editing.chattiness),
      skills: (editing.skills ?? [])
        .map((s) => ({
          ...s,
          name: s.name.trim(),
          content: s.content.trim(),
        }))
        .filter((s) => s.name || s.content),
      bio: editing.bio?.trim() || undefined,
    });
    setEditing(null);
    showToast(t("settings.saved"));
  }

  if (editing) {
    const skills = editing.skills ?? [];
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
        <div className="aa-toggle-card">
          <div className="aa-toggle-card__body">
            <div className="aa-toggle-card__title">{t("settings.agents.thinking")}</div>
            <p className="aa-toggle-card__hint">{t("settings.agents.thinkingHint")}</p>
          </div>
          <Switch
            checked={editing.thinkingEnabled === true}
            onChange={(checked) =>
              setEditing({ ...editing, thinkingEnabled: checked })
            }
            aria-label={t("settings.agents.thinking")}
          />
        </div>
        <div className="aa-chattiness">
          <div className="aa-chattiness__header">
            <div>
              <div className="aa-toggle-card__title">
                {t("settings.agents.chattiness")}
              </div>
              <p className="aa-toggle-card__hint">
                {t("settings.agents.chattinessHint")}
              </p>
            </div>
            <span className="aa-chattiness__value">
              {clampChattiness(editing.chattiness)}
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={clampChattiness(editing.chattiness)}
            onChange={(chattiness) => setEditing({ ...editing, chattiness })}
            aria-label={t("settings.agents.chattiness")}
          />
        </div>
        <label>
          {t("settings.agents.systemPrompt")}
          <textarea
            value={editing.systemPrompt}
            onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
          />
        </label>
        <div>
          <div className="header-row">
            <strong>{t("settings.agents.skills")}</strong>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setEditing({
                  ...editing,
                  skills: [
                    ...skills,
                    { id: uid("skill"), name: "", content: "" },
                  ],
                })
              }
            >
              {t("settings.agents.addSkill")}
            </button>
          </div>
          <p className="settings-hint">{t("settings.agents.skillsHint")}</p>
          {skills.length === 0 ? (
            <p className="settings-hint">{t("settings.agents.skillsEmpty")}</p>
          ) : (
            skills.map((skill, i) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                onChange={(next) => {
                  const nextSkills = skills.map((s, idx) => (idx === i ? next : s));
                  setEditing({ ...editing, skills: nextSkills });
                }}
                onRemove={() =>
                  setEditing({
                    ...editing,
                    skills: skills.filter((_, idx) => idx !== i),
                  })
                }
              />
            ))
          )}
        </div>
        <label>
          {t("settings.agents.color")}
          <ColorField
            value={editing.color}
            onChange={(color) => setEditing({ ...editing, color })}
            aria-label={t("settings.agents.color")}
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
                      {model?.name ?? "—"} · {t(role.nameKey)}
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
                    onChange={(next) =>
                      upsertAgent({
                        ...a,
                        enabled: next,
                        thinkingEnabled: a.thinkingEnabled === true,
                        chattiness: clampChattiness(a.chattiness),
                        skills: a.skills ?? [],
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() =>
                      setEditing({
                        ...a,
                        enabled: a.enabled !== false,
                        thinkingEnabled: a.thinkingEnabled === true,
                        chattiness: clampChattiness(a.chattiness),
                        skills: a.skills ?? [],
                      })
                    }
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

function SkillRow({
  skill,
  onChange,
  onRemove,
}: {
  skill: AgentSkill;
  onChange: (s: AgentSkill) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="skill-row">
      <div className="header-pair header-pair--name-action">
        <input
          placeholder={t("settings.agents.skillName")}
          value={skill.name}
          onChange={(e) => onChange({ ...skill, name: e.target.value })}
        />
        <button
          type="button"
          className="btn btn--danger btn--icon"
          aria-label={t("settings.delete")}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      <textarea
        placeholder={t("settings.agents.skillContent")}
        value={skill.content}
        onChange={(e) => onChange({ ...skill, content: e.target.value })}
      />
    </div>
  );
}
