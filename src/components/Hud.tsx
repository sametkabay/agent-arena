import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";
import { DayNightSwitch } from "@/components/ui/DayNightSwitch";

export function Hud() {
  const { t } = useTranslation();
  const userName = useArenaStore((s) => s.userName);
  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const activeMap = useArenaStore((s) => s.activeMap);
  const dayNight = useArenaStore((s) => s.dayNight);
  const toggleDayNight = useArenaStore((s) => s.toggleDayNight);
  const setSettingsOpen = useArenaStore((s) => s.setSettingsOpen);

  return (
    <header className="hud">
      <div className="hud__brand">
        <div className="hud__title">{t("app.title")}</div>
        <div className="hud__sub">{t("hud.hello", { name: userName })}</div>
      </div>
      <div className="hud__stats">
        <span>
          {t("hud.agents")}: {agents.filter((a) => a.enabled !== false).length}
        </span>
        <span>
          {t("hud.models")}: {models.length}
        </span>
        <span>
          {t("hud.map")}: {activeMap?.name ?? "—"}
        </span>
      </div>
      <div className="hud__actions">
        <DayNightSwitch mode={dayNight} onToggle={toggleDayNight} />
        <button
          type="button"
          className="hud__settings"
          aria-label={t("hud.settings")}
          title={t("hud.settings")}
          onClick={() => setSettingsOpen(true)}
        >
          <svg
            className="hud__settings-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.07.63-.07.94s.03.63.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
