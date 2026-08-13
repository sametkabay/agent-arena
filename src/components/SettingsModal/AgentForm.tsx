import { useTranslation } from "react-i18next";
import type { AgentConfig, AgentSkill, AiModelConfig } from "@/lib/types";
import {
  ALL_POLY_PRESETS,
  CUSTOM_PRESET,
  getPolyPreset,
  isCustomPreset,
} from "@/lib/poly/presets";
import {
  ALL_CHARACTERS,
  getCharacter,
} from "@/lib/assets/characters";
import { clampChattiness, uid } from "@/lib/storage";
import { ColorField } from "@/components/ui/ColorField";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { CharacterPreview } from "@/components/SettingsModal/CharacterPreview";

const SKILL_TEMPLATES = [
  {
    id: "coding",
    nameKey: "settings.agents.skillTemplates.coding.name",
    contentKey: "settings.agents.skillTemplates.coding.content",
  },
  {
    id: "docs",
    nameKey: "settings.agents.skillTemplates.docs.name",
    contentKey: "settings.agents.skillTemplates.docs.content",
  },
  {
    id: "tools",
    nameKey: "settings.agents.skillTemplates.tools.name",
    contentKey: "settings.agents.skillTemplates.tools.content",
  },
] as const;

function isStockBio(bio: string | undefined, characterId: string, roleId: string) {
  const trimmed = bio?.trim() ?? "";
  if (!trimmed) return true;
  const lookBio = getCharacter(characterId).defaultBio ?? "";
  const roleBio = getPolyPreset(roleId).defaultBio ?? "";
  return trimmed === lookBio || trimmed === roleBio;
}

