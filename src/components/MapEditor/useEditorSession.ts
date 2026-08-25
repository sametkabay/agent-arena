import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { cloneMap, exportMapJson } from "@/lib/maps";
import { resolveMapDefinition } from "@/lib/maps/runtime";
import type { ContextMenuState } from "@/components/MapEditor/EditorContextMenu";
import { disposeThumbRenderer } from "@/components/MapEditor/thumbnailCache";
import type { EditorTool } from "@/components/MapEditor/types";
import { useArenaStore } from "@/store/arenaStore";
import { isPlaceableId, isUserPlaceableId, type PlaceableId } from "@/lib/assets/catalog";

type UseEditorSessionArgs = {
  open: boolean;
  sourceId: string | null;
  draft: ArenaMapDefinition | null;
  reset: (next: ArenaMapDefinition | null) => void;
  setConfirmClose: Dispatch<SetStateAction<boolean>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPaintId: Dispatch<SetStateAction<PlaceableId | null>>;
  setTool: Dispatch<SetStateAction<EditorTool>>;
  setCtxMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
};

export function useEditorSession({
  open,
  sourceId,
  draft,
  reset,
  setConfirmClose,
  setSelectedIds,
  setPaintId,
  setTool,
  setCtxMenu,
}: UseEditorSessionArgs) {
  const { t } = useTranslation();
  const closeMapEditor = useArenaStore((s) => s.closeMapEditor);
  const saveMapFromEditor = useArenaStore((s) => s.saveMapFromEditor);
  const showToast = useArenaStore((s) => s.showToast);
  const baselineJson = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!open || !sourceId) {
      reset(null);
      baselineJson.current = null;
      setConfirmClose(false);
      return;
    }
    // Read customs from the store at load time only — do NOT depend on
    // `customMaps` or every upsert/import while editing will wipe the draft
    // (and unknown custom ids fall back to office).
    const customs = useArenaStore.getState().customMaps;
    const def = resolveMapDefinition(sourceId, customs);
    if (def.id !== sourceId) {
      showToast(t("mapEditor.loadError"));
      closeMapEditor();
      return;
    }
    const loaded = cloneMap(def);
    baselineJson.current = JSON.stringify(loaded);
    reset(loaded);
    setSelectedIds([]);
    setPaintId(null);
    setTool("select");
    setCtxMenu(null);
    setConfirmClose(false);
  }, [
    open,
    sourceId,
    reset,
    closeMapEditor,
    showToast,
    t,
    setConfirmClose,
    setSelectedIds,
    setPaintId,
    setTool,
    setCtxMenu,
  ]);

  useEffect(() => {
    if (!open) {
      disposeThumbRenderer();
    }
    return () => {
      disposeThumbRenderer();
    };
  }, [open]);

  const onSave = () => {
    const current = draftRef.current;
    if (!current) return;
    const name = current.name.trim() || t("mapEditor.untitled");
    saveMapFromEditor({ ...current, name }, true);
    showToast(t("mapEditor.saved"));
  };

  const isDirty = useMemo(() => {
    if (!draft || baselineJson.current == null) return false;
    return JSON.stringify(draft) !== baselineJson.current;
  }, [draft]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    closeMapEditor();
  }, [isDirty, closeMapEditor, setConfirmClose]);

  const confirmDiscardClose = useCallback(() => {
    setConfirmClose(false);
    closeMapEditor();
  }, [closeMapEditor, setConfirmClose]);

  const onExport = () => {
    const current = draftRef.current;
    if (!current) return;
    const blob = new Blob([exportMapJson(current)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName =
      current.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || current.id;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // .aamf.json only ever stores placeable ids — a user-imported GLB stays
    // in this browser's IndexedDB, so warn before the recipient is confused
    // by props missing from the file they were given.
    const hasUserAssets = current.placeables.some((p) => isUserPlaceableId(p.placeableId));
    if (hasUserAssets) showToast(t("mapEditor.importAsset.exportWarning"));
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const id = useArenaStore.getState().importMapJson(text);
      // Point the editor at the imported map so a later customMaps-driven
      // reload (if any) cannot snap back to the previous source / office.
      useArenaStore.setState({ mapEditorSourceId: id });
      const def = resolveMapDefinition(id, useArenaStore.getState().customMaps);
      reset(cloneMap(def));
      const missingUserAssets = def.placeables.some(
        (p) => isUserPlaceableId(p.placeableId) && !isPlaceableId(p.placeableId),
      );
      showToast(
        missingUserAssets ? t("mapEditor.importAsset.importMissingAssets") : t("mapEditor.imported"),
      );
    } catch {
      showToast(t("mapEditor.importError"));
    }
  };

  return {
    draftRef,
    onSave,
    onExport,
    onImportFile,
    isDirty,
    requestClose,
    confirmDiscardClose,
    showToast,
  };
}
