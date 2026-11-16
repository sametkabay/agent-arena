import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ASSET_CATEGORIES,
  ASSET_PACKS,
  getPlaceableSpec,
  listPlaceables,
  type AssetCategory,
  type PlaceableId,
} from "@/lib/assets/placeableSpec";
import { isUserAssetId } from "@/lib/userAssets/ids";
import { AssetPreview } from "@/components/MapEditor/AssetPreview";
import { ImportAssetDialog } from "@/components/MapEditor/customAssets/ImportAssetDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import type { LibraryScope, SnapMode } from "@/components/MapEditor/types";
import { useUserAssetStore } from "@/store/userAssetStore";
import { useArenaStore } from "@/store/arenaStore";
import type { ArenaMapDefinition } from "@/lib/maps/schema";

export function AssetLibrary({
  snapMode,
  packFilter,
  libraryScope,
  category,
  assetQuery,
  paintId,
  favoriteAssets,
  usedPlaceableIds,
  draft,
  onSnapMode,
  onPackFilter,
  onLibraryScope,
  onCategory,
  onAssetQuery,
  onToggleFavorite,
  onPaintAsset,
  onDraftStrip,
}: {
  snapMode: SnapMode;
  packFilter: string;
  libraryScope: LibraryScope;
  category: AssetCategory | "all";
  assetQuery: string;
  paintId: PlaceableId | null;
  favoriteAssets: string[];
  usedPlaceableIds: Set<string>;
  draft: ArenaMapDefinition | null;
  onSnapMode: (mode: SnapMode) => void;
  onPackFilter: (pack: string) => void;
  onLibraryScope: (scope: LibraryScope) => void;
  onCategory: (cat: AssetCategory | "all") => void;
  onAssetQuery: (q: string) => void;
  onToggleFavorite: (id: PlaceableId) => void;
  onPaintAsset: (id: PlaceableId) => void;
  onDraftStrip?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const showToast = useArenaStore((s) => s.showToast);
  const metas = useUserAssetStore((s) => s.metas);
  const status = useUserAssetStore((s) => s.status);
  const renameAsset = useUserAssetStore((s) => s.renameAsset);
  const deleteAsset = useUserAssetStore((s) => s.deleteAsset);
  const usageOf = useUserAssetStore((s) => s.usageOf);

  const [importOpen, setImportOpen] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuId) return;
    const onPointer = (e: PointerEvent) => {
      const root = menuWrapRef.current;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuId(null);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  useEffect(() => {
    if (!menuId) return;
    const pop = menuWrapRef.current?.querySelector<HTMLElement>(
      '[role="menu"]',
    );
    const first = pop?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [menuId]);

  const libraryGroups = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    const fav = new Set(favoriteAssets);
    const cats =
      category === "all" ? ASSET_CATEGORIES : ([category] as AssetCategory[]);
    const userIds = new Set(metas.map((m) => m.id));
    return cats
      .map((cat) => {
        const ids = listPlaceables(cat).filter((id) => {
          if (cat === "custom" && !userIds.has(id) && isUserAssetId(id)) {
            return false;
          }
          const spec = getPlaceableSpec(id);
          if (packFilter !== "all" && spec?.pack !== packFilter) return false;
          if (libraryScope === "favorites" && !fav.has(id)) return false;
          if (libraryScope === "used" && !usedPlaceableIds.has(id)) return false;
          if (!q) return true;
          const label = (spec?.label ?? "").toLowerCase();
          return label.includes(q) || id.toLowerCase().includes(q);
        });
        return { category: cat, ids };
      })
      .filter((g) => {
        if (g.ids.length > 0) return true;
        // Hide empty Custom in "All" and during searches; show when Custom tab is active.
        if (g.category === "custom") {
          return category === "custom" && !q;
        }
        return false;
      });
  }, [
    category,
    assetQuery,
    packFilter,
    libraryScope,
    favoriteAssets,
    usedPlaceableIds,
    metas,
  ]);

  const libraryMatchCount = useMemo(
    () => libraryGroups.reduce((n, g) => n + g.ids.length, 0),
    [libraryGroups],
  );

  const deleteUsage = deleteId ? usageOf(deleteId, draft) : null;
  const deleteName =
    (deleteId && getPlaceableSpec(deleteId)?.label) ||
    metas.find((m) => m.id === deleteId)?.name ||
    "";

  return (
    <aside className="map-editor__library">
      <div className="map-editor__library-head">
        <h3>{t("mapEditor.library")}</h3>
        <button
          type="button"
          className="map-editor__import-asset"
          onClick={() => {
            setReplaceId(null);
            setImportOpen(true);
          }}
          disabled={status === "unavailable"}
          data-testid="import-asset-button"
          aria-label={t("mapEditor.customAssets.importButton")}
        >
          {t("mapEditor.customAssets.importButton")}
        </button>
      </div>
      {status === "unavailable" && (
        <p className="map-editor__hint" role="status">
          {t("mapEditor.customAssets.errUnavailable")}
        </p>
      )}
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
          className="map-editor__filter-snap"
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
          className="map-editor__filter-pack"
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
            data-testid={c === "custom" ? "cat-custom" : undefined}
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
                const spec = getPlaceableSpec(id);
                if (!spec) return null;
                const fav = favoriteAssets.includes(id);
                const isUser = isUserAssetId(id);
                const external =
                  isUser && "external" in spec && spec.external;
                const menuOpen = menuId === id;
                return (
                  <div
                    key={id}
                    className={
                      "map-editor__asset-wrap" +
                      (paintId === id ? " is-active" : "")
                    }
                    data-testid={isUser ? `custom-asset-${id}` : undefined}
                    data-user-asset={isUser ? "true" : undefined}
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
                      <span className="map-editor__asset-name">
                        {spec.label}
                        {external ? (
                          <span
                            className="map-editor__external-badge"
                            title={t("mapEditor.customAssets.externalBadge")}
                            aria-label={t("mapEditor.customAssets.externalBadge")}
                          >
                            {" "}
                            ↗
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={"map-editor__fav" + (fav ? " is-on" : "")}
                      title={t("mapEditor.favorite")}
                      aria-label={t("mapEditor.favorite")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(id);
                      }}
                    >
                      ★
                    </button>
                    {isUser && (
                      <div
                        className="map-editor__asset-menu"
                        ref={menuOpen ? menuWrapRef : undefined}
                      >
                        <button
                          type="button"
                          className="map-editor__asset-menu-btn"
                          aria-label={t("mapEditor.customAssets.manage")}
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          data-testid={`custom-asset-menu-${id}`}
                          ref={(el) => {
                            if (menuOpen) menuBtnRef.current = el;
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuOpen ? null : id);
                          }}
                        >
                          ⋯
                        </button>
                        {menuOpen && (
                          <div
                            className="map-editor__asset-menu-pop"
                            role="menu"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setRenameId(id);
                                setRenameValue(spec.label);
                                setMenuId(null);
                              }}
                            >
                              {t("mapEditor.customAssets.rename")}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setReplaceId(id);
                                setImportOpen(true);
                                setMenuId(null);
                              }}
                            >
                              {t("mapEditor.customAssets.replace")}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setDeleteId(id);
                                setMenuId(null);
                              }}
                            >
                              {t("mapEditor.customAssets.delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {group.category === "custom" &&
              group.ids.length === 0 &&
              category === "custom" && (
                <p className="map-editor__hint">
                  {t("mapEditor.customAssets.pickFilesHint")}
                </p>
              )}
          </section>
        ))}
        {libraryMatchCount === 0 && (
          <p className="map-editor__hint">{t("mapEditor.searchEmpty")}</p>
        )}
      </div>
      <p className="map-editor__hint">{t("mapEditor.libraryHint")}</p>

      <ImportAssetDialog
        open={importOpen}
        mode={replaceId ? "replace" : "import"}
        replaceId={replaceId ?? undefined}
        onClose={() => {
          setImportOpen(false);
          setReplaceId(null);
        }}
      />

      <ConfirmDialog
        open={!!renameId}
        variant="dark"
        title={t("mapEditor.customAssets.rename")}
        message=""
        confirmLabel={t("mapEditor.customAssets.rename")}
        cancelLabel={t("mapEditor.customAssets.cancel")}
        onCancel={() => setRenameId(null)}
        onConfirm={() => {
          if (!renameId) return;
          void renameAsset(renameId, renameValue)
            .then(() => setRenameId(null))
            .catch(() => {
              showToast(t("mapEditor.customAssets.renameFailed"));
              // Keep the dialog open so the user can retry or cancel.
            });
        }}
      >
        <label className="map-editor__field confirm-dialog__field">
          <span>{t("mapEditor.customAssets.name")}</span>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            data-testid="rename-asset-input"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteId}
        variant="dark"
        title={t("mapEditor.customAssets.deleteTitle", { name: deleteName })}
        message={
          deleteUsage && deleteUsage.displayCount > 0
            ? t("mapEditor.customAssets.deleteConfirm", {
                count: deleteUsage.displayCount,
                maps: deleteUsage.maps.map((m) => m.name).join(", ") || "—",
              })
            : t("mapEditor.customAssets.deleteConfirmUnused")
        }
        confirmLabel={t("mapEditor.customAssets.delete")}
        cancelLabel={t("mapEditor.customAssets.cancel")}
        danger
        onCancel={() => {
          if (!deleting) setDeleteId(null);
        }}
        onConfirm={() => {
          if (!deleteId || deleting) return;
          const id = deleteId;
          setDeleting(true);
          void deleteAsset(id, draft)
            .then(() => {
              onDraftStrip?.(id);
              showToast(t("mapEditor.customAssets.deleted"));
              setDeleteId(null);
            })
            .catch(() => {
              showToast(t("mapEditor.customAssets.deleteFailed"));
              setDeleteId(null);
            })
            .finally(() => setDeleting(false));
        }}
      />
    </aside>
  );
}
