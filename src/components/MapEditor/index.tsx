import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import {
  getPlaceableSpec,
  isPlaceableId,
  type AssetCategory,
  type PlaceableId,
} from "@/lib/assets/placeableSpec";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MapImportConflictDialog } from "@/components/ui/MapImportConflictDialog";
import {
  EditorContextMenu,
  type ContextMenuState,
} from "@/components/MapEditor/EditorContextMenu";
import { EditorWorld } from "@/components/MapEditor/EditorWorld";
import { EditorToolbar } from "@/components/MapEditor/EditorToolbar";
import { AssetLibrary } from "@/components/MapEditor/AssetLibrary";
import { InspectorPanel } from "@/components/MapEditor/InspectorPanel";
import { useMapHistory } from "@/components/MapEditor/useMapHistory";
import { useEditorActions } from "@/components/MapEditor/useEditorActions";
import { useEditorHotkeys } from "@/components/MapEditor/useEditorHotkeys";
import { useEditorSession } from "@/components/MapEditor/useEditorSession";
import { screenToFloor } from "@/components/MapEditor/geometry";
import type { EditorTool, LibraryScope, SnapMode } from "@/components/MapEditor/types";
import { CANVAS_SHADOWS, onCanvasCreated } from "@/lib/three/canvasConfig";
import { placeableDisplayLabel } from "@/lib/assets/placeableLabel";
import {
  builtinDisplayText,
  getBuiltinMap,
  lightDisplayName,
  lightListIndex,
  zoneDisplayName,
} from "@/lib/maps";
import { useArenaStore } from "@/store/arenaStore";