export function AgentForm({
  editing,
  models,
  onChange,
}: {
  editing: AgentConfig;
  models: AiModelConfig[];
  onChange: (next: AgentConfig) => void;
}) {
  const { t } = useTranslation();
  const skills = editing.skills ?? [];

  function applyPreset(presetId: string) {
    const preset = getPolyPreset(presetId);
    const roleName = t(preset.nameKey);
    const custom = isCustomPreset(presetId);
    const prevRoleName = t(getPolyPreset(editing.polyPresetId).nameKey);
    const nameIsFromRole =
      !editing.displayName.trim() || editing.displayName.trim() === prevRoleName;
    const nextBio = custom
      ? editing.bio
      : isStockBio(editing.bio, editing.characterId, editing.polyPresetId)
        ? preset.defaultBio || editing.bio
        : editing.bio;

    onChange({
      ...editing,
      polyPresetId: presetId,
      displayName: custom
        ? nameIsFromRole
          ? ""
          : editing.displayName
        : nameIsFromRole
          ? roleName
          : editing.displayName,
      systemPrompt: custom
        ? editing.systemPrompt || CUSTOM_PRESET.defaultSystemPrompt
        : preset.defaultSystemPrompt,
      color: custom ? editing.color || preset.defaultColor : preset.defaultColor,
      bio: nextBio,
    });
  }

  function applyCharacter(characterId: string) {
    const nextLook = getCharacter(characterId);
    const nextBio = isStockBio(editing.bio, editing.characterId, editing.polyPresetId)
      ? nextLook.defaultBio || editing.bio
      : editing.bio;
    onChange({
      ...editing,
      characterId,
      bio: nextBio,
    });
  }

  function addSkill(seed?: { name: string; content: string }) {
    onChange({
      ...editing,
      skills: [
        ...(editing.skills ?? []),
        {
          id: uid("skill"),
          name: seed?.name ?? "",
          content: seed?.content ?? "",
        },
      ],
    });
  }

  return (
    <div className="form-grid">
      <label>
        {t("settings.agents.displayName")}
        <input
          value={editing.displayName}
          onChange={(e) => onChange({ ...editing, displayName: e.target.value })}
          placeholder={
            isCustomPreset(editing.polyPresetId)
              ? t("settings.agents.customRole")
              : undefined
          }
          autoFocus
        />
      </label>
      <label>
        {t("settings.agents.model")}
        <Select
          value={editing.modelConfigId}
          onChange={(v) => onChange({ ...editing, modelConfigId: v })}
          options={models.map((m) => ({ value: m.id, label: m.name }))}
        />
      </label>
      <p className="settings-hint settings-hint--inline">
        {t("settings.agents.rebuildNote")}
      </p>
      <div>
        <strong>{t("settings.agents.character")}</strong>
        <div className="h-scroll">
          <div className="h-scroll__track character-grid">
            {ALL_CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={
                  "character-card" +
                  (editing.characterId === c.id ? " is-selected" : "")
                }
                onClick={() => applyCharacter(c.id)}
              >
                <CharacterPreview characterId={c.id} />
                <div className="character-card__name">{t(c.nameKey)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <strong>{t("settings.agents.poly")}</strong>
        <div className="h-scroll">
          <div className="h-scroll__track poly-grid">
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
        <p className="settings-hint" style={{ marginTop: 8, marginBottom: 0 }}>
          {t("settings.agents.customRoleHint")}
        </p>
      </div>
      <label>
        {t("settings.agents.bio")}
        <span className="settings-hint settings-hint--inline">
          {t("settings.agents.bioHint")}
        </span>
        <textarea
          className="form-textarea--short"
          rows={3}
          value={editing.bio ?? ""}
          onChange={(e) => onChange({ ...editing, bio: e.target.value })}
          placeholder={t("settings.agents.bioPlaceholder")}
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
            onChange({ ...editing, thinkingEnabled: checked })
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
          onChange={(chattiness) => onChange({ ...editing, chattiness })}
          aria-label={t("settings.agents.chattiness")}
        />
      </div>
      <label>
        {t("settings.agents.systemPrompt")}
        <textarea
          value={editing.systemPrompt}
          onChange={(e) => onChange({ ...editing, systemPrompt: e.target.value })}
        />
      </label>
      <div>
        <strong>{t("settings.agents.skills")}</strong>
        <p className="settings-hint" style={{ marginTop: 4, marginBottom: 8 }}>
          {t("settings.agents.skillsHint")}
        </p>
        {skills.length === 0 ? (
          <div className="skill-empty">
            <p className="skill-empty__title">{t("settings.agents.skillsEmpty")}</p>
            <p className="skill-empty__hint">{t("settings.agents.skillsEmptyHint")}</p>
            <div className="skill-templates">
              {SKILL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="skill-template"
                  onClick={() =>
                    addSkill({ name: t(tpl.nameKey), content: t(tpl.contentKey) })
                  }
                >
                  {t(tpl.nameKey)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="skill-add"
              onClick={() => addSkill()}
            >
              {t("settings.agents.addSkill")}
            </button>
          </div>
        ) : (
          <>
            {skills.map((skill, i) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                autoFocus={i === skills.length - 1 && !skill.name && !skill.content}
                onChange={(next) => {
                  const nextSkills = skills.map((s, idx) => (idx === i ? next : s));
                  onChange({ ...editing, skills: nextSkills });
                }}
                onRemove={() =>
                  onChange({
                    ...editing,
                    skills: skills.filter((_, idx) => idx !== i),
                  })
                }
              />
            ))}
            <button
              type="button"
              className="skill-add"
              onClick={() => addSkill()}
            >
              {t("settings.agents.addSkill")}
            </button>
          </>
        )}
      </div>
      <label>
        {t("settings.agents.color")}
        <ColorField
          value={editing.color}
          onChange={(color) => onChange({ ...editing, color })}
          aria-label={t("settings.agents.color")}
        />
      </label>
    </div>
  );
}

function SkillRow({
  skill,
  autoFocus,
  onChange,
  onRemove,
}: {
  skill: AgentSkill;
  autoFocus?: boolean;
  onChange: (s: AgentSkill) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="skill-row">
      <div className="header-pair header-pair--name-action">
        <label className="skill-row__field">
          {t("settings.agents.skillName")}
          <input
            autoFocus={autoFocus}
            placeholder={t("settings.agents.skillNamePlaceholder")}
            value={skill.name}
            onChange={(e) => onChange({ ...skill, name: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn btn--danger btn--icon"
          aria-label={t("settings.delete")}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      <label className="skill-row__field">
        {t("settings.agents.skillBody")}
        <textarea
          placeholder={t("settings.agents.skillContent")}
          value={skill.content}
          onChange={(e) => onChange({ ...skill, content: e.target.value })}
        />
      </label>
    </div>
  );
}
