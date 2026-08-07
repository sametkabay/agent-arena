import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig, AiProviderKind, ExtraHeader } from "@/lib/types";
import { fetchModels, providerDefaults, testConnection } from "@/lib/ai/providers";
import { createModelDraft, useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";

const PROVIDERS: AiProviderKind[] = ["openai", "gemini", "claude", "ollama", "custom"];

export function ModelsTab() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const upsertModel = useArenaStore((s) => s.upsertModel);
  const deleteModel = useArenaStore((s) => s.deleteModel);
  const showToast = useArenaStore((s) => s.showToast);

  const [editing, setEditing] = useState<AiModelConfig | null>(null);
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<"fetch" | "test" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const draft = editing;

  function startAdd() {
    const d = createModelDraft({ name: "OpenAI" });
    const defs = providerDefaults(d.provider);
    setEditing({ ...d, ...defs });
    setFetched(null);
    setStatus(null);
  }

  function onProviderChange(provider: AiProviderKind) {
    if (!draft) return;
    const defs = providerDefaults(provider);
    setEditing({
      ...draft,
      provider,
      baseUrl: defs.baseUrl,
      modelId: defs.modelId,
    });
    setFetched(null);
  }

  async function onFetchModels() {
    if (!draft) return;
    setBusy("fetch");
    setStatus(null);
    try {
      const list = await fetchModels(draft);
      setFetched(list);
      if (list.length && !list.includes(draft.modelId)) {
        setEditing({ ...draft, modelId: list[0] });
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
    if (!draft.name.trim() || !draft.baseUrl.trim() || !draft.modelId.trim()) return;
    upsertModel({
      ...draft,
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      modelId: draft.modelId.trim(),
      apiKey: draft.apiKey?.trim() || undefined,
      extraHeaders: draft.extraHeaders.filter((h) => h.key.trim()),
    });
    setEditing(null);
    showToast(t("settings.saved"));
  }

  const modelInput = useMemo(() => {
    if (!draft) return null;
    if (fetched && fetched.length > 0) {
      return (
        <Select
          value={draft.modelId}
          onChange={(v) => setEditing({ ...draft, modelId: v })}
          options={fetched.map((id) => ({ value: id, label: id }))}
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
  }, [draft, fetched]);

  if (draft) {
    return (
      <div className="form-grid">
        <p className="settings-hint">{t("settings.models.corsNote")}</p>
        <label>
          {t("settings.models.name")}
          <input
            value={draft.name}
            onChange={(e) => setEditing({ ...draft, name: e.target.value })}
          />
        </label>
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
          {t("settings.models.baseUrl")}
          <input
            value={draft.baseUrl}
            onChange={(e) => setEditing({ ...draft, baseUrl: e.target.value })}
          />
        </label>
        <label>
          {t("settings.models.apiKey")}
          <div className="header-pair">
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
          {models.map((m) => (
            <div key={m.id} className="card-item">
              <div>
                <div className="card-item__title">{m.name}</div>
                <div className="card-item__sub">
                  {m.provider} · {m.modelId}
                </div>
              </div>
              <div className="card-item__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
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
    <div className="header-pair" style={{ marginBottom: 8 }}>
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
      <button type="button" className="btn btn--danger" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
