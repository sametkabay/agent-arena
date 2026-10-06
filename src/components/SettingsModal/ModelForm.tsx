import { useTranslation } from "react-i18next";
import type { AiModelConfig } from "@/lib/types";
import { Select } from "@/components/ui/Select";
import { resolveZibbyTextModel, ZIBBY_TEXT_MODELS } from "@/lib/ai/zibbyModels";

export function ModelForm({
  draft,
  onChange,
  onSave,
  onClose,
}: {
  draft: AiModelConfig;
  onChange: (next: AiModelConfig) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const catalog = resolveZibbyTextModel(draft.modelId);

  return (
    <div className="form-grid">
      <p className="settings-hint">{t("settings.models.hint")}</p>
      <label>
        {t("settings.models.name")}
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        {t("settings.models.modelId")}
        <Select
          value={catalog.id}
          onChange={(id) => {
            const next = resolveZibbyTextModel(id);
            onChange({
              ...draft,
              modelId: next.id,
              provider: next.kind,
              name:
                !draft.name.trim() ||
                draft.name === draft.modelId ||
                ZIBBY_TEXT_MODELS.some((m) => m.label === draft.name)
                  ? next.label
                  : draft.name,
              baseUrl: "",
              apiKey: undefined,
              extraHeaders: [],
            });
          }}
          options={ZIBBY_TEXT_MODELS.map((m) => ({
            value: m.id,
            label: `${m.label} (${m.id})`,
          }))}
          searchable
          searchPlaceholder={t("settings.models.searchModels")}
        />
      </label>
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
