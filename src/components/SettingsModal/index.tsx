import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";
import { GeneralTab } from "@/components/SettingsModal/GeneralTab";
import { ModelsTab } from "@/components/SettingsModal/ModelsTab";
import { AgentsTab } from "@/components/SettingsModal/AgentsTab";
import { MapTab } from "@/components/SettingsModal/MapTab";
import { GraphicsTab } from "@/components/SettingsModal/GraphicsTab";
import { SettingsNavProvider } from "@/components/SettingsModal/SettingsNavContext";
import { useSettingsNav } from "@/components/SettingsModal/settingsNav";

const TABS = ["general", "models", "agents", "map", "graphics"] as const;

function SettingsModalChrome() {
  const { t } = useTranslation();
  const open = useArenaStore((s) => s.settingsOpen);
  const tab = useArenaStore((s) => s.settingsTab);
  const setSettingsOpen = useArenaStore((s) => s.setSettingsOpen);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);
  const { canGoBack, goBack, saveVisible, saveDisabled, save } = useSettingsNav();

  if (!open) return null;

  return (
    <div
      className="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={() => setSettingsOpen(false)}
    >
      <div className="settings-modal__card" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-modal__nav">
          <div className="settings-modal__nav-title">{t("settings.title")}</div>
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "is-active" : undefined}
              onClick={() => setSettingsTab(id)}
            >
              {t(`settings.tabs.${id}`)}
            </button>
          ))}
        </nav>
        <div className="settings-modal__body">
          <header className="settings-modal__header">
            <div className="settings-modal__header-lead">
              {canGoBack && (
                <button
                  type="button"
                  className="settings-modal__back"
                  onClick={goBack}
                >
                  ← {t("settings.back")}
                </button>
              )}
              <h2>{t(`settings.tabs.${tab}`)}</h2>
            </div>
            <div className="settings-modal__header-actions">
              {saveVisible && (
                <button
                  type="button"
                  className="btn btn--primary settings-modal__save"
                  disabled={saveDisabled}
                  onClick={save}
                >
                  {t("settings.save")}
                </button>
              )}
              <button
                type="button"
                className="settings-modal__close"
                onClick={() => setSettingsOpen(false)}
              >
                {t("settings.close")}
              </button>
            </div>
          </header>
          <div className="settings-modal__content">
            {tab === "general" && <GeneralTab />}
            {tab === "models" && <ModelsTab />}
            {tab === "agents" && <AgentsTab />}
            {tab === "map" && <MapTab />}
            {tab === "graphics" && <GraphicsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const open = useArenaStore((s) => s.settingsOpen);
  const tab = useArenaStore((s) => s.settingsTab);

  if (!open) return null;

  return (
    <SettingsNavProvider resetKey={tab}>
      <SettingsModalChrome />
    </SettingsNavProvider>
  );
}
