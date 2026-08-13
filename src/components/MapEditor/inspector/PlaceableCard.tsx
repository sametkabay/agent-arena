import { useTranslation } from "react-i18next";
import {
  PLACEABLE_SPECS,
  placeableCanAnimate,
  placeableCanWander,
  type PlaceableId,
} from "@/lib/assets/catalog";
import type { PlaceableInstance } from "@/lib/types";
import { AssetPreview } from "@/components/MapEditor/AssetPreview";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import type { MapDraftUpdater } from "@/components/MapEditor/useMapHistory";

export function PlaceableCard({
  placeable,
  commit,
  onPatchLive,
  onMoveLive,
  onRotate,
  onDelete,
  beginGesture,
  endGesture,
}: {
  placeable: PlaceableInstance;
  commit: (updater: MapDraftUpdater) => void;
  onPatchLive: (patch: Partial<PlaceableInstance>) => void;
  onMoveLive: (pos: [number, number, number]) => void;
  onRotate: (delta: number) => void;
  onDelete: () => void;
  beginGesture: () => void;
  endGesture: () => void;
}) {
  const { t } = useTranslation();
  const scaleValue = placeable.scale ?? 1;

  return (
    <div className="map-editor__selection-card">
      <div className="map-editor__selection-preview">
        <AssetPreview placeableId={placeable.placeableId as PlaceableId} />
      </div>
      <h4>
        {PLACEABLE_SPECS[placeable.placeableId as PlaceableId]?.label ??
          placeable.placeableId}
      </h4>

      {placeableCanWander(placeable.placeableId) && (
        <>
          <label className="map-editor__field">
            <span>{t("mapEditor.behavior")}</span>
            <Select
              variant="dark"
              value={placeable.behavior ?? "static"}
              onChange={(v) => {
                const behavior = v as "static" | "wander";
                commit((d) => ({
                  ...d,
                  placeables: d.placeables.map((p) => {
                    if (p.id !== placeable.id) return p;
                    if (behavior === "wander") {
                      return {
                        ...p,
                        behavior,
                        homePosition: [...p.position] as [
                          number,
                          number,
                          number,
                        ],
                        moveSpeed: p.moveSpeed ?? 1.1,
                        wanderRadius: p.wanderRadius ?? 3.4,
                        target: undefined,
                        locomotion: "idle",
                      };
                    }
                    return {
                      ...p,
                      behavior: "static",
                      target: undefined,
                      locomotion: undefined,
                    };
                  }),
                }));
              }}
              options={[
                { value: "static", label: t("mapEditor.behaviorStatic") },
                { value: "wander", label: t("mapEditor.behaviorWander") },
              ]}
            />
          </label>
          {(placeable.behavior ?? "static") === "wander" && (
            <>
              <label className="map-editor__field">
                <span>
                  {t("mapEditor.wanderRadius")}:{" "}
                  {(placeable.wanderRadius ?? 3.4).toFixed(1)}m
                </span>
                <Slider
                  variant="dark"
                  min={1}
                  max={10}
                  step={0.5}
                  value={placeable.wanderRadius ?? 3.4}
                  onPointerDown={beginGesture}
                  onPointerUp={endGesture}
                  onChange={(v) =>
                    onPatchLive({
                      wanderRadius: v,
                    })
                  }
                />
              </label>
              <label className="map-editor__field">
                <span>
                  {t("mapEditor.moveSpeed")}:{" "}
                  {(placeable.moveSpeed ?? 1.1).toFixed(1)}
                </span>
                <Slider
                  variant="dark"
                  min={0.4}
                  max={2.5}
                  step={0.1}
                  value={placeable.moveSpeed ?? 1.1}
                  onPointerDown={beginGesture}
                  onPointerUp={endGesture}
                  onChange={(v) =>
                    onPatchLive({
                      moveSpeed: v,
                    })
                  }
                />
              </label>
            </>
          )}
        </>
      )}

      {placeableCanAnimate(placeable.placeableId) && (
        <label className="map-editor__field">
          <span>{t("mapEditor.behavior")}</span>
          <Select
            variant="dark"
            value={placeable.behavior === "static" ? "static" : "animated"}
            onChange={(v) => {
              const behavior = v as "static" | "animated";
              commit((d) => ({
                ...d,
                placeables: d.placeables.map((p) =>
                  p.id === placeable.id
                    ? { ...p, behavior }
                    : p,
                ),
              }));
            }}
            options={[
              { value: "static", label: t("mapEditor.behaviorStatic") },
              {
                value: "animated",
                label: t("mapEditor.behaviorAnimated"),
              },
            ]}
          />
        </label>
      )}

      <label className="map-editor__field">
        <span>X</span>
        <input
          type="number"
          step={0.1}
          value={Number(placeable.position[0].toFixed(2))}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) =>
            onMoveLive([
              Number(e.target.value),
              placeable.position[1],
              placeable.position[2],
            ])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>Y ({t("mapEditor.axisUp")})</span>
        <input
          type="number"
          step={0.05}
          value={Number(placeable.position[1].toFixed(2))}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) =>
            onMoveLive([
              placeable.position[0],
              Number(e.target.value),
              placeable.position[2],
            ])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>
          Y ({t("mapEditor.axisUp")}): {placeable.position[1].toFixed(2)}
        </span>
        <Slider
          variant="dark"
          min={-0.5}
          max={4}
          step={0.05}
          value={placeable.position[1]}
          onPointerDown={beginGesture}
          onPointerUp={endGesture}
          onChange={(v) =>
            onMoveLive([placeable.position[0], v, placeable.position[2]])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>Z</span>
        <input
          type="number"
          step={0.1}
          value={Number(placeable.position[2].toFixed(2))}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) =>
            onMoveLive([
              placeable.position[0],
              placeable.position[1],
              Number(e.target.value),
            ])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>
          {t("mapEditor.rotation")}:{" "}
          {Math.round((placeable.rotationY * 180) / Math.PI)}°
        </span>
        <Slider
          variant="dark"
          min={0}
          max={Math.PI * 2}
          step={0.01}
          value={placeable.rotationY}
          onPointerDown={beginGesture}
          onPointerUp={endGesture}
          onChange={(v) =>
            onPatchLive({
              rotationY: v,
            })
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
      <label className="map-editor__field">
        <span>
          {t("mapEditor.scale")}: {scaleValue.toFixed(2)}×
        </span>
        <Slider
          variant="dark"
          min={0.25}
          max={3}
          step={0.05}
          value={scaleValue}
          onPointerDown={beginGesture}
          onPointerUp={endGesture}
          onChange={(v) => onPatchLive({ scale: v })}
        />
      </label>
      <button type="button" className="map-editor__danger" onClick={onDelete}>
        {t("mapEditor.deleteObject")}
      </button>
    </div>
  );
}
