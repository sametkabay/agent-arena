import { useEffect } from "react";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import type { PlaceableId } from "@/lib/assets/catalog";
import type { ContextMenuState } from "@/components/MapEditor/EditorContextMenu";
import { shouldSkipEditorHotkey } from "@/lib/editorHotkeys";

type UseEditorHotkeysArgs = {
  open: boolean;
  /** True while import-conflict or close-confirm dialog is open. */
  suspended?: boolean;
  draft: ArenaMapDefinition | null;
  selectedIds: string[];
  rotateSelected: (delta?: number) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  duplicateTargets: (ids: string[]) => void;
  setSelectedIds: (ids: string[]) => void;
  setPaintId: (id: PlaceableId | null) => void;
  setCtxMenu: (menu: ContextMenuState | null) => void;
};

export function useEditorHotkeys({
  open,
  suspended = false,
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
}: UseEditorHotkeysArgs) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!draft) return;
      if (
        shouldSkipEditorHotkey(e, {
          suspended,
          targetTagName: (e.target as HTMLElement)?.tagName,
        })
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        setCtxMenu(null);
        return;
      }
      if (
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        setCtxMenu(null);
        return;
      }

      if (e.key === "Escape") {
        setSelectedIds([]);
        setPaintId(null);
        setCtxMenu(null);
        return;
      }
      if ((e.key === "r" || e.key === "R") && selectedIds.length) {
        e.preventDefault();
        rotateSelected();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length
      ) {
        e.preventDefault();
        deleteSelected();
      }
      if ((e.key === "d" || e.key === "D") && mod && selectedIds.length) {
        e.preventDefault();
        duplicateTargets(selectedIds);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    suspended,
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
  ]);
}
