import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export type ContextMenuState = {
  x: number;
  y: number;
  targetId: string;
  kind: "placeable" | "spawn";
};

export function EditorContextMenu({
  menu,
  onClose,
  onRotate,
  onScale,
  onDuplicate,
  onDelete,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onRotate: (delta: number) => void;
  onScale: (factor: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const left = Math.min(menu.x, window.innerWidth - 200);
  const top = Math.min(menu.y, window.innerHeight - 260);

  return (
    <div
      ref={ref}
      className="map-editor__ctx"
      style={{ left, top }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onRotate(-Math.PI / 2);
          onClose();
        }}
      >
        {t("mapEditor.ctx.rotateLeft")}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onRotate(Math.PI / 2);
          onClose();
        }}
      >
        {t("mapEditor.ctx.rotateRight")}
      </button>
      {menu.kind === "placeable" && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onScale(1.15);
              onClose();
            }}
          >
            {t("mapEditor.ctx.scaleUp")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onScale(1 / 1.15);
              onClose();
            }}
          >
            {t("mapEditor.ctx.scaleDown")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          >
            {t("mapEditor.ctx.duplicate")}
          </button>
        </>
      )}
      <div className="map-editor__ctx-sep" />
      <button
        type="button"
        role="menuitem"
        className="is-danger"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        {menu.kind === "spawn"
          ? t("mapEditor.deleteSpawn")
          : t("mapEditor.deleteObject")}
      </button>
    </div>
  );
}
