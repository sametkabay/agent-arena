import { useTranslation } from "react-i18next";
import type { ShadowQuality } from "@/lib/maps/types";
import { DEFAULT_GRAPHICS } from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";

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
        <select
          value={graphics.shadowQuality}
          disabled={!graphics.castShadows}
          onChange={(e) =>
            setGraphics({ shadowQuality: e.target.value as ShadowQuality })
          }
        >
          <option value="low">{t("settings.graphics.low")}</option>
          <option value="medium">{t("settings.graphics.medium")}</option>
          <option value="high">{t("settings.graphics.high")}</option>
        </select>
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
        <select
          value={String(graphics.maxDpr)}
          onChange={(e) => setGraphics({ maxDpr: Number(e.target.value) })}
        >
          <option value="1">1.0</option>
          <option value="1.25">1.25</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
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
