import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LIGHT_DISTANCE_MAX,
  LIGHT_DISTANCE_MIN,
  LIGHT_HEIGHT_MAX,
  LIGHT_HEIGHT_MIN,
  LIGHT_INTENSITY_MAX,
  LIGHT_INTENSITY_MIN,
  LIGHT_INTENSITY_STEP,
  type MapLightPoint,
  type LightPatch,
} from "@/lib/maps";
import { ColorField } from "@/components/ui/ColorField";
import { Slider } from "@/components/ui/Slider";
import { CoordInput } from "@/components/MapEditor/inspector/CoordInput";

export function LightCard({
  light,
  onPatchLive,
  onCommit,
  onMoveLive,
  onDelete,
  beginGesture,
  endGesture,
}: {
  light: MapLightPoint;
  onPatchLive: (patch: LightPatch) => void;
  onCommit: (patch: LightPatch) => void;
  onMoveLive: (pos: [number, number, number]) => void;
  onDelete: () => void;
  beginGesture: () => void;
  endGesture: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => () => endGesture(), [endGesture]);

  return (
    <div className="map-editor__selection-card">
      <h4 tabIndex={-1} data-inspector-card-heading>
        {t("mapEditor.light")}
      </h4>

      <label className="map-editor__field">
        <span>X</span>
        <CoordInput
          value={light.position[0]}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(n) =>
            onMoveLive([n, light.position[1], light.position[2]])
          }
        />
      </label>
      <label className="map-editor__field">
        <span>Z</span>
        <CoordInput
          value={light.position[2]}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(n) =>
            onMoveLive([light.position[0], light.position[1], n])
          }
        />
      </label>

      <label className="map-editor__field">
        <span>
          {t("mapEditor.lightHeight")}: {light.position[1].toFixed(1)}m
        </span>
        <div onFocusCapture={beginGesture} onBlurCapture={endGesture}>
          <Slider
            variant="dark"
            min={LIGHT_HEIGHT_MIN}
            max={LIGHT_HEIGHT_MAX}
            step={0.1}
            value={light.position[1]}
            aria-label={t("mapEditor.lightHeight")}
            onChange={(v) =>
              onPatchLive({
                position: [light.position[0], v, light.position[2]],
              })
            }
          />
        </div>
      </label>

      <label className="map-editor__field">
        <span>
          {t("mapEditor.lightIntensity")}: {light.intensity.toFixed(2)}
        </span>
        <div onFocusCapture={beginGesture} onBlurCapture={endGesture}>
          <Slider
            variant="dark"
            min={LIGHT_INTENSITY_MIN}
            max={LIGHT_INTENSITY_MAX}
            step={LIGHT_INTENSITY_STEP}
            value={light.intensity}
            aria-label={t("mapEditor.lightIntensity")}
            onChange={(v) => onPatchLive({ intensity: v })}
          />
        </div>
      </label>

      <label className="map-editor__field">
        <span>
          {t("mapEditor.lightRange")}: {light.distance.toFixed(0)}m
        </span>
        <div onFocusCapture={beginGesture} onBlurCapture={endGesture}>
          <Slider
            variant="dark"
            min={LIGHT_DISTANCE_MIN}
            max={LIGHT_DISTANCE_MAX}
            step={1}
            value={light.distance}
            aria-label={t("mapEditor.lightRange")}
            onChange={(v) => onPatchLive({ distance: v })}
          />
        </div>
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.lightColor")}</span>
        <ColorField
          variant="dark"
          value={light.color}
          onChange={(v) => onCommit({ color: v })}
        />
      </label>

      <button type="button" className="map-editor__danger" onClick={onDelete}>
        {t("mapEditor.deleteLight")}
      </button>
    </div>
  );
}
