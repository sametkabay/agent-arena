import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig, AiProviderKind } from "@/lib/types";
import { fetchModels, providerDefaults, testConnection } from "@/lib/ai/providers";
import {
  MODEL_IO_LIMITS,
  ModelImportError,
  buildModelExport,
  importedModelsHaveEmptyHeaders,
  modelExportFileName,
  parseModelImport,
  type ImportedModel,
  type ParseModelImportResult,
} from "@/lib/modelConfigIO";
import { createModelDraft, useArenaStore } from "@/store/arenaStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSettingsBack } from "@/components/SettingsModal/settingsNav";
import { ModelExportDialog } from "@/components/SettingsModal/ModelExportDialog";
import { ModelForm } from "@/components/SettingsModal/ModelForm";
import { ModelList } from "@/components/SettingsModal/ModelList";
import { groupModels } from "@/components/SettingsModal/groupModels";

type FormMode = "full" | "llm";

export function ModelsTab() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const upsertModel = useArenaStore((s) => s.upsertModel);
  const importModels = useArenaStore((s) => s.importModels);
  const deleteModel = useArenaStore((s) => s.deleteModel);
  const showToast = useArenaStore((s) => s.showToast);

  const [editing, setEditing] = useState<AiModelConfig | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("full");
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<"fetch" | "test" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [usedModelIds, setUsedModelIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingKeysImport, setPendingKeysImport] = useState<ParseModelImportResult | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const importBtnRef = useRef<HTMLButtonElement>(null);

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
    const result = upsertModel({
      ...draft,
      name,
      baseUrl: draft.baseUrl.trim(),
      modelId,
      apiKey: draft.apiKey?.trim() || undefined,
      extraHeaders: draft.extraHeaders.filter((h) => h.key.trim()),
    });
    if (!result.ok) return;
    closeForm();
    showToast(t("settings.saved"));
  }

  function startExport() {
    if (models.length === 0) {
      showToast(t("settings.models.exportEmpty"));
      return;
    }
    setExportOpen(true);
  }

  function confirmExport(includeApiKeys: boolean) {
    try {
      const json = buildModelExport(models, includeApiKeys);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = modelExportFileName(includeApiKeys);
      a.click();
      // Defer revoke so Firefox can start the download first.
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast(t("settings.models.exported"));
    } catch {
      showToast(t("settings.models.exportFailed"));
    } finally {
      setExportOpen(false);
    }
  }

  function startImport() {
    if (editing != null) return;
    fileRef.current?.click();
  }

  function toastImportResult(
    created: AiModelConfig[],
    items: ImportedModel[],
    parsed: Pick<ParseModelImportResult, "duplicates" | "invalid">,
  ) {
    const count = created.length;
    const skipped = parsed.duplicates + (items.length - created.length);
    const parts: string[] = [];

    if (count === 0 && skipped > 0) {
      parts.push(t("settings.models.allDuplicates"));
    } else if (count > 0 && skipped > 0) {
      parts.push(
        t("settings.models.importedSkipped", { count, skipped }),
      );
    } else if (count > 0) {
      parts.push(t("settings.models.imported", { count }));
    }

    if (parsed.invalid > 0) {
      parts.push(
        t("settings.models.invalidSkipped", { count: parsed.invalid }),
      );
    }

    if (importedModelsHaveEmptyHeaders(created)) {
      parts.push(t("settings.models.emptyHeadersHint"));
    }

    if (parts.length > 0) {
      showToast(parts.join(" "));
    }
  }

  function commitImport(items: ImportedModel[], parsed: ParseModelImportResult) {
    const { models: created, result } = importModels(items);
    if (!result.ok) {
      // Failure toast already shown via persist({ toast: "explicit" }).
      importBtnRef.current?.focus();
      return;
    }
    toastImportResult(created, items, parsed);
    importBtnRef.current?.focus();
  }

  async function onImportFile(file: File) {
    if (file.size > MODEL_IO_LIMITS.maxFileBytes) {
      showToast(t("settings.models.errors.tooLarge"));
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseModelImport(text, {
        fileSize: file.size,
        existingCount: models.length,
        existing: models,
      });
      if (parsed.hadApiKeys) {
        setPendingKeysImport(parsed);
        return;
      }
      commitImport(parsed.models, parsed);
    } catch (err) {
      const code =
        err instanceof ModelImportError ? err.code : "invalidJson";
      showToast(t(`settings.models.errors.${code}`));
    }
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
    <>
      <ModelList
        groups={groups}
        onAdd={startAdd}
        onExport={startExport}
        onImport={startImport}
        importButtonRef={importBtnRef}
        onAddLlm={startAddLlm}
        onEdit={(m) => {
          setFormMode("full");
          setEditing({ ...m });
          setFetched(null);
          setStatus(null);
        }}
        onDelete={(id) => deleteModel(id)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.aa-models.json"
        hidden
        data-testid="model-config-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          await onImportFile(f);
        }}
      />
      {exportOpen && (
        <ModelExportDialog
          onCancel={() => setExportOpen(false)}
          onConfirm={confirmExport}
        />
      )}
      <ConfirmDialog
        open={pendingKeysImport != null}
        title={t("settings.models.importKeysNotice.title")}
        message={t("settings.models.importKeysNotice.body")}
        confirmLabel={t("settings.models.importKeysNotice.confirm")}
        cancelLabel={t("settings.models.exportDialog.cancel")}
        danger
        onCancel={() => {
          setPendingKeysImport(null);
          importBtnRef.current?.focus();
        }}
        onConfirm={() => {
          const pending = pendingKeysImport;
          setPendingKeysImport(null);
          if (!pending) return;
          commitImport(pending.models, pending);
        }}
      />
    </>
  );
}
