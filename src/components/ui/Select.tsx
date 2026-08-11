import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: "light" | "dark";
  id?: string;
  "aria-label"?: string;
  /** Show a filter field at the top of the menu. */
  searchable?: boolean;
  searchPlaceholder?: string;
};

type MenuPos = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function computePos(el: HTMLElement): MenuPos {
  const rect = el.getBoundingClientRect();
  const maxH = 280;
  const gap = 4;
  const pad = 8;
  const spaceBelow = window.innerHeight - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openUp = spaceBelow < Math.min(maxH, 140) && spaceAbove > spaceBelow;
  const width = Math.max(rect.width, 140);
  let left = rect.left;
  if (left + width > window.innerWidth - pad) {
    left = window.innerWidth - width - pad;
  }
  if (left < pad) left = pad;

  if (openUp) {
    return {
      left,
      width,
      maxHeight: Math.min(maxH, spaceAbove),
      bottom: window.innerHeight - rect.top + gap,
    };
  }
  return {
    left,
    width,
    maxHeight: Math.min(maxH, Math.max(spaceBelow, 120)),
    top: rect.bottom + gap,
  };
}

export function Select({
  value,
  options,
  onChange,
  disabled = false,
  className,
  variant = "light",
  id,
  "aria-label": ariaLabel,
  searchable = false,
  searchPlaceholder = "Search…",
}: SelectProps) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedLabel = selected?.label ?? value;

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openMenu = () => {
    if (disabled) return;
    const visible = options;
    const idx = Math.max(
      0,
      visible.findIndex((o) => o.value === value),
    );
    setQuery("");
    setActiveIndex(idx);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPos(computePos(triggerRef.current));
  }, [open, options.length, filtered.length, searchable]);

  useEffect(() => {
    if (!open) return;

    const sync = () => {
      if (triggerRef.current) setPos(computePos(triggerRef.current));
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
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

  useEffect(() => {
    if (!open || !searchable) return;
    // Focus search after portal mounts.
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open, searchable]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, filtered]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((i) => {
      if (filtered.length === 0) return 0;
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered, open]);

  const pick = (next: string) => {
    onChange(next);
    close();
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return;
    setActiveIndex((i) => {
      const next = i + delta;
      if (next < 0) return filtered.length - 1;
      if (next >= filtered.length) return 0;
      return next;
    });
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openMenu();
      else if (e.key === "Enter" || e.key === " ") {
        const opt = filtered[activeIndex];
        if (opt) pick(opt.value);
      } else {
        moveActive(1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openMenu();
      else moveActive(-1);
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) pick(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  };

  const rootClass = [
    "aa-select",
    `aa-select--${variant}`,
    open ? "is-open" : "",
    disabled ? "is-disabled" : "",
    searchable ? "aa-select--searchable" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="aa-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="aa-select__value">{selectedLabel}</span>
        <span className="aa-select__chevron" aria-hidden />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            className={`aa-select__menu aa-select__menu--${variant}`}
            role="listbox"
            aria-activedescendant={
              filtered[activeIndex]
                ? `${listId}-opt-${activeIndex}`
                : undefined
            }
            style={{
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              top: pos.top,
              bottom: pos.bottom,
            }}
          >
            {searchable && (
              <div className="aa-select__search">
                <input
                  ref={searchRef}
                  type="search"
                  className="aa-select__search-input"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="aa-select__empty">—</div>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    id={`${listId}-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    className={
                      "aa-select__option" +
                      (isSelected ? " is-selected" : "") +
                      (isActive ? " is-active" : "")
                    }
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
