import { useTranslation } from "react-i18next";
import type { ShadowQuality } from "@/lib/maps/types";
import { DEFAULT_GRAPHICS } from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";

export function GraphicsTab() {
  const { t } = useTranslation();
  const graphics = useArenaStore((s) => s.graphics);
  const setGraphics = useArenaStore((s) => s.setGraphics);

  return (
    <div>
      <p className="settings-hint">{t("settings.graphics.hint")}</p>

      <label className="settings-row">
        <span>{t("settings.graphics.castShadows")}</span>
        <Switch
          checked={graphics.castShadows}
          onChange={(castShadows) => setGraphics({ castShadows })}
          aria-label={t("settings.graphics.castShadows")}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.shadowQuality")}</span>
        <Select
          value={graphics.shadowQuality}
          disabled={!graphics.castShadows}
          onChange={(v) => setGraphics({ shadowQuality: v as ShadowQuality })}
          options={[
            { value: "low", label: t("settings.graphics.low") },
            { value: "medium", label: t("settings.graphics.medium") },
            { value: "high", label: t("settings.graphics.high") },
          ]}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.contactShadows")}</span>
        <Switch
          checked={graphics.contactShadows}
          onChange={(contactShadows) => setGraphics({ contactShadows })}
          aria-label={t("settings.graphics.contactShadows")}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.lampLights")}</span>
        <Switch
          checked={graphics.lampLights}
          onChange={(lampLights) => setGraphics({ lampLights })}
          aria-label={t("settings.graphics.lampLights")}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.roomLights")}</span>
        <Switch
          checked={graphics.roomLights}
          onChange={(roomLights) => setGraphics({ roomLights })}
          aria-label={t("settings.graphics.roomLights")}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.antialias")}</span>
        <Switch
          checked={graphics.antialias}
          onChange={(antialias) => setGraphics({ antialias })}
          aria-label={t("settings.graphics.antialias")}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.maxDpr")}</span>
        <Select
          value={String(graphics.maxDpr)}
          onChange={(v) => setGraphics({ maxDpr: Number(v) })}
          options={[
            { value: "1", label: "1.0" },
            { value: "1.25", label: "1.25" },
            { value: "1.5", label: "1.5" },
            { value: "2", label: "2.0" },
          ]}
        />
      </label>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setGraphics({ ...DEFAULT_GRAPHICS })}
        >
          {t("settings.graphics.reset")}
        </button>
      </div>
    </div>
  );
}
