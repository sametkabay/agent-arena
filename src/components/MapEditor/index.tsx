import { useMemo, useRef, useState, type DragEvent } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import { PLACEABLE_SPECS, type AssetCategory, type PlaceableId } from "@/lib/assets/catalog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const viewportApi = useRef<{
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
  } | null>(null);

  const {
    onSave,
    onExport,
    onImportFile,
    requestClose,
    confirmDiscardClose,
    showToast,
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

  const onCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const placeableId = e.dataTransfer.getData("text/placeable-id") as PlaceableId;
    if (!placeableId || !PLACEABLE_SPECS[placeableId] || !draft) return;
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

  const ctxPlaceableIds =
    ctxMenu?.kind === "placeable"
      ? selectedPlaceables.length > 0 &&
        selectedIds.includes(ctxMenu.targetId)
        ? selectedPlaceables.map((p) => p.id)
        : [ctxMenu.targetId]
      : [];
  const ctxOpIds =
    ctxMenu?.kind === "spawn"
      ? [ctxMenu.targetId]
      : ctxPlaceableIds;

  return (
    <div className="map-editor" onContextMenu={(e) => e.preventDefault()}>
      <EditorToolbar
        mapName={draft.name}
        builtin={Boolean(draft.builtin)}
        canUndo={canUndo}
        canRedo={canRedo}
        tool={tool}
        dayNight={dayNight}
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
          if (next === "spawn") setPaintId(null);
        }}
        onExport={onExport}
        onImportFile={(file) => void onImportFile(file)}
        onToggleDayNight={toggleDayNight}
        onSave={onSave}
        onClose={requestClose}
      />

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
              onDragGestureStart={beginGesture}
              onDragGestureEnd={endGesture}
              onContextMenu={setCtxMenu}
              snapStep={snapStep}
            />
          </Canvas>
          {tool === "spawn" && (
            <div className="map-editor__mode-banner">{t("mapEditor.spawnMode")}</div>
          )}
          {paintId && tool === "select" && (
            <div className="map-editor__mode-banner">
              {t("mapEditor.paintMode", { name: PLACEABLE_SPECS[paintId].label })}
            </div>
          )}
          {multiPlaceable && !paintId && !ctxMenu && (
            <div className="map-editor__mode-banner map-editor__mode-banner--select">
              {t("mapEditor.multiSelectedBanner", {
                count: selectedPlaceables.length,
              })}
            </div>
          )}
          {selectedPlaceable && !paintId && !ctxMenu && (
            <div className="map-editor__mode-banner map-editor__mode-banner--select">
              {t("mapEditor.selectedBanner", {
                name:
                  PLACEABLE_SPECS[selectedPlaceable.placeableId as PlaceableId]
                    ?.label ?? selectedPlaceable.placeableId,
              })}
            </div>
          )}
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
        />
      </div>

      <ConfirmDialog
        open={confirmClose}
        title={t("mapEditor.closeUnsavedTitle")}
        message={t("mapEditor.closeUnsavedBody")}
        confirmLabel={t("mapEditor.closeDiscard")}
        cancelLabel={t("settings.cancel")}
        danger
        onCancel={() => setConfirmClose(false)}
        onConfirm={confirmDiscardClose}
      />
    </div>
  );
}
