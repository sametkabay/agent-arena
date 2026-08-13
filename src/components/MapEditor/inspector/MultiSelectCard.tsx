import { useTranslation } from "react-i18next";

export function MultiSelectCard({
  count,
  onRotate,
  onScaleUp,
  onScaleDown,
  onAlignX,
  onAlignZ,
  onDistributeX,
  onDistributeZ,
  onDuplicate,
  onDelete,
}: {
  count: number;
  onRotate: (delta: number) => void;
  onScaleUp: () => void;
  onScaleDown: () => void;
  onAlignX: () => void;
  onAlignZ: () => void;
  onDistributeX: () => void;
  onDistributeZ: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="map-editor__selection-card">
      <h4>{t("mapEditor.multiSelected", { count })}</h4>
      <p className="map-editor__hint" style={{ marginTop: 0 }}>
        {t("mapEditor.multiHint")}
      </p>
      <div className="map-editor__inline-actions">
        <button type="button" onClick={() => onRotate(-Math.PI / 2)}>
          ↺ 90°
        </button>
        <button type="button" onClick={() => onRotate(Math.PI / 2)}>
          ↻ 90°
        </button>
      </div>
      <div className="map-editor__inline-actions">
        <button type="button" onClick={onScaleUp}>
          {t("mapEditor.ctx.scaleUp")}
        </button>
        <button type="button" onClick={onScaleDown}>
          {t("mapEditor.ctx.scaleDown")}
        </button>
      </div>
      <div className="map-editor__inline-actions">
        <button type="button" onClick={onAlignX}>
          {t("mapEditor.alignX")}
        </button>
        <button type="button" onClick={onAlignZ}>
          {t("mapEditor.alignZ")}
        </button>
      </div>
      {count >= 3 && (
        <div className="map-editor__inline-actions">
          <button type="button" onClick={onDistributeX}>
            {t("mapEditor.distributeX")}
          </button>
          <button type="button" onClick={onDistributeZ}>
            {t("mapEditor.distributeZ")}
          </button>
        </div>
      )}
      <button type="button" className="map-editor__action" onClick={onDuplicate}>
        {t("mapEditor.ctx.duplicate")}
      </button>
      <button type="button" className="map-editor__danger" onClick={onDelete}>
        {t("mapEditor.deleteSelected", { count })}
      </button>
    </div>
  );
}
