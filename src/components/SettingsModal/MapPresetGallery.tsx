import { useTranslation } from "react-i18next";
import {
  MAP_PRESETS,
  resolvePresetDefinition,
  type MapPresetMeta,
} from "@/lib/maps/presets";
import { clipMapDescription } from "@/lib/maps/clipMapDescription";
import { buildMapThumbnail } from "@/lib/maps/mapThumbnail";
import { useArenaStore } from "@/store/arenaStore";
import { MapThumbnail } from "@/components/SettingsModal/MapThumbnail";

const PRESET_THUMBNAILS = Object.fromEntries(
  MAP_PRESETS.map((meta) => {
    const def = resolvePresetDefinition(meta);
    return [meta.id, buildMapThumbnail(def)] as const;
  }),
);

function PresetCard({ meta }: { meta: MapPresetMeta }) {
  const { t } = useTranslation();
  const createMapFromPresetAndEdit = useArenaStore(
    (s) => s.createMapFromPresetAndEdit,
  );
  const name = t(meta.nameKey, { defaultValue: meta.name });
  const description = t(meta.descriptionKey, {
    defaultValue: meta.description ?? "",
  });
  const descId = `map-preset-desc-${meta.id}`;
  const thumb = PRESET_THUMBNAILS[meta.id];

  return (
    <div className="map-card map-preset-card">
      <button
        type="button"
        className="map-card__select"
        data-testid={`map-preset-${meta.id}`}
        aria-label={t("settings.map.presetCreateAria", { name })}
        aria-describedby={descId}
        onClick={() =>
          createMapFromPresetAndEdit(
            meta.id,
            name,
            t("settings.agents.copyLabel"),
          )
        }
      >
        <div className="map-card__preview map-preset-card__preview">
          {thumb ? <MapThumbnail model={thumb} className="map-preset-card__svg" /> : null}
        </div>
        <div className="card-item__title">{name}</div>
        <div className="card-item__sub" id={descId} title={description}>
          {clipMapDescription(description)}
        </div>
      </button>
    </div>
  );
}

/** Compact "Start from a preset" gallery for Settings → Map. */
export function MapPresetGallery() {
  const { t } = useTranslation();
  if (MAP_PRESETS.length === 0) return null;

  return (
    <section className="map-preset-gallery" aria-labelledby="map-presets-title">
      <h4 className="map-tab__section-title" id="map-presets-title">
        {t("settings.map.presetsTitle")}
      </h4>
      <p className="settings-hint map-preset-gallery__hint">
        {t("settings.map.presetsHint")}
      </p>
      <div className="map-grid map-preset-gallery__grid">
        {MAP_PRESETS.map((meta) => (
          <PresetCard key={meta.id} meta={meta} />
        ))}
      </div>
    </section>
  );
}
