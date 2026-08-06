import { useTranslation } from "react-i18next";
import { MAPS } from "@/lib/maps";
import type { MapId } from "@/lib/types";
import { useArenaStore } from "@/store/arenaStore";

export function MapTab() {
  const { t } = useTranslation();
  const mapId = useArenaStore((s) => s.mapId);
  const setMapId = useArenaStore((s) => s.setMapId);
  const floorSize = useArenaStore((s) => s.floorSize);
  const agentCount = useArenaStore((s) => s.agents.length);

  return (
    <div>
      <p className="settings-hint">{t("settings.map.hint")}</p>
      <p className="settings-hint">
        {t("settings.map.active")}: <strong>{t(`maps.${mapId}.name`)}</strong> · {floorSize}m ·{" "}
        {agentCount} agents
      </p>
      <div className="map-grid">
        {MAPS.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!m.available}
            className={
              "map-card" +
              (mapId === m.id ? " is-active" : "") +
              (!m.available ? " is-disabled" : "")
            }
            onClick={() => m.available && setMapId(m.id as MapId)}
          >
            <div className="card-item__title">{t(m.nameKey)}</div>
            <div className="card-item__sub">{t(m.descriptionKey)}</div>
            {!m.available && (
              <span className="map-card__badge">{t("settings.map.comingSoon")}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
