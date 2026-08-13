import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { DayNightSwitch } from "@/components/ui/DayNightSwitch";
import type { DayNightMode } from "@/lib/dayNight";
import type { EditorTool } from "@/components/MapEditor/types";

export function EditorToolbar({
  mapName,
  builtin,
  canUndo,
  canRedo,
  tool,
  dayNight,
  onUndo,
  onRedo,
  onSetTool,
  onExport,
  onImportFile,
  onToggleDayNight,
  onSave,
  onClose,
}: {
  mapName: string;
  builtin: boolean;
  canUndo: boolean;
  canRedo: boolean;
  tool: EditorTool;
  dayNight: DayNightMode;
  onUndo: () => void;
  onRedo: () => void;
  onSetTool: (tool: EditorTool) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onToggleDayNight: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <header className="map-editor__toolbar">
      <div className="map-editor__brand">
        <strong>{t("mapEditor.title")}</strong>
        <span>{mapName}</span>
        {builtin && (
          <em className="map-editor__badge">{t("mapEditor.builtinHint")}</em>
        )}
      </div>
      <div className="map-editor__toolbar-actions">
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
        <span className="map-editor__toolbar-sep" />
        <button
          type="button"
          className={tool === "select" ? "is-active" : ""}
          onClick={() => onSetTool("select")}
        >
          {t("mapEditor.toolSelect")}
        </button>
        <button
          type="button"
          className={tool === "spawn" ? "is-active" : ""}
          onClick={() => onSetTool("spawn")}
        >
          {t("mapEditor.toolSpawn")}
        </button>
        <button type="button" onClick={onExport}>
          {t("mapEditor.export")}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          {t("mapEditor.import")}
        </button>
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
