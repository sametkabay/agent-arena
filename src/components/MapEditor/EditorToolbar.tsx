import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DayNightSwitch } from "@/components/ui/DayNightSwitch";
import type { DayNightMode } from "@/lib/dayNight";
import type { EditorTool } from "@/components/MapEditor/types";
import { MAX_LIGHTS, MAX_ZONES } from "@/lib/maps/mapRegions";

const NARROW_MQ = "(max-width: 720px)";

function isNarrowViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(NARROW_MQ).matches;
}

export function EditorToolbar({
  mapName,
  builtin,
  canUndo,
  canRedo,
  tool,
  dayNight,
  zoneCount,
  lightCount,
  onUndo,
  onRedo,
  onSetTool,
  onExport,
  onImportFile,
  onToggleDayNight,
  onSave,
  onClose,
  setImportFocusEl,
}: {
  mapName: string;
  builtin: boolean;
  canUndo: boolean;
  canRedo: boolean;
  tool: EditorTool;
  dayNight: DayNightMode;
  zoneCount: number;
  lightCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onSetTool: (tool: EditorTool) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onToggleDayNight: () => void;
  onSave: () => void;
  onClose: () => void;
  /** Narrow → More button; desktop → Import. Used to restore focus after import. */
  setImportFocusEl?: (el: HTMLButtonElement | null) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const desktopImportEl = useRef<HTMLButtonElement | null>(null);
  const moreBtnEl = useRef<HTMLButtonElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const zonesFull = zoneCount >= MAX_ZONES;
  const lightsFull = lightCount >= MAX_LIGHTS;
  const builtinHint = t("mapEditor.builtinHint");

  const syncImportFocusTarget = () => {
    if (!setImportFocusEl) return;
    setImportFocusEl(
      isNarrowViewport() ? moreBtnEl.current : desktopImportEl.current,
    );
  };

  useEffect(() => {
    syncImportFocusTarget();
    const mq = window.matchMedia(NARROW_MQ);
    mq.addEventListener("change", syncImportFocusTarget);
    return () => mq.removeEventListener("change", syncImportFocusTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync reads latest element refs
  }, [setImportFocusEl]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMoreOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    // Capture so Esc closes the menu without clearing the editor selection.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [moreOpen]);

  return (
    <header className="map-editor__toolbar">
      <div className="map-editor__brand">
        <strong>{t("mapEditor.title")}</strong>
        <span>{mapName}</span>
        {builtin && (
          <em className="map-editor__badge map-editor__badge--full">
            {builtinHint}
          </em>
        )}
      </div>
      <div className="map-editor__toolbar-actions">
        <div className="map-editor__toolbar-cluster">
          <button
            type="button"
            disabled={!canUndo}
            title={`${t("mapEditor.undo")} (Ctrl/⌘Z)`}
            onClick={onUndo}
          >
            {t("mapEditor.undo")}
          </button>
          <button
            type="button"
            disabled={!canRedo}
            title={`${t("mapEditor.redo")} (Ctrl/⌘⇧Z)`}
            onClick={onRedo}
          >
            {t("mapEditor.redo")}
          </button>
        </div>
        <span className="map-editor__toolbar-sep" aria-hidden />
        <div className="map-editor__toolbar-cluster">
          <button
            type="button"
            className={tool === "select" ? "is-active" : ""}
            aria-pressed={tool === "select"}
            onClick={() => onSetTool("select")}
          >
            {t("mapEditor.toolSelect")}
          </button>
          <button
            type="button"
            className={tool === "spawn" ? "is-active" : ""}
            aria-pressed={tool === "spawn"}
            onClick={() => onSetTool("spawn")}
          >
            {t("mapEditor.toolSpawn")}
          </button>
          <button
            type="button"
            className={tool === "zone" ? "is-active" : ""}
            aria-pressed={tool === "zone"}
            disabled={zonesFull}
            title={
              zonesFull
                ? t("mapEditor.zoneLimit", { max: MAX_ZONES })
                : t("mapEditor.toolZone")
            }
            onClick={() => onSetTool("zone")}
          >
            {t("mapEditor.toolZone")}
          </button>
          <button
            type="button"
            className={tool === "light" ? "is-active" : ""}
            aria-pressed={tool === "light"}
            disabled={lightsFull}
            title={
              lightsFull
                ? t("mapEditor.lightLimit", { max: MAX_LIGHTS })
                : t("mapEditor.toolLight")
            }
            onClick={() => onSetTool("light")}
          >
            {t("mapEditor.toolLight")}
          </button>
        </div>
        <span
          className="map-editor__toolbar-sep map-editor__toolbar-sep--desktop"
          aria-hidden
        />
        <div className="map-editor__toolbar-io map-editor__toolbar-io--desktop">
          <button type="button" onClick={onExport}>
            {t("mapEditor.export")}
          </button>
          <button
            ref={(el) => {
              desktopImportEl.current = el;
              if (!isNarrowViewport()) syncImportFocusTarget();
            }}
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            {t("mapEditor.import")}
          </button>
        </div>
        <div className="map-editor__toolbar-more" ref={moreRef}>
          <button
            ref={(el) => {
              moreBtnEl.current = el;
              if (isNarrowViewport()) syncImportFocusTarget();
            }}
            type="button"
            className="map-editor__toolbar-more-btn"
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => setMoreOpen((o) => !o)}
          >
            {t("mapEditor.toolbarMore")}
          </button>
          {moreOpen && (
            <div className="map-editor__toolbar-more-menu">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onExport();
                }}
              >
                {t("mapEditor.export")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  fileRef.current?.click();
                }}
              >
                {t("mapEditor.import")}
              </button>
              <button
                type="button"
                className="map-editor__toolbar-more-theme"
                onClick={() => {
                  setMoreOpen(false);
                  onToggleDayNight();
                }}
              >
                {dayNight === "night"
                  ? t("hud.switchToDay")
                  : t("hud.switchToNight")}
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = "";
          }}
        />
        {builtin && (
          <em
            className="map-editor__badge map-editor__badge--compact"
            title={builtinHint}
            aria-label={builtinHint}
          >
            {t("mapList.builtin")}
          </em>
        )}
        <DayNightSwitch mode={dayNight} onToggle={onToggleDayNight} />
        <button type="button" className="map-editor__primary" onClick={onSave}>
          {t("mapEditor.save")}
        </button>
        <button type="button" onClick={onClose}>
          {t("mapEditor.close")}
        </button>
      </div>
    </header>
  );
}
