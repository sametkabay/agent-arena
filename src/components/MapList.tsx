import { useTranslation } from "react-i18next";
import { mapsToMeta } from "@/lib/maps";
import { useArenaStore } from "@/store/arenaStore";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function MapList({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  const mapId = useArenaStore((s) => s.mapId);
  const customMaps = useArenaStore((s) => s.customMaps);
  const setMapId = useArenaStore((s) => s.setMapId);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);
  const openMapEditor = useArenaStore((s) => s.openMapEditor);

  const maps = mapsToMeta(customMaps);

  return (
    <div
      className={
        "side-panel map-list" + (collapsed ? " side-panel--collapsed" : "")
      }
    >
      <button
        type="button"
        className="side-panel__header"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span>{t("mapList.title")}</span>
        <span className="side-panel__chevron" aria-hidden>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div className="side-panel__items">
          {maps.length === 0 ? (
            <button
              type="button"
              className="side-panel__empty side-panel__empty--action"
              onClick={() => setSettingsTab("map")}
            >
              {t("mapList.empty")}
            </button>
          ) : (
            maps.map((map) => {
              const active = mapId === map.id;
              return (
                <div
                  key={map.id}
                  className={
                    "side-panel__item" +
                    (active ? " side-panel__item--active" : "")
                  }
                >
                  <button
                    type="button"
                    className="side-panel__item-main"
                    onClick={() => {
                      if (!active) setMapId(map.id);
                    }}
                  >
                    <span
                      className="side-panel__swatch"
                      style={{
                        background: `linear-gradient(145deg, ${map.theme.background}, ${map.theme.accent})`,
                      }}
                      aria-hidden
                    />
                    <span className="side-panel__meta">
                      <span className="side-panel__name">{map.name}</span>
                      <span className="side-panel__bio">
                        {map.builtin
                          ? t("mapList.builtin")
                          : map.description || t("mapList.custom")}
                      </span>
                    </span>
                  </button>
                  {active && (
                    <button
                      type="button"
                      className="side-panel__item-edit"
                      title={t("mapList.edit")}
                      aria-label={t("mapList.edit")}
                      onClick={(e) => {
                        e.stopPropagation();
                        openMapEditor(map.id);
                      }}
                    >
                      ✎
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
