import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";

export function NameGate() {
  const { t } = useTranslation();
  const setUserName = useArenaStore((s) => s.setUserName);
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
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("nameGate.placeholder")}
            maxLength={48}
          />
          <button className="name-gate__submit" type="submit" disabled={!name.trim()}>
            {t("nameGate.continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
