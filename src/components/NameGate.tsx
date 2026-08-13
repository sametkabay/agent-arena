import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LanguageCode } from "@/lib/types";
import { LANGUAGES } from "@/i18n/languages";
import { useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";

export function NameGate() {
  const { t } = useTranslation();
  const setUserName = useArenaStore((s) => s.setUserName);
  const language = useArenaStore((s) => s.language);
  const setLanguage = useArenaStore((s) => s.setLanguage);
  const dayNight = useArenaStore((s) => s.dayNight);
  const setDayNight = useArenaStore((s) => s.setDayNight);
  const [name, setName] = useState("");

  return (
    <div className="name-gate">
      <div className="name-gate__card">
        <span className="name-gate__badge">{t("nameGate.badge")}</span>
        <h1>{t("nameGate.heading")}</h1>
        <p>{t("nameGate.blurb")}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setUserName(name.trim());
          }}
        >
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("nameGate.placeholder")}
            maxLength={48}
          />
          <label className="name-gate__field">
            {t("settings.general.language")}
            <Select
              value={language}
              onChange={(v) => setLanguage(v as LanguageCode)}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              aria-label={t("settings.general.language")}
            />
          </label>
          <fieldset className="name-gate__theme">
            <legend>{t("nameGate.appearance")}</legend>
            <div className="name-gate__radios" role="radiogroup">
              {(["day", "night"] as const).map((mode) => (
                <label
                  key={mode}
                  className={
                    "name-gate__radio" + (dayNight === mode ? " is-selected" : "")
                  }
                >
                  <input
                    type="radio"
                    name="name-gate-theme"
                    value={mode}
                    checked={dayNight === mode}
                    onChange={() => setDayNight(mode)}
                  />
                  {t(mode === "day" ? "hud.day" : "hud.night")}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="name-gate__submit" type="submit" disabled={!name.trim()}>
            {t("nameGate.continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
