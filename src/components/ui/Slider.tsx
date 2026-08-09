import type { PointerEvent } from "react";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  variant?: "light" | "dark";
  id?: string;
  "aria-label"?: string;
  onPointerDown?: (e: PointerEvent<HTMLInputElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLInputElement>) => void;
};

/** Styled range control — track/thumb match Select borders & sage accent. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  className,
  variant = "light",
  id,
  "aria-label": ariaLabel,
  onPointerDown,
  onPointerUp,
}: SliderProps) {
  const span = max - min;
  const pct = span <= 0 ? 0 : Math.min(100, Math.max(0, ((value - min) / span) * 100));

  return (
    <div
      className={
        [
          "aa-slider",
          `aa-slider--${variant}`,
          disabled ? "is-disabled" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      style={{ ["--aa-slider-pct" as string]: `${pct}%` }}
    >
      <input
        id={id}
        type="range"
        className="aa-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}
