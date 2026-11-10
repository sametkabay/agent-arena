import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";
import { nextSetupTab } from "@/lib/onboarding";

export function SetupGuide() {
  const { t } = useTranslation();
  const models = useArenaStore((s) => s.models);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);
  const dismissOnboarding = useArenaStore((s) => s.dismissOnboarding);

  const tab = nextSetupTab(models.length);
  const tabLabel = t(`settings.tabs.${tab}`);

  return (
    <section
      className="setup-guide"
      role="region"
      aria-label={t("onboarding.title")}
    >
      <div className="setup-guide__body">
        <h2 className="setup-guide__title">{t("onboarding.title")}</h2>
        <p className="setup-guide__intro">{t("onboarding.intro")}</p>
        <ol className="setup-guide__steps">
          <li>{t("onboarding.step1")}</li>
          <li>{t("onboarding.step2")}</li>
          <li>{t("onboarding.step3")}</li>
        </ol>
        <p className="setup-guide__alive">
          {t("onboarding.alive", {
            setting: t("settings.general.idleChatter"),
            tab: t("settings.tabs.general"),
          })}
        </p>
      </div>
      <div className="setup-guide__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setSettingsTab(tab)}
        >
          {t("onboarding.open", { tab: tabLabel })}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => dismissOnboarding()}
        >
          {t("onboarding.dontShowAgain")}
        </button>
      </div>
    </section>
  );
}
