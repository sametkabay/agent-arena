import { useTranslation } from "react-i18next";
import type { DayNightMode } from "@/lib/dayNight";

/** Decorative day/night toggle — no visible labels, aria for a11y. */
export function DayNightSwitch({
  mode,
  onToggle,
}: {
  mode: DayNightMode;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const isNight = mode === "night";

  return (
    <button
      type="button"
      className={"daynight-switch" + (isNight ? " is-night" : " is-day")}
      role="switch"
      aria-checked={isNight}
      aria-label={isNight ? t("hud.switchToDay") : t("hud.switchToNight")}
      title={isNight ? t("hud.switchToDay") : t("hud.switchToNight")}
      onClick={onToggle}
    >
      <span className="daynight-switch__track" aria-hidden>
        <span className="daynight-switch__stars" />
        <span className="daynight-switch__clouds" />
      </span>
      <span className="daynight-switch__thumb" aria-hidden>
        <span className="daynight-switch__sun" />
        <span className="daynight-switch__moon" />
      </span>
    </button>
  );
}
