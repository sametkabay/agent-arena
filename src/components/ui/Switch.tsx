type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

/** Soft sage toggle — matches Select / settings chrome. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={
        [
          "aa-switch",
          checked ? "is-on" : "is-off",
          disabled ? "is-disabled" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span className="aa-switch__track" aria-hidden>
        <span className="aa-switch__glow" />
      </span>
      <span className="aa-switch__thumb" aria-hidden />
    </button>
  );
}
