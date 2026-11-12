import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatterMode, LanguageCode } from "@/lib/types";
import { LANGUAGES } from "@/i18n/languages";
import { appConfig } from "@/lib/config";
import { useArenaStore } from "@/store/arenaStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export function GeneralTab() {
  const { t } = useTranslation();
  const userName = useArenaStore((s) => s.userName);
  const language = useArenaStore((s) => s.language);
  const setUserName = useArenaStore((s) => s.setUserName);
  const setLanguage = useArenaStore((s) => s.setLanguage);
  const chatterMode = useArenaStore((s) => s.chatterMode);
  const setChatterMode = useArenaStore((s) => s.setChatterMode);
  const clearChats = useArenaStore((s) => s.clearChats);
  const showToast = useArenaStore((s) => s.showToast);
  const [confirmClear, setConfirmClear] = useState(false);
  const chatterHeadingId = useId();
  const chatterHintId = useId();

  const modeHintKey =
    chatterMode === "idle"
      ? "settings.general.chatterModeIdleHint"
      : chatterMode === "conversation"
        ? "settings.general.chatterModeConversationHint"
        : "settings.general.chatterModeOffHint";

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
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
        />
      </label>
      <div className="settings-row settings-row--stack">
        <div>
          <strong id={chatterHeadingId}>{t("settings.general.chatterMode")}</strong>
          <p className="settings-hint">{t("settings.general.chatterModeHint")}</p>
        </div>
        <SegmentedControl
          name="chatter-mode"
          labelledBy={chatterHeadingId}
          describedBy={chatterHintId}
          value={chatterMode}
          onChange={(v) => setChatterMode(v as ChatterMode)}
          options={[
            { value: "off", label: t("settings.general.chatterModeOff") },
            { value: "idle", label: t("settings.general.chatterModeIdle") },
            {
              value: "conversation",
              label: t("settings.general.chatterModeConversation"),
            },
          ]}
        />
        <p id={chatterHintId} className="settings-hint" aria-live="polite">
          {t(modeHintKey, { count: appConfig.conversation.maxAgentTurns })}
        </p>
      </div>
      <div className="settings-row settings-row--stack settings-row--flush">
        <div>
          <strong>{t("settings.general.clearChats")}</strong>
          <p className="settings-hint">{t("settings.general.clearChatsHint")}</p>
        </div>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => setConfirmClear(true)}
        >
          {t("settings.general.clearChatsAction")}
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={t("settings.general.clearChatsConfirmTitle")}
        message={t("settings.general.clearChatsConfirmBody")}
        confirmLabel={t("settings.general.clearChatsConfirm")}
        cancelLabel={t("settings.cancel")}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          const result = clearChats();
          setConfirmClear(false);
          if (result.ok) showToast(t("settings.general.clearChatsDone"));
        }}
      />
    </div>
  );
}
