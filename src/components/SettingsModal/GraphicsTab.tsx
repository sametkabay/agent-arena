import { useTranslation } from "react-i18next";
import type { ShadowQuality } from "@/lib/maps/types";
import { DEFAULT_GRAPHICS } from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";
import { Select } from "@/components/ui/Select";

export function GraphicsTab() {
  const { t } = useTranslation();
  const graphics = useArenaStore((s) => s.graphics);
  const setGraphics = useArenaStore((s) => s.setGraphics);

  return (
    <div>
      <p className="settings-hint">{t("settings.graphics.hint")}</p>

      <label className="settings-row">
        <span>{t("settings.graphics.castShadows")}</span>
        <input
          type="checkbox"
          checked={graphics.castShadows}
          onChange={(e) => setGraphics({ castShadows: e.target.checked })}
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
        <input
          type="checkbox"
          checked={graphics.contactShadows}
          onChange={(e) => setGraphics({ contactShadows: e.target.checked })}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.lampLights")}</span>
        <input
          type="checkbox"
          checked={graphics.lampLights}
          onChange={(e) => setGraphics({ lampLights: e.target.checked })}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.roomLights")}</span>
        <input
          type="checkbox"
          checked={graphics.roomLights}
          onChange={(e) => setGraphics({ roomLights: e.target.checked })}
        />
      </label>

      <label className="settings-row">
        <span>{t("settings.graphics.antialias")}</span>
        <input
          type="checkbox"
          checked={graphics.antialias}
          onChange={(e) => setGraphics({ antialias: e.target.checked })}
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
