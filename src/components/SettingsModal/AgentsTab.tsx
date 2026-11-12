import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentConfig } from "@/lib/types";
import { getPolyPreset } from "@/lib/poly/presets";
import { DEFAULT_CHARACTER_ID, getCharacter } from "@/lib/assets/characters";
import { createAgentDraft, useArenaStore } from "@/store/arenaStore";
import { clampChattiness } from "@/lib/storage";
import {
  ROSTER_LIMITS,
  RosterImportError,
  buildRosterExport,
  parseRosterImport,
  rosterExportFileName,
  type ImportedAgent,
} from "@/lib/agentRoster";
import {
  useSettingsBack,
  useSettingsHeaderSave,
} from "@/components/SettingsModal/settingsNav";
import { AgentForm } from "@/components/SettingsModal/AgentForm";
import { AgentList } from "@/components/SettingsModal/AgentList";
import { AgentImportDialog } from "@/components/SettingsModal/AgentImportDialog";

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
  const duplicateAgent = useArenaStore((s) => s.duplicateAgent);
  const importAgents = useArenaStore((s) => s.importAgents);
  const deleteAgent = useArenaStore((s) => s.deleteAgent);
  const showToast = useArenaStore((s) => s.showToast);
  const settingsFocusAgentId = useArenaStore((s) => s.settingsFocusAgentId);
  const clearSettingsFocusAgent = useArenaStore((s) => s.clearSettingsFocusAgent);

  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const baselineKeyRef = useRef<string | null>(null);
  const revealIdRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importBtnRef = useRef<HTMLButtonElement>(null);
  const confirmingRef = useRef(false);
  const [pendingImport, setPendingImport] = useState<{
    agents: ImportedAgent[];
    skipped: number;
  } | null>(null);
  useSettingsBack(editing != null, () => setEditing(null));

  useEffect(() => {
    const id = revealIdRef.current;
    if (!id) return;
    if (!agents.some((a) => a.id === id)) return;
    document.getElementById(`settings-agent-${id}`)?.scrollIntoView({
      block: "nearest",
    });
    revealIdRef.current = null;
  }, [agents]);

  function openEditor(agent: AgentConfig, isNew: boolean) {
    const next = normalizeAgentForm(agent);
    baselineKeyRef.current = isNew ? null : agentFormKey(next);
    setPendingImport(null);
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
    const result = upsertAgent({
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
    if (!result.ok) return;
    setEditing(null);
    showToast(t("settings.saved"));
  }

  function duplicate(agent: AgentConfig) {
    const copy = duplicateAgent(agent.id, t("settings.agents.copyLabel"));
    if (!copy) return;
    revealIdRef.current = copy.id;
    showToast(t("settings.agents.duplicated", { name: copy.displayName }));
  }

  function exportRoster() {
    if (agents.length === 0) {
      showToast(t("settings.agents.exportEmpty"));
      return;
    }
    try {
      const json = buildRosterExport(agents);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = rosterExportFileName();
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("settings.agents.exported"));
    } catch {
      showToast(t("settings.agents.exportFailed"));
    }
  }

  function startImport() {
    if (editing != null) return;
    if (models.length === 0) {
      showToast(t("settings.agents.needModel"));
      return;
    }
    fileRef.current?.click();
  }

  async function onImportFile(file: File) {
    if (file.size > ROSTER_LIMITS.maxFileBytes) {
      showToast(t("settings.agents.importDialog.errors.tooLarge"));
      return;
    }
    try {
      const text = await file.text();
      const result = parseRosterImport(text, {
        fileSize: file.size,
        existingCount: agents.length,
      });
      setPendingImport(result);
    } catch (err) {
      const code =
        err instanceof RosterImportError
          ? err.code
          : "invalidJson";
      showToast(t(`settings.agents.importDialog.errors.${code}`));
    }
  }

  function confirmImport(modelIds: string[]) {
    if (!pendingImport || confirmingRef.current) return;
    confirmingRef.current = true;
    const { agents: created, result } = importAgents(
      pendingImport.agents,
      modelIds,
      t("settings.agents.copyLabel"),
    );
    setPendingImport(null);
    confirmingRef.current = false;
    if (created.length === 0) {
      showToast(t("settings.agents.needModel"));
      importBtnRef.current?.focus();
      return;
    }
    if (!result.ok) {
      importBtnRef.current?.focus();
      return;
    }
    if (created[0]) revealIdRef.current = created[0].id;
    showToast(t("settings.agents.imported", { count: created.length }));
    importBtnRef.current?.focus();
  }

  const dirty =
    editing != null &&
    (baselineKeyRef.current === null ||
      agentFormKey(editing) !== baselineKeyRef.current);
  const saveDisabled = !editing?.displayName.trim() || !editing.modelConfigId;
  useSettingsHeaderSave(editing != null, dirty, save, saveDisabled);

  // Import is only on the list view, so it stays hidden while the edit form is open.
  if (editing) {
    return (
      <AgentForm editing={editing} models={models} onChange={setEditing} />
    );
  }

  return (
    <>
      <AgentList
        agents={agents}
        models={models}
        onAdd={startAdd}
        onExport={exportRoster}
        onImport={startImport}
        importButtonRef={importBtnRef}
        onEdit={(agent) => openEditor(agent, false)}
        onDuplicate={duplicate}
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
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.aa-agents.json"
        hidden
        data-testid="agent-roster-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          await onImportFile(f);
        }}
      />
      {pendingImport && (
        <AgentImportDialog
          agents={pendingImport.agents}
          skipped={pendingImport.skipped}
          models={models}
          onCancel={() => {
            setPendingImport(null);
            importBtnRef.current?.focus();
          }}
          onConfirm={confirmImport}
        />
      )}
    </>
  );
}
