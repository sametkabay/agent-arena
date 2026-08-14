import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

type ColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: "light" | "dark";
  id?: string;
  "aria-label"?: string;
};

type Hsv = { h: number; s: number; v: number };

type MenuPos = {
  left: number;
  top: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function normalizeHex(raw: string): string | null {
  let h = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return `#${h.toUpperCase()}`;
}

function hexToHsv(hex: string): Hsv {
  const n = normalizeHex(hex) ?? "#000000";
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function keepHue(next: Hsv, prevH: number): Hsv {
  return next.s < 1e-4 ? { ...next, h: prevH } : next;
}

const PANEL_W = 220;
const PANEL_H = 280;

function computePos(el: HTMLElement): MenuPos {
  const rect = el.getBoundingClientRect();
  const gap = 8;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Open to the left of the field (into the canvas). Inspector sits on the
  // right edge of the screen — a leftward panel stays visible.
  let left = rect.left - PANEL_W - gap;
  if (left < pad) {
    // Not enough room on the left: right-align under the trigger instead.
    left = rect.right - PANEL_W;
  }
  if (left + PANEL_W > vw - pad) left = vw - PANEL_W - pad;
  if (left < pad) left = pad;

  // Prefer aligning with the top of the trigger; flip / clamp vertically.
  let top = rect.top;
  if (top + PANEL_H > vh - pad) {
    top = rect.bottom - PANEL_H;
  }
  if (top < pad) top = pad;
  if (top + PANEL_H > vh - pad) {
    top = Math.max(pad, vh - PANEL_H - pad);
  }

  return { left, top };
}

/** Swatch + hex trigger; in-app HSV popover. Commits color on pointer-up, not while dragging. */
export function ColorField({
  value,
  onChange,
  disabled = false,
  className,
  variant = "light",
  id,
  "aria-label": ariaLabel,
}: ColorFieldProps) {
  const autoId = useId();
  const panelId = `${autoId}-panel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hsvRef = useRef<Hsv>(hexToHsv(value));
  const dragRef = useRef<"sv" | "hue" | null>(null);

  const committed = normalizeHex(value) ?? "#000000";
  const committedRef = useRef(committed);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(committed));
  const [hexText, setHexText] = useState(committed);

  const draft = hsvToHex(hsv);

  const setDraft = (next: Hsv) => {
    const hsvNext = keepHue(next, hsvRef.current.h);
    hsvRef.current = hsvNext;
    setHsv(hsvNext);
    setHexText(hsvToHex(hsvNext));
  };

  const commit = (hex: string) => {
    const n = normalizeHex(hex);
    if (!n || n === committedRef.current) return;
    committedRef.current = n;
    onChange(n);
  };

  const close = (apply: boolean) => {
    if (apply) commit(hsvToHex(hsvRef.current));
    else {
      const revert = hexToHsv(committed);
      hsvRef.current = revert;
      setHsv(revert);
      setHexText(committed);
    }
    setOpen(false);
    dragRef.current = null;
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  const openPicker = () => {
    if (disabled) return;
    const current = keepHue(hexToHsv(committed), hsvRef.current.h);
    hsvRef.current = current;
    setHsv(current);
    setHexText(committed);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPos(computePos(triggerRef.current));
  }, [open]);

  useEffect(() => {
    committedRef.current = committed;
    if (open || dragRef.current) return;
    const current = keepHue(hexToHsv(committed), hsvRef.current.h);
    hsvRef.current = current;
    setHsv(current);
    setHexText(committed);
  }, [committed, open]);

  useEffect(() => {
    if (!open) return;
    const sync = () => {
      if (triggerRef.current) setPos(computePos(triggerRef.current));
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeRef.current(true);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open]);

  const applySv = (el: HTMLElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    const s = clamp((clientX - r.left) / Math.max(r.width, 1), 0, 1);
    const v = clamp(1 - (clientY - r.top) / Math.max(r.height, 1), 0, 1);
    setDraft({ h: hsvRef.current.h, s, v });
  };

  const applyHue = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    const h = clamp((clientX - r.left) / Math.max(r.width, 1), 0, 1) * 360;
    setDraft({ ...hsvRef.current, h });
  };

  const onSvDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = "sv";
    applySv(e.currentTarget, e.clientX, e.clientY);
  };

  const onHueDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = "hue";
    applyHue(e.currentTarget, e.clientX);
  };

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    if (dragRef.current === "sv") applySv(e.currentTarget, e.clientX, e.clientY);
    else applyHue(e.currentTarget, e.clientX);
  };

  const onDragUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    commit(hsvToHex(hsvRef.current));
  };

  const commitHexText = () => {
    const n = normalizeHex(hexText);
    if (!n) {
      setHexText(draft);
      return;
    }
    setDraft(keepHue(hexToHsv(n), hsvRef.current.h));
    commit(n);
  };

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const displayHex = open ? draft : committed;

  return (
    <div
      ref={rootRef}
      className={
        [
          "aa-color",
          `aa-color--${variant}`,
          open ? "is-open" : "",
          disabled ? "is-disabled" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="aa-color__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(true) : openPicker())}
      >
        <span
          className="aa-color__swatch"
          style={{ background: displayHex }}
          aria-hidden
        />
        <span className="aa-color__hex">{displayHex}</span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={`aa-color__panel aa-color__panel--${variant}`}
            role="dialog"
            aria-label={ariaLabel ?? "Color"}
            style={{ left: pos.left, top: pos.top, width: PANEL_W }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="aa-color__sv"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
              }}
              onPointerDown={onSvDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
              onPointerCancel={onDragUp}
              onLostPointerCapture={onDragUp}
            >
              <span
                className="aa-color__sv-thumb"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>
            <div
              className="aa-color__hue"
              onPointerDown={onHueDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
              onPointerCancel={onDragUp}
              onLostPointerCapture={onDragUp}
            >
              <span
                className="aa-color__hue-thumb"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  background: hueColor,
                }}
              />
            </div>
            <div className="aa-color__meta">
              <span
                className="aa-color__preview"
                style={{ background: draft }}
                aria-hidden
              />
              <input
                className="aa-color__hex-input"
                value={hexText}
                spellCheck={false}
                autoComplete="off"
                aria-label="Hex"
                onChange={(e) => setHexText(e.target.value)}
                onBlur={commitHexText}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitHexText();
                  }
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
