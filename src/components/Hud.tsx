import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";

export function Hud() {
  const { t } = useTranslation();
  const userName = useArenaStore((s) => s.userName);
  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const activeMap = useArenaStore((s) => s.activeMap);
  const setSettingsOpen = useArenaStore((s) => s.setSettingsOpen);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);
  const openMapEditor = useArenaStore((s) => s.openMapEditor);

  return (
    <header className="hud">
      <div className="hud__brand">
        <div className="hud__title">{t("app.title")}</div>
        <div className="hud__sub">{t("hud.hello", { name: userName })}</div>
      </div>
      <div className="hud__stats">
        <span>
          {t("hud.agents")}: {agents.length}
        </span>
        <span>
          {t("hud.models")}: {models.length}
        </span>
        <span>
          {t("hud.map")}: {activeMap?.name ?? "—"}
        </span>
      </div>
      <div className="hud__actions">
        <button type="button" className="hud__ghost" onClick={() => openMapEditor()}>
          {t("hud.editMap")}
        </button>
        <button type="button" className="hud__ghost" onClick={() => setSettingsTab("agents")}>
          {t("settings.tabs.agents")}
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          {t("hud.settings")}
        </button>
      </div>
    </header>
  );
}
