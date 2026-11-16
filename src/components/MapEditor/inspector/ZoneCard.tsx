import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  MAP_ZONE_KINDS,
  ZONE_NAME_MAX,
  ZONE_RADIUS_MIN,
  ZONE_SIZE_MIN,
  convertZoneToRect,
  isRectZone,
  sanitizeZoneName,
  zoneRadiusMax,
  zoneSizeMax,
  type MapZone,
  type MapZoneKind,
} from "@/lib/maps";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { CoordInput } from "@/components/MapEditor/inspector/CoordInput";
import type { ZonePatch } from "@/lib/maps";

export function ZoneCard({
  zone,
  floorSize,
  onPatchLive,
  onCommit,
  onMoveLive,
  onDelete,
  beginGesture,
  endGesture,
}: {
  zone: MapZone;
  floorSize: number;
  onPatchLive: (patch: ZonePatch) => void;
  onCommit: (patch: ZonePatch) => void;
  onMoveLive: (pos: [number, number, number]) => void;
  onDelete: () => void;
  beginGesture: () => void;
  endGesture: () => void;
}) {
  const { t } = useTranslation();
  const rect = isRectZone(zone);
  const sizeMax = zoneSizeMax(floorSize);
  const radiusMax = zoneRadiusMax(floorSize);
  const kindValue = MAP_ZONE_KINDS.includes(zone.kind as MapZoneKind)
    ? zone.kind
    : "custom";
  const fallbackName = t("mapEditor.zoneDefaultName", { n: 1 });

  // Card may unmount while a slider/number field still has focus (click floor /
  // switch selection) — blur never fires, so end the gesture on cleanup.
  useEffect(() => () => endGesture(), [endGesture]);

  return (
    <div className="map-editor__selection-card">
      <h4 tabIndex={-1} data-inspector-card-heading>
        {t("mapEditor.zone")}
      </h4>

      <label className="map-editor__field">
        <span>{t("mapEditor.zoneName")}</span>
        <input
          type="text"
          maxLength={ZONE_NAME_MAX}
          value={zone.name}
          onFocus={beginGesture}
          onBlur={() => {
            onPatchLive({
              name: sanitizeZoneName(zone.name, fallbackName),
            });
            endGesture();
          }}
          onChange={(e) => onPatchLive({ name: e.target.value })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.zoneKind")}</span>
        <Select
          variant="dark"
          value={kindValue}
          onChange={(v) => onCommit({ kind: v as MapZoneKind })}
          options={MAP_ZONE_KINDS.map((k) => ({
            value: k,
            label: t(`mapEditor.zoneKinds.${k}`),
          }))}
        />
      </label>

      <label className="map-editor__field">
        <span>X</span>
        <CoordInput
          value={zone.center[0]}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(n) => onMoveLive([n, zone.center[1], zone.center[2]])}
        />
      </label>
      <label className="map-editor__field">
        <span>Z</span>
        <CoordInput
          value={zone.center[2]}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(n) => onMoveLive([zone.center[0], zone.center[1], n])}
        />
      </label>

      {rect ? (
        <>
          <label className="map-editor__field">
            <span>
              {t("mapEditor.zoneWidth")}: {zone.size[0].toFixed(1)}m
            </span>
            <div
              onFocusCapture={beginGesture}
              onBlurCapture={endGesture}
            >
              <Slider
                variant="dark"
                min={ZONE_SIZE_MIN}
                max={sizeMax}
                step={0.1}
                value={zone.size[0]}
                aria-label={t("mapEditor.zoneWidth")}
                onChange={(v) =>
                  onPatchLive({ size: [v, zone.size[1]] })
                }
              />
            </div>
          </label>
          <label className="map-editor__field">
            <span>
              {t("mapEditor.zoneDepth")}: {zone.size[1].toFixed(1)}m
            </span>
            <div
              onFocusCapture={beginGesture}
              onBlurCapture={endGesture}
            >
              <Slider
                variant="dark"
                min={ZONE_SIZE_MIN}
                max={sizeMax}
                step={0.1}
                value={zone.size[1]}
                aria-label={t("mapEditor.zoneDepth")}
                onChange={(v) =>
                  onPatchLive({ size: [zone.size[0], v] })
                }
              />
            </div>
          </label>
        </>
      ) : (
        <>
          <label className="map-editor__field">
            <span>
              {t("mapEditor.zoneRadius")}: {zone.radius.toFixed(1)}m
            </span>
            <div
              onFocusCapture={beginGesture}
              onBlurCapture={endGesture}
            >
              <Slider
                variant="dark"
                min={ZONE_RADIUS_MIN}
                max={radiusMax}
                step={0.1}
                value={zone.radius}
                aria-label={t("mapEditor.zoneRadius")}
                onChange={(v) => onPatchLive({ radius: v })}
              />
            </div>
          </label>
          <button
            type="button"
            className="map-editor__inline-btn"
            onClick={() => {
              const next = convertZoneToRect(zone, floorSize);
              onCommit({
                size: next.size,
                radius: next.radius,
                center: next.center,
              });
            }}
          >
            {t("mapEditor.zoneConvertToRect")}
          </button>
        </>
      )}

      <button type="button" className="map-editor__danger" onClick={onDelete}>
        {t("mapEditor.deleteZone")}
      </button>
    </div>
  );
}
