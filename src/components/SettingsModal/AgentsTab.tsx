import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentConfig } from "@/lib/types";
import { getPolyPreset } from "@/lib/poly/presets";
import { DEFAULT_CHARACTER_ID, getCharacter } from "@/lib/assets/characters";
import { createAgentDraft, useArenaStore } from "@/store/arenaStore";
import { clampChattiness } from "@/lib/storage";
import {
  useSettingsBack,
  useSettingsHeaderSave,
} from "@/components/SettingsModal/settingsNav";
import { AgentForm } from "@/components/SettingsModal/AgentForm";
import { AgentList } from "@/components/SettingsModal/AgentList";

function agentFormKey(agent: AgentConfig): string {
  return JSON.stringify({
    displayName: agent.displayName,
    modelConfigId: agent.modelConfigId,
    polyPresetId: agent.polyPresetId,
    characterId: agent.characterId || DEFAULT_CHARACTER_ID,
    systemPrompt: agent.systemPrompt,
    enabled: agent.enabled !== false,
    thinkingEnabled: agent.thinkingEnabled === true,
    chattiness: clampChattiness(agent.chattiness),
    skills: (agent.skills ?? []).map((s) => ({
      name: s.name,
      content: s.content,
    })),
    color: agent.color,
    bio: agent.bio ?? "",
  });
}

function normalizeAgentForm(agent: AgentConfig): AgentConfig {
  return {
    ...agent,
    enabled: agent.enabled !== false,
    thinkingEnabled: agent.thinkingEnabled === true,
    chattiness: clampChattiness(agent.chattiness),
    skills: agent.skills ?? [],
    characterId: agent.characterId || DEFAULT_CHARACTER_ID,
  };
}

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
  const baselineKeyRef = useRef<string | null>(null);
  useSettingsBack(editing != null, () => setEditing(null));

  function openEditor(agent: AgentConfig, isNew: boolean) {
    const next = normalizeAgentForm(agent);
    baselineKeyRef.current = isNew ? null : agentFormKey(next);
    setEditing(next);
  }

  useEffect(() => {
    if (!settingsFocusAgentId) return;
    const agent = agents.find((a) => a.id === settingsFocusAgentId);
    clearSettingsFocusAgent();
    if (!agent) return;
    openEditor(agent, false);
  }, [settingsFocusAgentId, agents, clearSettingsFocusAgent]);

  function startAdd() {
    if (models.length === 0) {
      showToast(t("settings.agents.needModel"));
      return;
    }
    const preset = getPolyPreset("explorer");
    const look = getCharacter(DEFAULT_CHARACTER_ID);
    openEditor(
      createAgentDraft({
        displayName: t(preset.nameKey),
        modelConfigId: models[0].id,
        polyPresetId: preset.id,
        characterId: DEFAULT_CHARACTER_ID,
        systemPrompt: preset.defaultSystemPrompt,
        color: preset.defaultColor,
        bio: look.defaultBio || preset.defaultBio || "",
        thinkingEnabled: false,
      }),
      true,
    );
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

  const dirty =
    editing != null &&
    (baselineKeyRef.current === null ||
      agentFormKey(editing) !== baselineKeyRef.current);
  const saveDisabled = !editing?.displayName.trim() || !editing.modelConfigId;
  useSettingsHeaderSave(editing != null, dirty, save, saveDisabled);

  if (editing) {
    return (
      <AgentForm editing={editing} models={models} onChange={setEditing} />
    );
  }

  return (
    <AgentList
      agents={agents}
      models={models}
      onAdd={startAdd}
      onEdit={(agent) => openEditor(agent, false)}
      onDelete={(id) => deleteAgent(id)}
      onToggleEnabled={(a, next) =>
        upsertAgent({
          ...a,
          enabled: next,
          thinkingEnabled: a.thinkingEnabled === true,
          chattiness: clampChattiness(a.chattiness),
          skills: a.skills ?? [],
          characterId: a.characterId || DEFAULT_CHARACTER_ID,
        })
      }
    />
  );
}
