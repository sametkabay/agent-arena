import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig } from "@/lib/types";
import { resolveZibbyTextModel } from "@/lib/ai/zibbyModels";
import { createModelDraft, useArenaStore } from "@/store/arenaStore";
import { useSettingsBack } from "@/components/SettingsModal/settingsNav";
import { ModelForm } from "@/components/SettingsModal/ModelForm";
import { ModelList } from "@/components/SettingsModal/ModelList";
import { groupModels } from "@/components/SettingsModal/groupModels";

export function ModelsTab() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const upsertModel = useArenaStore((s) => s.upsertModel);
  const deleteModel = useArenaStore((s) => s.deleteModel);
  const showToast = useArenaStore((s) => s.showToast);

  const [editing, setEditing] = useState<AiModelConfig | null>(null);

  function closeForm() {
    setEditing(null);
  }

  useSettingsBack(editing != null, closeForm);

  const draft = editing;
  const groups = groupModels(models);

  function startAdd() {
    const catalog = resolveZibbyTextModel("claude-haiku-4-5-20251001");
    setEditing(
      createModelDraft({
        provider: catalog.kind,
        name: catalog.label,
        modelId: catalog.id,
        baseUrl: "",
        apiKey: undefined,
        extraHeaders: [],
      }),
    );
  }

  function save() {
    if (!draft) return;
    const catalog = resolveZibbyTextModel(draft.modelId);
    const name = draft.name.trim() || catalog.label;
    upsertModel({
      ...draft,
      name,
      provider: catalog.kind,
      modelId: catalog.id,
      baseUrl: "",
      apiKey: undefined,
      extraHeaders: [],
    });
    closeForm();
    showToast(t("settings.saved"));
  }

  if (draft) {
    return <ModelForm draft={draft} onChange={setEditing} onSave={save} onClose={closeForm} />;
  }

  return (
    <ModelList
      groups={groups}
      onAdd={startAdd}
      onEdit={(m) => setEditing({ ...m })}
      onDelete={(id) => deleteModel(id)}
    />
  );
}
