import { useTranslation } from "react-i18next";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import {
  FLOOR_SIZE_MAX,
  FLOOR_SIZE_MIN,
  FLOOR_SURFACE_IDS,
  FLOOR_STYLES,
  cellsForFloorSize,
  clampFloorSize,
  type FloorSurfaceId,
  type FloorStyle,
} from "@/lib/maps";
import { ColorField } from "@/components/ui/ColorField";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";

export function MapSettingsCard({
  draft,
  onDescription,
  onFloorSizeLive,
  onUpdateFloor,
  onTheme,
  beginGesture,
  endGesture,
}: {
  draft: ArenaMapDefinition;
  onDescription: (value: string) => void;
  onFloorSizeLive: (size: number) => void;
  onUpdateFloor: (patch: Partial<ArenaMapDefinition["floor"]>) => void;
  onTheme: (patch: Partial<ArenaMapDefinition["theme"]>) => void;
  beginGesture: () => void;
  endGesture: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <label className="map-editor__field">
        <span>{t("mapEditor.description")}</span>
        <textarea
          rows={2}
          value={draft.description ?? ""}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) => onDescription(e.target.value)}
        />
      </label>

      <label className="map-editor__field">
        <span>
          {t("mapEditor.floorSize")}: {draft.floor.size}m ·{" "}
          {cellsForFloorSize(draft.floor.size, draft.floor.surface)}×
          {cellsForFloorSize(draft.floor.size, draft.floor.surface)}
        </span>
        <Slider
          variant="dark"
          min={FLOOR_SIZE_MIN}
          max={FLOOR_SIZE_MAX}
          step={1}
          value={draft.floor.size}
          onPointerDown={beginGesture}
          onPointerUp={endGesture}
          onChange={(v) => onFloorSizeLive(clampFloorSize(v))}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.floorSurface")}</span>
        <Select
          variant="dark"
          value={draft.floor.surface ?? "office"}
          onChange={(v) => onUpdateFloor({ surface: v as FloorSurfaceId })}
          options={FLOOR_SURFACE_IDS.map((id) => ({
            value: id,
            label: t(`mapEditor.surfaces.${id}`),
          }))}
        />
      </label>

      <div className="map-editor__surface-swatches">
        {FLOOR_SURFACE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            title={t(`mapEditor.surfaces.${id}`)}
            className={
              "map-editor__surface-swatch" +
              ((draft.floor.surface ?? "office") === id ? " is-active" : "")
            }
            style={{
              background:
                id === "grass"
                  ? "linear-gradient(135deg,#6B9B4A,#5A8A3C)"
                  : id === "dirt"
                    ? "linear-gradient(135deg,#8B6A4A,#7A5A3C)"
                    : id === "concrete"
                      ? "linear-gradient(135deg,#A8A9AB,#96989A)"
                      : id === "factory"
                        ? "linear-gradient(135deg,#3A3D42,#2E3136)"
                        : "linear-gradient(135deg,#C0B4A0,#B0A288)",
            }}
            onClick={() => onUpdateFloor({ surface: id })}
          />
        ))}
      </div>

      <label className="map-editor__field">
        <span>{t("mapEditor.floorStyle")}</span>
        <Select
          variant="dark"
          value={draft.floor.style}
          onChange={(v) => onUpdateFloor({ style: v as FloorStyle })}
          options={FLOOR_STYLES.map((style) => ({
            value: style,
            label: t(`mapEditor.styles.${style}`),
          }))}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.floorColor")}</span>
        <ColorField
          variant="dark"
          value={draft.floor.color}
          onChange={(v) => onUpdateFloor({ color: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.bgColor")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.background}
          onChange={(v) => onTheme({ background: v, fog: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.themeFog")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.fog}
          onChange={(v) => onTheme({ fog: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.themeAmbient")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.ambient}
          onChange={(v) => onTheme({ ambient: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.themeHemiSky")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.hemiSky}
          onChange={(v) => onTheme({ hemiSky: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.themeHemiGround")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.hemiGround}
          onChange={(v) => onTheme({ hemiGround: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.themeSun")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.sun}
          onChange={(v) => onTheme({ sun: v })}
        />
      </label>

      <label className="map-editor__field">
        <span>{t("mapEditor.themeAccent")}</span>
        <ColorField
          variant="dark"
          value={draft.theme.accent}
          onChange={(v) => onTheme({ accent: v })}
        />
      </label>

      <p className="map-editor__hint">{t("mapEditor.selectHint")}</p>
    </>
  );
}
