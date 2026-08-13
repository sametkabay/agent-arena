import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig, AiProviderKind } from "@/lib/types";
import { fetchModels, providerDefaults, testConnection } from "@/lib/ai/providers";
import { createModelDraft, useArenaStore } from "@/store/arenaStore";
import { useSettingsBack } from "@/components/SettingsModal/SettingsNavContext";
import { ModelForm } from "@/components/SettingsModal/ModelForm";
import { ModelList, groupModels } from "@/components/SettingsModal/ModelList";

type FormMode = "full" | "llm";

export function ModelsTab() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const upsertModel = useArenaStore((s) => s.upsertModel);
  const deleteModel = useArenaStore((s) => s.deleteModel);
  const showToast = useArenaStore((s) => s.showToast);

  const [editing, setEditing] = useState<AiModelConfig | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("full");
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<"fetch" | "test" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [usedModelIds, setUsedModelIds] = useState<string[]>([]);

  function closeForm() {
    setEditing(null);
    setFormMode("full");
    setFetched(null);
    setStatus(null);
    setUsedModelIds([]);
  }

  useSettingsBack(editing != null, closeForm);

  const draft = editing;
  const groups = useMemo(() => groupModels(models), [models]);

  function startAdd() {
    const defs = providerDefaults("openai");
    const d = createModelDraft(defs);
    setFormMode("full");
    setEditing(d);
    setFetched(null);
    setStatus(null);
  }

  function startAddLlm(source: AiModelConfig, takenIds: string[]) {
    const d = createModelDraft({
      provider: source.provider,
      baseUrl: source.baseUrl,
      apiKey: source.apiKey,
      extraHeaders: source.extraHeaders.map((h) => ({ ...h })),
      name: "",
      modelId: "",
    });
    setFormMode("llm");
    setEditing(d);
    setFetched(null);
    setStatus(null);
    setUsedModelIds(takenIds);
    void onFetchModels(d, takenIds);
  }

  function onProviderChange(provider: AiProviderKind) {
    if (!draft) return;
    const defs = providerDefaults(provider);
    setEditing({
      ...draft,
      provider,
      name: defs.name,
      baseUrl: defs.baseUrl,
      modelId: defs.modelId,
    });
    setFetched(null);
  }

  async function onFetchModels(current = draft, taken = usedModelIds) {
    if (!current) return;
    setBusy("fetch");
    setStatus(null);
    try {
      const list = await fetchModels(current);
      setFetched(list);
      if (list.length) {
        const pick =
          (current.modelId && list.includes(current.modelId)
            ? current.modelId
            : list.find((id) => !taken.includes(id))) ?? list[0];
        setEditing((prev) => {
          if (!prev || prev.id !== current.id) return prev;
          return {
            ...prev,
            modelId: pick,
            name: prev.name.trim() ? prev.name : pick,
          };
        });
      }
      setStatus({ ok: true, detail: `Found ${list.length} model(s)` });
    } catch (e) {
      setFetched(null);
      setStatus({ ok: false, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    if (!draft) return;
    setBusy("test");
    const result = await testConnection(draft);
    setStatus(result);
    setBusy(null);
  }

  function save() {
    if (!draft) return;
    const modelId = draft.modelId.trim();
    const name = draft.name.trim() || modelId;
    if (!name || !draft.baseUrl.trim() || !modelId) return;
    upsertModel({
      ...draft,
      name,
      baseUrl: draft.baseUrl.trim(),
      modelId,
      apiKey: draft.apiKey?.trim() || undefined,
      extraHeaders: draft.extraHeaders.filter((h) => h.key.trim()),
    });
    closeForm();
    showToast(t("settings.saved"));
  }

  if (draft) {
    return (
      <ModelForm
        draft={draft}
        formMode={formMode}
        fetched={fetched}
        busy={busy}
        status={status}
        showKey={showKey}
        onChange={setEditing}
        onProviderChange={onProviderChange}
        onFetchModels={() => void onFetchModels()}
        onTest={() => void onTest()}
        onSave={save}
        onClose={closeForm}
        onToggleShowKey={() => setShowKey((v) => !v)}
      />
    );
  }

  return (
    <ModelList
      groups={groups}
      onAdd={startAdd}
      onAddLlm={startAddLlm}
      onEdit={(m) => {
        setFormMode("full");
        setEditing({ ...m });
        setFetched(null);
        setStatus(null);
      }}
      onDelete={(id) => deleteModel(id)}
    />
  );
}
