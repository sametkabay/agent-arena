import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AiModelConfig, AiProviderKind, ExtraHeader } from "@/lib/types";
import { Select } from "@/components/ui/Select";

const PROVIDERS: AiProviderKind[] = ["openai", "gemini", "claude", "ollama", "custom"];

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export function ModelForm({
  draft,
  formMode,
  fetched,
  busy,
  status,
  showKey,
  onChange,
  onProviderChange,
  onFetchModels,
  onTest,
  onSave,
  onClose,
  onToggleShowKey,
}: {
  draft: AiModelConfig;
  formMode: "full" | "llm";
  fetched: string[] | null;
  busy: "fetch" | "test" | null;
  status: { ok: boolean; detail: string } | null;
  showKey: boolean;
  onChange: (next: AiModelConfig) => void;
  onProviderChange: (provider: AiProviderKind) => void;
  onFetchModels: () => void;
  onTest: () => void;
  onSave: () => void;
  onClose: () => void;
  onToggleShowKey: () => void;
}) {
  const { t } = useTranslation();

  const modelInput = useMemo(() => {
    if (fetched && fetched.length > 0) {
      return (
        <Select
          value={draft.modelId}
          onChange={(v) =>
            onChange({
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
        onChange={(e) => onChange({ ...draft, modelId: e.target.value })}
      />
    );
  }, [draft, fetched, t, onChange]);

  if (formMode === "llm") {
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
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
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
            onClick={onFetchModels}
          >
            {busy === "fetch" ? t("settings.models.fetching") : t("settings.models.fetchModels")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={onTest}
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
          <button type="button" className="btn btn--primary" onClick={onSave}>
            {t("settings.save")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t("settings.cancel")}
          </button>
        </div>
      </div>
    );
  }

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
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        {t("settings.models.baseUrl")}
        <input
          value={draft.baseUrl}
          onChange={(e) => onChange({ ...draft, baseUrl: e.target.value })}
        />
      </label>
      <label>
        {t("settings.models.apiKey")}
        <div className="header-pair header-pair--name-action">
          <input
            type={showKey ? "text" : "password"}
            value={draft.apiKey ?? ""}
            onChange={(e) => onChange({ ...draft, apiKey: e.target.value })}
            autoComplete="off"
          />
          <button type="button" className="btn btn--ghost" onClick={onToggleShowKey}>
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
          onClick={onFetchModels}
        >
          {busy === "fetch" ? t("settings.models.fetching") : t("settings.models.fetchModels")}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy !== null}
          onClick={onTest}
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
              onChange({
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
              onChange({ ...draft, extraHeaders });
            }}
            onRemove={() =>
              onChange({
                ...draft,
                extraHeaders: draft.extraHeaders.filter((_, idx) => idx !== i),
              })
            }
          />
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={onSave}>
          {t("settings.save")}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t("settings.cancel")}
        </button>
      </div>
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
