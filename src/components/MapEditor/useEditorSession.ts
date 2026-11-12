import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { cloneMap, exportMapJson } from "@/lib/maps";
import { resolveMapDefinition } from "@/lib/maps/runtime";
import type { ContextMenuState } from "@/components/MapEditor/EditorContextMenu";
import { disposeThumbRenderer } from "@/components/MapEditor/thumbnailCache";
import type { EditorTool } from "@/components/MapEditor/types";
import { useMapImportFlow } from "@/components/maps/useMapImportFlow";
import {
  storageFailureMessageKey,
} from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";
import type { PlaceableId } from "@/lib/assets/catalog";

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
  importButtonRef?: RefObject<HTMLButtonElement | null>;
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
  importButtonRef,
}: UseEditorSessionArgs) {
  const { t } = useTranslation();
  const closeMapEditor = useArenaStore((s) => s.closeMapEditor);
  const saveMapFromEditor = useArenaStore((s) => s.saveMapFromEditor);
  const showToast = useArenaStore((s) => s.showToast);
  const baselineJson = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Bumps on each failed save so role="alert" re-announces identical copy. */
  const [saveErrorKey, setSaveErrorKey] = useState(0);

  useEffect(() => {
    if (!open || !sourceId) {
      reset(null);
      baselineJson.current = null;
      setConfirmClose(false);
      setSaveError(null);
      return;
    }
    setSaveError(null);
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

  const dismissSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  const onSave = () => {
    const current = draftRef.current;
    if (!current) return;
    const name = current.name.trim() || t("mapEditor.untitled");
    const result = saveMapFromEditor({ ...current, name }, true);
    if (result.ok) {
      setSaveError(null);
      showToast(t("mapEditor.saved"));
      return;
    }
    // Keep an inline banner — short toasts are easy to miss under the inspector.
    setSaveError(t(storageFailureMessageKey(result.reason, "map")));
    setSaveErrorKey((k) => k + 1);
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
  };

  const applyImportedMap = useCallback(
    (id: string) => {
      // Point the editor at the imported map so a later customMaps-driven
      // reload (if any) cannot snap back to the previous source / office.
      useArenaStore.setState({ mapEditorSourceId: id });
      const def = resolveMapDefinition(id, useArenaStore.getState().customMaps);
      const loaded = cloneMap(def);
      baselineJson.current = JSON.stringify(loaded);
      reset(loaded);
      setSelectedIds([]);
      setPaintId(null);
      setTool("select");
      setCtxMenu(null);
      // Overwriting the open map keeps the same sourceId, so the load effect
      // does not re-run — clear #40 save banner / close confirm explicitly.
      setSaveError(null);
      setConfirmClose(false);
    },
    [
      reset,
      setSelectedIds,
      setPaintId,
      setTool,
      setCtxMenu,
      setConfirmClose,
    ],
  );

  const {
    pendingImport,
    finishImport,
    cancelPendingImport,
    onImportFile,
  } = useMapImportFlow({
    importButtonRef,
    onCommitted: ({ id }) => {
      applyImportedMap(id);
    },
  });

  return {
    draftRef,
    onSave,
    onExport,
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
  };
}
