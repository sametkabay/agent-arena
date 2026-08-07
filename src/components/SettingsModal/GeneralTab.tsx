import { useTranslation } from "react-i18next";
import type { LanguageCode } from "@/lib/types";
import { useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";

export function GeneralTab() {
  const { t } = useTranslation();
  const userName = useArenaStore((s) => s.userName);
  const language = useArenaStore((s) => s.language);
  const setUserName = useArenaStore((s) => s.setUserName);
  const setLanguage = useArenaStore((s) => s.setLanguage);

  return (
    <div className="form-grid">
      <p className="settings-hint">{t("settings.general.languageHint")}</p>
      <label>
        {t("settings.general.displayName")}
        <input
          type="text"
          value={userName}
          maxLength={48}
          onChange={(e) => setUserName(e.target.value)}
        />
      </label>
      <label>
        {t("settings.general.language")}
        <Select
          value={language}
          onChange={(v) => setLanguage(v as LanguageCode)}
          options={[
            { value: "en", label: "English" },
            { value: "tr", label: "Türkçe" },
          ]}
        />
      </label>
    </div>
  );
}
