import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { mapsToMeta } from "@/lib/maps";
import { useArenaStore } from "@/store/arenaStore";

export function MapTab() {
  const { t } = useTranslation();
  const mapId = useArenaStore((s) => s.mapId);
  const customMaps = useArenaStore((s) => s.customMaps);
  const floorSize = useArenaStore((s) => s.floorSize);
  const activeMap = useArenaStore((s) => s.activeMap);
  const setMapId = useArenaStore((s) => s.setMapId);
  const openMapEditor = useArenaStore((s) => s.openMapEditor);
  const createNewMap = useArenaStore((s) => s.createNewMap);
  const duplicateActiveMap = useArenaStore((s) => s.duplicateActiveMap);
  const deleteCustomMap = useArenaStore((s) => s.deleteCustomMap);
  const importMapJson = useArenaStore((s) => s.importMapJson);
  const showToast = useArenaStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const maps = mapsToMeta(customMaps);

  return (
    <div>
      <p className="settings-hint">{t("settings.map.hint")}</p>
      <p className="settings-hint">
        {t("settings.map.active")}:{" "}
        <strong>{activeMap?.name ?? mapId}</strong> · {floorSize}m
      </p>

      <div className="map-tab__actions">
        <button type="button" onClick={() => openMapEditor(mapId)}>
          {t("settings.map.edit")}
        </button>
        <button type="button" onClick={createNewMap}>
          {t("settings.map.new")}
        </button>
        <button type="button" onClick={duplicateActiveMap}>
          {t("settings.map.duplicate")}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          {t("settings.map.import")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              importMapJson(await f.text());
              showToast(t("mapEditor.imported"));
            } catch {
              showToast(t("mapEditor.importError"));
            }
            e.target.value = "";
          }}
        />
      </div>

      <div className="map-grid">
        {maps.map((m) => (
          <div
            key={m.id}
            className={
              "map-card" +
              (mapId === m.id ? " is-active" : "") +
              (!m.available ? " is-disabled" : "")
            }
          >
            <button
              type="button"
              className="map-card__select"
              disabled={!m.available}
              onClick={() => m.available && setMapId(m.id)}
            >
              <div className="card-item__title">{m.name}</div>
              <div className="card-item__sub">
                {m.builtin
                  ? t(`maps.${m.id}.description`, {
                      defaultValue: m.description,
                    })
                  : m.description || t("settings.map.custom")}
              </div>
              {!m.builtin && (
                <span className="map-card__badge">{t("settings.map.custom")}</span>
              )}
            </button>
            <div className="map-card__row">
              <button type="button" onClick={() => openMapEditor(m.id)}>
                {t("settings.map.edit")}
              </button>
              {!m.builtin && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => deleteCustomMap(m.id)}
                >
                  {t("settings.delete")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