export function MapEditor() {
  const { t } = useTranslation();
  const open = useArenaStore((s) => s.mapEditorOpen);
  const sourceId = useArenaStore((s) => s.mapEditorSourceId);
  const dayNight = useArenaStore((s) => s.dayNight);
  const toggleDayNight = useArenaStore((s) => s.toggleDayNight);
  const favoriteAssets = useArenaStore((s) => s.favoriteAssets ?? []);
  const toggleFavoriteAsset = useArenaStore((s) => s.toggleFavoriteAsset);

  const {
    draft,
    commit,
    setLive,
    reset,
    undo,
    redo,
    beginGesture,
    endGesture,
    canUndo,
    canRedo,
  } = useMapHistory(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<EditorTool>("select");
  const [category, setCategory] = useState<AssetCategory | "all">("all");
  const [packFilter, setPackFilter] = useState<string>("all");
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("all");
  const [snapMode, setSnapMode] = useState<SnapMode>("0.5");
  const [assetQuery, setAssetQuery] = useState("");
  const [paintId, setPaintId] = useState<PlaceableId | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const importBtnRef = useRef<HTMLButtonElement>(null);
  const setImportFocusEl = useCallback((el: HTMLButtonElement | null) => {
    importBtnRef.current = el;
  }, []);
  /** Set only by Zones/Lights list picks — canvas/placement/undo must not steal focus. */
  const pendingFocusRef = useRef<string | null>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const viewportApi = useRef<{
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
  } | null>(null);

  // Keep toast offset in sync with the live toolbar height (1–2 rows).
  useLayoutEffect(() => {
    if (!open) {
      document.documentElement.style.removeProperty(
        "--map-editor-toolbar-height",
      );
      return;
    }
    const root = editorRootRef.current;
    if (!root) return;
    const toolbar = root.querySelector(".map-editor__toolbar");
    if (!(toolbar instanceof HTMLElement)) return;
    const apply = () => {
      const h = Math.ceil(toolbar.getBoundingClientRect().height);
      document.documentElement.style.setProperty(
        "--map-editor-toolbar-height",
        `${h}px`,
      );
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(toolbar);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty(
        "--map-editor-toolbar-height",
      );
    };
  }, [open, draft?.name]);

  const {
    onSave,
    onExport,
    exportWarnOpen,
    exportWarnCount,
    confirmExport,
    cancelExport,
    onImportFile,
    pendingImport,
    finishImport,
    cancelPendingImport,
    isDirty,
    requestClose,
    confirmDiscardClose,
    showToast,
    saveError,
    saveErrorKey,
    dismissSaveError,
  } = useEditorSession({
    open,
    sourceId,
    draft,
    reset,
    setConfirmClose,
    setSelectedIds,
    setPaintId,
    setTool,
    setCtxMenu,
    importButtonRef: importBtnRef,
  });

  const {
    rotateTargets,
    deleteTargets,
    scaleTargets,
    duplicateTargets,
    rotateSelected,
    deleteSelected,
    selectInEditor,
    alignSelection,
    distributeSelection,
    updateFloor,
    patchSelectedPlaceableLive,
    movePlaceableLive,
    moveIdsLive,
    placeAsset,
    addSpawnAt,
    addZoneAt,
    addLightAt,
    patchZoneLive,
    patchLightLive,
    commitZone,
    commitLight,
  } = useEditorActions({
    draft,
    commit,
    setLive,
    snapMode,
    selectedIds,
    setSelectedIds,
    setPaintId,
    setCtxMenu,
  });

  useEditorHotkeys({
    open,
    suspended: Boolean(pendingImport) || confirmClose,
    draft,
    selectedIds,
    rotateSelected,
    deleteSelected,
    undo,
    redo,
    duplicateTargets,
    setSelectedIds,
    setPaintId,
    setCtxMenu,
  });

  const snapStep = snapMode === "off" ? 0 : Number(snapMode);

  const usedPlaceableIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of draft?.placeables ?? []) set.add(p.placeableId);
    return set;
  }, [draft?.placeables]);

  const selectedPlaceables = useMemo(
    () => draft?.placeables.filter((p) => selectedIds.includes(p.id)) ?? [],
    [draft, selectedIds],
  );
  const multiPlaceable = selectedPlaceables.length > 1;
  const selectedPlaceable =
    selectedPlaceables.length === 1 ? selectedPlaceables[0] : null;
  const selectedSpawn =
    selectedIds.length === 1
      ? draft?.spawnPoints.find((s) => s.id === selectedIds[0])
      : undefined;
  const selectedZone =
    selectedIds.length === 1
      ? (draft?.zones ?? []).find((z) => z.id === selectedIds[0])
      : undefined;
  const selectedLight =
    selectedIds.length === 1
      ? (draft?.lights ?? []).find((L) => L.id === selectedIds[0])
      : undefined;

  const onCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const placeableId = e.dataTransfer.getData("text/placeable-id") as PlaceableId;
    if (!placeableId || !isPlaceableId(placeableId) || !draft) return;
    const api = viewportApi.current;
    const pos =
      api != null
        ? screenToFloor(
            e.clientX,
            e.clientY,
            api.camera,
            api.gl.domElement,
            draft.floor.size,
            snapStep,
          )
        : null;
    placeAsset(placeableId, pos ?? [0, 0, 0]);
    showToast(t("mapEditor.placed"));
  };

  if (!open || !draft) return null;

  const builtinBase = draft.builtin ? getBuiltinMap(draft.id) : null;
  const displayMapName = builtinDisplayText({
    stored: draft.name,
    builtinDefault: builtinBase?.name,
    translated: builtinBase
      ? t(`maps.${draft.id}.name`, { defaultValue: "" }) || null
      : null,
  });

  const ctxPlaceableIds =
    ctxMenu?.kind === "placeable"
      ? selectedPlaceables.length > 0 &&
        selectedIds.includes(ctxMenu.targetId)
        ? selectedPlaceables.map((p) => p.id)
        : [ctxMenu.targetId]
      : [];
  const ctxOpIds =
    ctxMenu?.kind === "spawn" ||
    ctxMenu?.kind === "zone" ||
    ctxMenu?.kind === "light"
      ? [ctxMenu.targetId]
      : ctxPlaceableIds;

  return (
    <div
      ref={editorRootRef}
      className="map-editor"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="map-editor__top">
        <EditorToolbar
          mapName={displayMapName}
          builtin={Boolean(draft.builtin)}
          canUndo={canUndo}
          canRedo={canRedo}
          tool={tool}
          dayNight={dayNight}
          zoneCount={draft.zones?.length ?? 0}
          lightCount={draft.lights?.length ?? 0}
          onUndo={() => {
            undo();
            setCtxMenu(null);
          }}
          onRedo={() => {
            redo();
            setCtxMenu(null);
          }}
          onSetTool={(next) => {
            setTool(next);
            if (next !== "select") setPaintId(null);
          }}
          onExport={onExport}
          onImportFile={(file) => void onImportFile(file)}
          onToggleDayNight={toggleDayNight}
          onSave={onSave}
          onClose={requestClose}
          setImportFocusEl={setImportFocusEl}
        />
        {saveError && (
          <div
            key={saveErrorKey}
            className="map-editor__save-error"
            role="alert"
          >
            <span className="map-editor__save-error-text">{saveError}</span>
            <button
              type="button"
              className="map-editor__save-error-dismiss"
              aria-label={t("mapEditor.dismissSaveError")}
              onClick={dismissSaveError}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="map-editor__body">
        <AssetLibrary
          snapMode={snapMode}
          packFilter={packFilter}
          libraryScope={libraryScope}
          category={category}
          assetQuery={assetQuery}
          paintId={paintId}
          favoriteAssets={favoriteAssets}
          usedPlaceableIds={usedPlaceableIds}
          draft={draft}
          onSnapMode={setSnapMode}
          onPackFilter={setPackFilter}
          onLibraryScope={setLibraryScope}
          onCategory={setCategory}
          onAssetQuery={setAssetQuery}
          onToggleFavorite={toggleFavoriteAsset}
          onPaintAsset={(id) => {
            setPaintId((prev) => (prev === id ? null : id));
            setTool("select");
            setSelectedIds([]);
            setCtxMenu(null);
          }}
          onDraftStrip={(id) => {
            if (!draft) return;
            commit({
              ...draft,
              placeables: draft.placeables.filter((p) => p.placeableId !== id),
            });
            setSelectedIds((ids) =>
              ids.filter(
                (sid) =>
                  !draft.placeables.some(
                    (p) => p.id === sid && p.placeableId === id,
                  ),
              ),
            );
            setPaintId((pid) => (pid === id ? null : pid));
          }}
        />

        <div
          className="map-editor__viewport"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
        >
          <Canvas
            shadows={CANVAS_SHADOWS}
            dpr={[1, 1.5]}
            camera={{ position: [14, 16, 18], fov: 42, near: 0.1, far: 280 }}
            gl={{ antialias: true, powerPreference: "default" }}
            onCreated={(state) => {
              onCanvasCreated(state);
              viewportApi.current = { camera: state.camera, gl: state.gl };
            }}
            onPointerMissed={() => setCtxMenu(null)}
          >
            <EditorWorld
              draft={draft}
              selectedIds={selectedIds}
              tool={tool}
              paintPlaceableId={paintId}
              onSelect={selectInEditor}
              onMoveIds={moveIdsLive}
              onPlaceAsset={placeAsset}
              onPlaceSpawn={addSpawnAt}
              onPlaceZone={addZoneAt}
              onPlaceLight={addLightAt}
              onDragGestureStart={beginGesture}
              onDragGestureEnd={endGesture}
              onContextMenu={setCtxMenu}
              snapStep={snapStep}
            />
          </Canvas>
          {(() => {
            // Single banner slot — never stack tool + selection banners.
            let banner: { text: string; select?: boolean } | null = null;
            if (tool === "spawn") {
              banner = { text: t("mapEditor.spawnMode") };
            } else if (tool === "zone") {
              banner = { text: t("mapEditor.zoneMode") };
            } else if (tool === "light") {
              banner = { text: t("mapEditor.lightMode") };
            } else if (tool === "select" && paintId) {
              banner = {
                text: t("mapEditor.paintMode", {
                  name: placeableDisplayLabel(
                    paintId,
                    t,
                    getPlaceableSpec(paintId)?.label ?? paintId,
                  ),
                }),
              };
            } else if (tool === "select" && !ctxMenu) {
              if (multiPlaceable) {
                banner = {
                  text: t("mapEditor.multiSelectedBanner", {
                    count: selectedPlaceables.length,
                  }),
                  select: true,
                };
              } else if (selectedPlaceable) {
                banner = {
                  text: t("mapEditor.selectedBanner", {
                    name: placeableDisplayLabel(
                      selectedPlaceable.placeableId,
                      t,
                      getPlaceableSpec(selectedPlaceable.placeableId)?.label ??
                        selectedPlaceable.placeableId,
                    ),
                  }),
                  select: true,
                };
              } else if (selectedZone && draft) {
                banner = {
                  text: t("mapEditor.zoneSelectedBanner", {
                    name: zoneDisplayName(
                      selectedZone,
                      draft,
                      draft.builtin ? getBuiltinMap(draft.id) : null,
                      t,
                    ),
                  }),
                  select: true,
                };
              } else if (selectedLight && draft) {
                const lightIndex = lightListIndex(
                  draft.lights,
                  selectedLight.id,
                );
                banner = {
                  text: t("mapEditor.lightSelectedBanner", {
                    name: lightDisplayName(selectedLight, draft, lightIndex, t),
                    n: lightIndex,
                  }),
                  select: true,
                };
              }
            }
            if (!banner) return null;
            return (
              <div
                className={
                  "map-editor__mode-banner" +
                  (banner.select ? " map-editor__mode-banner--select" : "")
                }
              >
                {banner.text}
              </div>
            );
          })()}
          {ctxMenu && ctxOpIds.length > 0 && (
            <EditorContextMenu
              menu={ctxMenu}
              onClose={() => setCtxMenu(null)}
              onRotate={(delta) => rotateTargets(ctxOpIds, delta)}
              onScale={(factor) => scaleTargets(ctxOpIds, factor)}
              onDuplicate={() => duplicateTargets(ctxOpIds)}
              onDelete={() => deleteTargets(ctxOpIds)}
            />
          )}
        </div>

        <InspectorPanel
          draft={draft}
          selectedPlaceables={selectedPlaceables}
          selectedSpawn={selectedSpawn}
          selectedZone={selectedZone}
          selectedLight={selectedLight}
          commit={commit}
          setLive={setLive}
          beginGesture={beginGesture}
          endGesture={endGesture}
          rotateSelected={rotateSelected}
          scaleTargets={scaleTargets}
          alignSelection={alignSelection}
          distributeSelection={distributeSelection}
          duplicateTargets={duplicateTargets}
          deleteSelected={deleteSelected}
          patchSelectedPlaceableLive={patchSelectedPlaceableLive}
          movePlaceableLive={movePlaceableLive}
          updateFloor={updateFloor}
          patchZoneLive={patchZoneLive}
          patchLightLive={patchLightLive}
          commitZone={commitZone}
          commitLight={commitLight}
          pendingFocusRef={pendingFocusRef}
          selectInEditor={(id, opts) => {
            // List / inspector picks imply select mode (drag + selected banner)
            // and request focus on the new card heading.
            if (id) {
              pendingFocusRef.current = id;
              setTool("select");
              setPaintId(null);
            }
            selectInEditor(id, opts);
          }}
        />
      </div>

      <ConfirmDialog
        open={confirmClose}
        variant="dark"
        title={t("mapEditor.closeUnsavedTitle")}
        message={t("mapEditor.closeUnsavedBody")}
        confirmLabel={t("mapEditor.closeDiscard")}
        cancelLabel={t("settings.cancel")}
        danger
        onCancel={() => setConfirmClose(false)}
        onConfirm={confirmDiscardClose}
      />

      <ConfirmDialog
        open={exportWarnOpen}
        variant="dark"
        title={t("mapEditor.customAssets.exportTitle")}
        message={t("mapEditor.customAssets.exportWarn", {
          count: exportWarnCount,
        })}
        confirmLabel={t("mapEditor.customAssets.exportAnyway")}
        cancelLabel={t("mapEditor.customAssets.cancel")}
        onCancel={cancelExport}
        onConfirm={confirmExport}
      />

      {pendingImport?.collision && (
        <MapImportConflictDialog
          existingName={pendingImport.collision.name}
          warnUnsavedChanges={
            isDirty && pendingImport.collision.id === sourceId
          }
          onCancel={cancelPendingImport}
          onOverwrite={() => finishImport("overwrite", pendingImport)}
          onCopy={() => finishImport("copy", pendingImport)}
        />
      )}
    </div>
  );
}
