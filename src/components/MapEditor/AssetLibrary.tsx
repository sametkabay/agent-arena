import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ASSET_CATEGORIES,
  ASSET_PACKS,
  PLACEABLE_SPECS,
  listPlaceables,
  type AssetCategory,
  type PlaceableId,
} from "@/lib/assets/catalog";
import { AssetPreview } from "@/components/MapEditor/AssetPreview";
import { Select } from "@/components/ui/Select";
import type { LibraryScope, SnapMode } from "@/components/MapEditor/types";

export function AssetLibrary({
  snapMode,
  packFilter,
  libraryScope,
  category,
  assetQuery,
  paintId,
  favoriteAssets,
  usedPlaceableIds,
  onSnapMode,
  onPackFilter,
  onLibraryScope,
  onCategory,
  onAssetQuery,
  onToggleFavorite,
  onPaintAsset,
}: {
  snapMode: SnapMode;
  packFilter: string;
  libraryScope: LibraryScope;
  category: AssetCategory | "all";
  assetQuery: string;
  paintId: PlaceableId | null;
  favoriteAssets: string[];
  usedPlaceableIds: Set<string>;
  onSnapMode: (mode: SnapMode) => void;
  onPackFilter: (pack: string) => void;
  onLibraryScope: (scope: LibraryScope) => void;
  onCategory: (cat: AssetCategory | "all") => void;
  onAssetQuery: (q: string) => void;
  onToggleFavorite: (id: PlaceableId) => void;
  onPaintAsset: (id: PlaceableId) => void;
}) {
  const { t } = useTranslation();

  const libraryGroups = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    const fav = new Set(favoriteAssets);
    const cats =
      category === "all" ? ASSET_CATEGORIES : ([category] as AssetCategory[]);
    return cats
      .map((cat) => {
        const ids = listPlaceables(cat).filter((id) => {
          const spec = PLACEABLE_SPECS[id];
          if (packFilter !== "all" && spec?.pack !== packFilter) return false;
          if (libraryScope === "favorites" && !fav.has(id)) return false;
          if (libraryScope === "used" && !usedPlaceableIds.has(id)) return false;
          if (!q) return true;
          const label = (spec?.label ?? "").toLowerCase();
          return label.includes(q) || id.toLowerCase().includes(q);
        });
        return { category: cat, ids };
      })
      .filter((g) => g.ids.length > 0);
  }, [
    category,
    assetQuery,
    packFilter,
    libraryScope,
    favoriteAssets,
    usedPlaceableIds,
  ]);

  const libraryMatchCount = useMemo(
    () => libraryGroups.reduce((n, g) => n + g.ids.length, 0),
    [libraryGroups],
  );

  return (
    <aside className="map-editor__library">
      <h3>{t("mapEditor.library")}</h3>
      <label className="map-editor__search">
        <span className="map-editor__sr-only">{t("mapEditor.searchAssets")}</span>
        <input
          type="search"
          value={assetQuery}
          onChange={(e) => onAssetQuery(e.target.value)}
          placeholder={t("mapEditor.searchAssets")}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="map-editor__filter-row">
        <Select
          variant="dark"
          value={snapMode}
          onChange={(v) => onSnapMode(v as SnapMode)}
          options={[
            { value: "off", label: t("mapEditor.snapOff") },
            { value: "0.5", label: t("mapEditor.snap05") },
            { value: "1", label: t("mapEditor.snap1") },
          ]}
        />
        <Select
          variant="dark"
          value={packFilter}
          onChange={onPackFilter}
          options={[
            { value: "all", label: t("mapEditor.packAll") },
            ...ASSET_PACKS.map((p) => ({
              value: p,
              label: t(`mapEditor.packs.${p}`, { defaultValue: p }),
            })),
          ]}
        />
      </div>
      <div className="map-editor__cats">
        <button
          type="button"
          className={libraryScope === "all" ? "is-active" : ""}
          onClick={() => onLibraryScope("all")}
        >
          {t("mapEditor.scopeAll")}
        </button>
        <button
          type="button"
          className={libraryScope === "favorites" ? "is-active" : ""}
          onClick={() => onLibraryScope("favorites")}
        >
          {t("mapEditor.scopeFavorites")}
        </button>
        <button
          type="button"
          className={libraryScope === "used" ? "is-active" : ""}
          onClick={() => onLibraryScope("used")}
        >
          {t("mapEditor.scopeUsed")}
        </button>
      </div>
      <div className="map-editor__cats">
        <button
          type="button"
          className={category === "all" ? "is-active" : ""}
          onClick={() => onCategory("all")}
        >
          {t("mapEditor.catAll")}
        </button>
        {ASSET_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={category === c ? "is-active" : ""}
            onClick={() => onCategory(c)}
          >
            {t(`mapEditor.cat.${c}`)}
          </button>
        ))}
      </div>
      <div className="map-editor__asset-groups">
        {libraryGroups.map((group) => (
          <section key={group.category} className="map-editor__asset-group">
            <h4 className="map-editor__asset-group-title">
              {t(`mapEditor.cat.${group.category}`)}
              <span>{group.ids.length}</span>
            </h4>
            <div className="map-editor__asset-grid">
              {group.ids.map((id) => {
                const spec = PLACEABLE_SPECS[id];
                const fav = favoriteAssets.includes(id);
                return (
                  <div
                    key={id}
                    className={
                      "map-editor__asset-wrap" +
                      (paintId === id ? " is-active" : "")
                    }
                  >
                    <button
                      type="button"
                      draggable
                      title={spec.label}
                      className={
                        "map-editor__asset" + (paintId === id ? " is-active" : "")
                      }
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/placeable-id", id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => onPaintAsset(id)}
                    >
                      <AssetPreview placeableId={id} />
                      <span className="map-editor__asset-name">{spec.label}</span>
                    </button>
                    <button
                      type="button"
                      className={"map-editor__fav" + (fav ? " is-on" : "")}
                      title={t("mapEditor.favorite")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(id);
                      }}
                    >
                      ★
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {libraryMatchCount === 0 && (
          <p className="map-editor__hint">{t("mapEditor.searchEmpty")}</p>
        )}
      </div>
      <p className="map-editor__hint">{t("mapEditor.libraryHint")}</p>
    </aside>
  );
}
