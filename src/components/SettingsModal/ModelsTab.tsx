import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig, AiProviderKind, ExtraHeader } from "@/lib/types";
import { fetchModels, providerDefaults, testConnection } from "@/lib/ai/providers";
import { createModelDraft, useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";
import { useSettingsBack } from "@/components/SettingsModal/SettingsNavContext";

const PROVIDERS: AiProviderKind[] = ["openai", "gemini", "claude", "ollama", "custom"];

type FormMode = "full" | "llm";

type ProviderGroup = {
  key: string;
  provider: AiProviderKind;
  baseUrl: string;
  models: AiModelConfig[];
};

function groupKey(m: AiModelConfig): string {
  return `${m.provider}\0${m.baseUrl}\0${m.apiKey ?? ""}`;
}

function groupModels(models: AiModelConfig[]): ProviderGroup[] {
  const map = new Map<string, AiModelConfig[]>();
  for (const m of models) {
    const k = groupKey(m);
    const list = map.get(k);
    if (list) list.push(m);
    else map.set(k, [m]);
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    provider: items[0].provider,
    baseUrl: items[0].baseUrl,
    models: items,
  }));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

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

  const modelInput = useMemo(() => {
    if (!draft) return null;
    if (fetched && fetched.length > 0) {
      return (
        <Select
          value={draft.modelId}
          onChange={(v) =>
            setEditing({
              ...draft,
              modelId: v,
              name: !draft.name.trim() || draft.name === draft.modelId ? v : draft.name,
            })
          }
          options={fetched.map((id) => ({ value: id, label: id }))}
          searchable
          searchPlaceholder={t("settings.models.searchModels")}
        />
      );
    }
    return (
      <input
        type="text"
        value={draft.modelId}
        onChange={(e) => setEditing({ ...draft, modelId: e.target.value })}
      />
    );
  }, [draft, fetched, t]);

  if (draft && formMode === "llm") {
    return (
      <div className="form-grid">
        <p className="settings-hint" style={{ marginBottom: 0 }}>
          {t("settings.models.addLlmHint", {
            provider: t(`settings.models.providerNames.${draft.provider}`),
            host: hostOf(draft.baseUrl),
          })}
        </p>
        <label>
          {t("settings.models.name")}
          <input
            value={draft.name}
            onChange={(e) => setEditing({ ...draft, name: e.target.value })}
            placeholder={draft.modelId || t("settings.models.modelId")}
            autoFocus
          />
        </label>
        <label>
          {t("settings.models.modelId")}
          {modelInput}
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void onFetchModels()}
          >
            {busy === "fetch" ? t("settings.models.fetching") : t("settings.models.fetchModels")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void onTest()}
          >
            {busy === "test" ? t("settings.models.testing") : t("settings.models.test")}
          </button>
        </div>
        {status && (
          <div className={`status-note status-note--${status.ok ? "ok" : "err"}`}>
            {status.detail}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={save}>
            {t("settings.save")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={closeForm}>
            {t("settings.cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="form-grid">
        <label>
          {t("settings.models.provider")}
          <Select
            value={draft.provider}
            onChange={(v) => onProviderChange(v as AiProviderKind)}
            options={PROVIDERS.map((p) => ({
              value: p,
              label: `${p} — ${t(`settings.models.providers.${p}`)}`,
            }))}
          />
        </label>
        <label>
          {t("settings.models.name")}
          <input
            value={draft.name}
            onChange={(e) => setEditing({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          {t("settings.models.baseUrl")}
          <input
            value={draft.baseUrl}
            onChange={(e) => setEditing({ ...draft, baseUrl: e.target.value })}
          />
        </label>
        <label>
          {t("settings.models.apiKey")}
          <div className="header-pair header-pair--name-action">
            <input
              type={showKey ? "text" : "password"}
              value={draft.apiKey ?? ""}
              onChange={(e) => setEditing({ ...draft, apiKey: e.target.value })}
              autoComplete="off"
            />
            <button type="button" className="btn btn--ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <label>
          {t("settings.models.modelId")}
          {modelInput}
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void onFetchModels()}
          >
            {busy === "fetch" ? t("settings.models.fetching") : t("settings.models.fetchModels")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void onTest()}
          >
            {busy === "test" ? t("settings.models.testing") : t("settings.models.test")}
          </button>
        </div>
        {status && (
          <div className={`status-note status-note--${status.ok ? "ok" : "err"}`}>
            {status.detail}
          </div>
        )}
        <div>
          <div className="header-row">
            <strong>{t("settings.models.extraHeaders")}</strong>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setEditing({
                  ...draft,
                  extraHeaders: [...draft.extraHeaders, { key: "", value: "" }],
                })
              }
            >
              {t("settings.models.addHeader")}
            </button>
          </div>
          <p className="settings-hint">{t("settings.models.extraHeadersHint")}</p>
          {draft.extraHeaders.map((h, i) => (
            <HeaderRow
              key={i}
              header={h}
              onChange={(next) => {
                const extraHeaders = draft.extraHeaders.map((x, idx) => (idx === i ? next : x));
                setEditing({ ...draft, extraHeaders });
              }}
              onRemove={() =>
                setEditing({
                  ...draft,
                  extraHeaders: draft.extraHeaders.filter((_, idx) => idx !== i),
                })
              }
            />
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={save}>
            {t("settings.save")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={closeForm}>
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
          {t("settings.models.hint")}
        </p>
        <button type="button" className="btn btn--primary" onClick={startAdd}>
          {t("settings.add")}
        </button>
      </div>
      {models.length === 0 ? (
        <p className="settings-hint">{t("settings.models.empty")}</p>
      ) : (
        <div className="card-list">
          {groups.map((group) => (
            <div key={group.key} className="provider-group">
              <div className="provider-group__head">
                <div>
                  <div className="provider-group__title">
                    {t(`settings.models.providerNames.${group.provider}`)}
                  </div>
                  <div className="provider-group__sub">{hostOf(group.baseUrl)}</div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    startAddLlm(
                      group.models[0],
                      group.models.map((m) => m.modelId),
                    )
                  }
                >
                  {t("settings.models.addLlm")}
                </button>
              </div>
              <ul className="provider-group__items">
                {group.models.map((m) => (
                  <li key={m.id} className="provider-group__item">
                    <div className="provider-group__item-main">
                      <div className="card-item__title">{m.name}</div>
                      {m.name !== m.modelId && (
                        <div className="card-item__sub">{m.modelId}</div>
                      )}
                    </div>
                    <div className="card-item__actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => {
                          setFormMode("full");
                          setEditing({ ...m });
                          setFetched(null);
                          setStatus(null);
                        }}
                      >
                        {t("settings.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => deleteModel(m.id)}
                      >
                        {t("settings.delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeaderRow({
  header,
  onChange,
  onRemove,
}: {
  header: ExtraHeader;
  onChange: (h: ExtraHeader) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="header-pair header-pair--triple">
      <input
        placeholder={t("settings.models.headerKey")}
        value={header.key}
        onChange={(e) => onChange({ ...header, key: e.target.value })}
      />
      <input
        placeholder={t("settings.models.headerValue")}
        value={header.value}
        onChange={(e) => onChange({ ...header, value: e.target.value })}
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
  );
}
