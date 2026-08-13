import { useTranslation } from "react-i18next";
import type { MapSpawnPoint } from "@/lib/maps/schema";

export function SpawnCard({
  spawn,
  onMoveLive,
  onRotate,
  onDelete,
  beginGesture,
  endGesture,
}: {
  spawn: MapSpawnPoint;
  onMoveLive: (pos: [number, number, number]) => void;
  onRotate: (delta: number) => void;
  onDelete: () => void;
  beginGesture: () => void;
  endGesture: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="map-editor__selection-card">
      <h4>{t("mapEditor.spawnPoint")}</h4>
      <label className="map-editor__field">
        <span>X</span>
        <input
          type="number"
          step={0.1}
          value={Number(spawn.position[0].toFixed(2))}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) =>
            onMoveLive([
              Number(e.target.value),
              spawn.position[1],
              spawn.position[2],
            ])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>Y ({t("mapEditor.axisUp")})</span>
        <input
          type="number"
          step={0.05}
          value={Number(spawn.position[1].toFixed(2))}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) =>
            onMoveLive([
              spawn.position[0],
              Number(e.target.value),
              spawn.position[2],
            ])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>Z</span>
        <input
          type="number"
          step={0.1}
          value={Number(spawn.position[2].toFixed(2))}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) =>
            onMoveLive([
              spawn.position[0],
              spawn.position[1],
              Number(e.target.value),
            ])
          }
        />
      </label>
      <div className="map-editor__inline-actions">
        <button type="button" onClick={() => onRotate(-Math.PI / 2)}>
          ↺ 90°
        </button>
        <button type="button" onClick={() => onRotate(Math.PI / 2)}>
          ↻ 90°
        </button>
      </div>
      <button type="button" className="map-editor__danger" onClick={onDelete}>
        {t("mapEditor.deleteSpawn")}
      </button>
    </div>
  );
}
