import { useTranslation } from "react-i18next";
import type { AiModelConfig } from "@/lib/types";
import type { ProviderGroup } from "@/components/SettingsModal/groupModels";
import {
  DeleteActionIcon,
  EditActionIcon,
} from "@/components/SettingsModal/CardActionIcons";

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export function ModelList({
  groups,
  onAdd,
  onAddLlm,
  onEdit,
  onDelete,
}: {
  groups: ProviderGroup[];
  onAdd: () => void;
  onAddLlm: (source: AiModelConfig, takenIds: string[]) => void;
  onEdit: (model: AiModelConfig) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const empty = groups.length === 0;
  const editLabel = t("settings.edit");
  const deleteLabel = t("settings.delete");

  return (
    <div>
      <div className="header-row">
        <p className="settings-hint" style={{ margin: 0 }}>
          {t("settings.models.hint")}
        </p>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          {t("settings.add")}
        </button>
      </div>
      {empty ? (
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
                    onAddLlm(
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
                        aria-label={editLabel}
                        title={editLabel}
                        onClick={() => onEdit(m)}
                      >
                        <span className="card-item__action-label">{editLabel}</span>
                        <EditActionIcon />
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        aria-label={deleteLabel}
                        title={deleteLabel}
                        onClick={() => onDelete(m.id)}
                      >
                        <span className="card-item__action-label">{deleteLabel}</span>
                        <DeleteActionIcon />
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
