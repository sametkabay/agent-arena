import { useId, useRef } from "react";

type ColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: "light" | "dark";
  id?: string;
  "aria-label"?: string;
};

/** Swatch + hex trigger that opens the native color picker under the hood. */
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
  const inputId = id ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const hex = value?.startsWith("#") ? value : `#${value ?? "000000"}`;

  return (
    <div
      className={
        [
          "aa-color",
          `aa-color--${variant}`,
          disabled ? "is-disabled" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <button
        type="button"
        className="aa-color__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.click()}
      >
        <span
          className="aa-color__swatch"
          style={{ background: hex }}
          aria-hidden
        />
        <span className="aa-color__hex">{hex.toUpperCase()}</span>
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="color"
        className="aa-color__native"
        value={hex.length === 7 ? hex : "#000000"}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
