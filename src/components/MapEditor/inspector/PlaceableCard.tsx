import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  placeableCanAnimate,
  placeableCanWander,
  type PlaceableId,
} from "@/lib/assets/catalog";
import { getPlaceableSpec } from "@/lib/assets/placeableSpec";
import { isUserAssetId } from "@/lib/userAssets/ids";
import type { PlaceableInstance } from "@/lib/types";
import { AssetPreview } from "@/components/MapEditor/AssetPreview";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import type { MapDraftUpdater } from "@/components/MapEditor/useMapHistory";
import { useUserAssetStore } from "@/store/userAssetStore";

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
  const spec = getPlaceableSpec(placeable.placeableId);
  const isUser = isUserAssetId(placeable.placeableId);
  const setTargetSize = useUserAssetStore((s) => s.setTargetSize);
  const metas = useUserAssetStore((s) => s.metas);
  const userMeta = isUser
    ? metas.find((m) => m.id === placeable.placeableId)
    : null;
  /** null = show store value; string = local edit in progress (blur commits). */
  const [targetDraft, setTargetDraft] = useState<string | null>(null);
  const targetDisplay =
    targetDraft ?? (userMeta ? String(userMeta.targetSize) : "1");

  const commitTargetSize = () => {
    if (!userMeta) {
      setTargetDraft(null);
      return;
    }
    const raw = targetDraft;
    setTargetDraft(null);
    if (raw == null) return;
    if (raw.trim() === "") return;
    const v = Number(raw);
    if (!Number.isFinite(v) || v === userMeta.targetSize) return;
    void setTargetSize(userMeta.id, v);
  };

  return (
    <div className="map-editor__selection-card">
      {!isUser && (
        <div className="map-editor__selection-preview">
          <AssetPreview placeableId={placeable.placeableId as PlaceableId} />
        </div>
      )}
      <h4>{spec?.label ?? placeable.placeableId}</h4>

      {isUser && (
        <>
          <h4>{t("mapEditor.customAssets.manage")}</h4>
          <div className="map-editor__user-model">
            <p className="map-editor__hint">
              {userMeta
                ? userMeta.name
                : t("mapEditor.customAssets.missingHint")}
            </p>
            {userMeta && (
              <label className="map-editor__field">
                <span>{t("mapEditor.customAssets.targetSize")}</span>
                <input
                  type="number"
                  min={0.05}
                  max={50}
                  step={0.05}
                  value={targetDisplay}
                  data-testid="inspector-target-size"
                  onChange={(e) => setTargetDraft(e.target.value)}
                  onBlur={commitTargetSize}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
            )}
          </div>
        </>
      )}

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
