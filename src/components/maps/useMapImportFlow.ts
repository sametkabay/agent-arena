import { useCallback, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { MapImportCommitMode, PreparedMapImport } from "@/lib/maps";
import { isPersistFailedError } from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";

type UseMapImportFlowArgs = {
  importButtonRef?: RefObject<HTMLButtonElement | null>;
  /**
   * Called after a successful commit (before pending state is cleared).
   * Use for editor draft reload; toasts are handled here.
   */
  onCommitted?: (args: {
    id: string;
    mode: MapImportCommitMode;
    prepared: PreparedMapImport;
  }) => void;
};

/**
 * Shared Settings Map tab + Map Editor import flow: parse → optional
 * conflict dialog → commit, with localized toasts (never raw err.message).
 */
export function useMapImportFlow({
  importButtonRef,
  onCommitted,
}: UseMapImportFlowArgs = {}) {
  const { t } = useTranslation();
  const parseMapImport = useArenaStore((s) => s.parseMapImport);
  const commitMapImport = useArenaStore((s) => s.commitMapImport);
  const showToast = useArenaStore((s) => s.showToast);
  const [pendingImport, setPendingImport] = useState<PreparedMapImport | null>(
    null,
  );
  const committingRef = useRef(false);

  const focusImport = useCallback(() => {
    importButtonRef?.current?.focus();
  }, [importButtonRef]);

  const finishImport = useCallback(
    (mode: MapImportCommitMode, prepared: PreparedMapImport) => {
      if (committingRef.current) return;
      committingRef.current = true;
      try {
        const id = commitMapImport(
          prepared,
          mode,
          t("settings.agents.copyLabel"),
        );
        onCommitted?.({ id, mode, prepared });
        if (mode === "copy") {
          const saved = useArenaStore
            .getState()
            .customMaps.find((m) => m.id === id);
          showToast(
            t("settings.map.importedAsCopy", {
              name: saved?.name ?? prepared.def.name,
            }),
          );
        } else if (prepared.collision) {
          showToast(t("settings.map.overwritten"));
        } else {
          showToast(t("mapEditor.imported"));
        }
      } catch (err) {
        // Persist failure already toasted via persist({ toast: "map" }).
        if (isPersistFailedError(err)) return;
        showToast(t("mapEditor.importError"));
      } finally {
        committingRef.current = false;
        setPendingImport(null);
        focusImport();
      }
    },
    [commitMapImport, focusImport, onCommitted, showToast, t],
  );

  const onImportFile = useCallback(
    async (file: File) => {
      try {
        const prepared = parseMapImport(await file.text());
        if (prepared.collision) {
          setPendingImport(prepared);
          return;
        }
        finishImport("overwrite", prepared);
      } catch (err) {
        if (isPersistFailedError(err)) return;
        showToast(t("mapEditor.importError"));
      }
    },
    [finishImport, parseMapImport, showToast, t],
  );

  const cancelPendingImport = useCallback(() => {
    setPendingImport(null);
    focusImport();
  }, [focusImport]);

  return {
    pendingImport,
    finishImport,
    cancelPendingImport,
    onImportFile,
  };
}
