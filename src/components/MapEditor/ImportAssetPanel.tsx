import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSET_CATEGORIES, type AssetCategory } from "@/lib/assets/catalog";
import { appConfig } from "@/lib/config";
import { Select } from "@/components/ui/Select";

type ImportResult = { ok: true; id: string } | { ok: false; error: string };

export function ImportAssetPanel({
  count,
  onImport,
}: {
  count: number;
  onImport: (
    file: File,
    form: { label: string; category: AssetCategory; autoFit: "height" | "xz"; targetSize: number },
  ) => Promise<ImportResult>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<AssetCategory>(
    appConfig.userAssets.defaultCategory as AssetCategory,
  );
  const [autoFit, setAutoFit] = useState<"height" | "xz">(
    appConfig.userAssets.defaultAutoFit,
  );
  const [targetSize, setTargetSize] = useState(appConfig.userAssets.defaultTargetSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = count >= appConfig.userAssets.maxCount;

  function reset() {
    setFile(null);
    setLabel("");
    setCategory(appConfig.userAssets.defaultCategory as AssetCategory);
    setAutoFit(appConfig.userAssets.defaultAutoFit);
    setTargetSize(appConfig.userAssets.defaultTargetSize);
    setError(null);
    setOpen(false);
  }

  async function handleImport() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    const result = await onImport(file, {
      label: label.trim(),
      category,
      autoFit,
      targetSize,
    });
    setBusy(false);
    if (result.ok) {
      reset();
    } else {
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="map-editor__import-toggle"
        onClick={() => setOpen(true)}
        disabled={atLimit}
        title={atLimit ? t("mapEditor.importAsset.limitReached") : undefined}
      >
        {t("mapEditor.importAsset.open")}
      </button>
    );
  }

  return (
    <div className="map-editor__import-panel">
      <div className="map-editor__field">
        <span>{t("mapEditor.importAsset.file")}</span>
        <input
          type="file"
          accept=".glb,.gltf"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setError(null);
            if (f && !label) setLabel(f.name.replace(/\.(glb|gltf)$/i, ""));
          }}
        />
      </div>
      <label className="map-editor__field">
        <span>{t("mapEditor.importAsset.label")}</span>
        <input
          type="text"
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("mapEditor.importAsset.labelPlaceholder")}
        />
      </label>
      <label className="map-editor__field">
        <span>{t("mapEditor.importAsset.category")}</span>
        <Select
          variant="dark"
          value={category}
          onChange={(v) => setCategory(v as AssetCategory)}
          options={ASSET_CATEGORIES.map((c) => ({
            value: c,
            label: t(`mapEditor.cat.${c}`),
          }))}
        />
      </label>
      <label className="map-editor__field">
        <span>{t("mapEditor.importAsset.autoFit")}</span>
        <Select
          variant="dark"
          value={autoFit}
          onChange={(v) => setAutoFit(v as "height" | "xz")}
          options={[
            { value: "height", label: t("mapEditor.importAsset.autoFitHeight") },
            { value: "xz", label: t("mapEditor.importAsset.autoFitFootprint") },
          ]}
        />
      </label>
      <label className="map-editor__field">
        <span>
          {t("mapEditor.importAsset.targetSize")}: {targetSize.toFixed(2)}m
        </span>
        <input
          type="number"
          min={0.05}
          max={10}
          step={0.05}
          value={targetSize}
          onChange={(e) => setTargetSize(Number(e.target.value) || 1)}
        />
      </label>
      {error && (
        <p className="map-editor__import-error">
          {t(`mapEditor.importAsset.error.${error}`, { defaultValue: error })}
        </p>
      )}
      <div className="map-editor__inline-actions">
        <button type="button" onClick={reset} disabled={busy}>
          {t("settings.cancel")}
        </button>
        <button
          type="button"
          className="map-editor__primary"
          onClick={() => void handleImport()}
          disabled={!file || busy}
        >
          {busy ? t("mapEditor.importAsset.importing") : t("mapEditor.importAsset.confirm")}
        </button>
      </div>
      <p className="map-editor__hint">
        {t("mapEditor.importAsset.hint", {
          maxMb: Math.round(appConfig.userAssets.maxFileBytes / (1024 * 1024)),
        })}
      </p>
    </div>
  );
}
