import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  MAP_PRESETS,
  createMapFromPreset,
  mapsToMeta,
  resolveMapDefinition,
  exportMapJson,
  type MapPresetId,
} from "@/lib/maps";
import { FLOOR_SURFACES } from "@/lib/maps/floorSurfaces";
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
  const upsertCustomMap = useArenaStore((s) => s.upsertCustomMap);
  const showToast = useArenaStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const maps = mapsToMeta(customMaps);

  const exportActive = () => {
    if (!activeMap) return;
    try {
      const json = exportMapJson(activeMap);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeMap.id || "map"}.aamf.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("settings.map.exported"));
    } catch {
      showToast(t("mapEditor.importError"));
    }
  };

  const applyPreset = (presetId: MapPresetId) => {
    const def = createMapFromPreset(presetId);
    upsertCustomMap(def);
    setMapId(def.id);
    showToast(t("settings.map.presetApplied", { name: def.name }));
  };

  return (
    <div>
      <p className="settings-hint">{t("settings.map.hint")}</p>
      <p className="settings-hint">
        {t("settings.map.active")}:{" "}
        <strong>{activeMap?.name ?? mapId}</strong> · {floorSize}m ·{" "}
        {activeMap?.placeables.length ?? 0} props
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
        <button type="button" onClick={exportActive}>
          {t("settings.map.export")}
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
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : t("mapEditor.importError");
              showToast(msg);
            }
            e.target.value = "";
          }}
        />
      </div>

      <h4 className="map-tab__section-title">{t("settings.map.presetsTitle")}</h4>
      <div className="map-preset-grid">
        {MAP_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="map-preset-card"
            onClick={() => applyPreset(p.id)}
          >
            <div className="card-item__title">{t(p.nameKey)}</div>
            <div className="card-item__sub">{t(p.descriptionKey)}</div>
          </button>
        ))}
      </div>

      <h4 className="map-tab__section-title">{t("settings.map.mapsTitle")}</h4>
      <div className="map-grid">
        {maps.map((m) => {
          const def = resolveMapDefinition(m.id, customMaps);
          const surface = def.floor.surface ?? "office";
          const swatch = FLOOR_SURFACES[surface];
          return (
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
                <div
                  className="map-card__preview"
                  style={{
                    background: `linear-gradient(145deg, ${m.theme.background}, ${swatch.color} 55%, ${m.theme.fog})`,
                  }}
                >
                  <span
                    className="map-card__swatch"
                    style={{ background: swatch.color }}
                    title={surface}
                  />
                  <span className="map-card__meta">
                    {def.floor.size}m · {def.placeables.length}
                  </span>
                </div>
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
          );
        })}
      </div>
    </div>
  );
}
