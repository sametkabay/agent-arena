import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { appConfig } from "@/lib/config";
import {
  FOCUSABLE_SELECTOR,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
} from "@/lib/focusTrap";
import { shouldDismissOnEscape } from "@/lib/overlayEscape";
import {
  importBlocked,
  planImport,
  type ImportPlan,
  type SelectedFile,
} from "@/lib/userAssets/gltfUris";
import { UserAssetError } from "@/lib/userAssets/errors";
import { useUserAssetStore } from "@/store/userAssetStore";

const ACCEPT =
  ".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2,model/gltf-binary,model/gltf+json";

type Mode = "import" | "replace";

type Props = {
  open: boolean;
  mode?: Mode;
  replaceId?: string;
  onClose: () => void;
  onDone?: (id: string) => void;
};

function formatStorageBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "?";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function errorMessage(
  t: (key: string, opts?: Record<string, unknown>) => string,
  err: unknown,
): string {
  if (err instanceof UserAssetError) {
    return t(`mapEditor.customAssets.${err.key}`, {
      ...err.params,
      defaultValue: t("mapEditor.customAssets.errUnknown"),
    });
  }
  return t("mapEditor.customAssets.errUnknown");
}

export function ImportAssetDialog({
  open,
  mode = "import",
  replaceId,
  onClose,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importAsset = useUserAssetStore((s) => s.importAsset);
  const replaceAsset = useUserAssetStore((s) => s.replaceAsset);
  const estimate = useUserAssetStore((s) => s.estimate);

  const [name, setName] = useState("");
  const [targetSize, setTargetSize] = useState(
    String(appConfig.userAssets.defaultTargetSize),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [ackExternal, setAckExternal] = useState(false);
  const [ackBig, setAckBig] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** True while the final IDB put runs — Cancel is disabled (cannot safely abort). */
  const [committing, setCommitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const active =
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  if (open) {
    restoreFocusRef.current = rememberRestoreFocusTarget(
      restoreFocusRef.current,
      active,
    );
  }

  useEffect(() => {
    if (!open) return;
    setName("");
    setTargetSize(String(appConfig.userAssets.defaultTargetSize));
    setFiles([]);
    setPlan(null);
    setPlanError(null);
    setAckExternal(false);
    setAckBig(false);
    setProgress(null);
    setQuotaError(false);
    setBusy(false);
    setCommitting(false);
    void estimate().then((e) => {
      if (!e || e.usage == null) {
        setUsageLabel(null);
        return;
      }
      setUsageLabel(
        t("mapEditor.customAssets.usage", {
          used: formatStorageBytes(e.usage),
          quota: e.quota != null ? formatStorageBytes(e.quota) : "?",
        }),
      );
    });
  }, [open, estimate, t]);

  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    const focusable = card
      ? Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    focusable[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (shouldDismissOnEscape(e)) {
        if (!committing) handleCancel();
        return;
      }
      const liveCard = cardRef.current;
      if (!liveCard || e.key !== "Tab") return;
      const nodes = Array.from(
        liveCard.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const current = document.activeElement;
      const activeIndex =
        current instanceof HTMLElement ? nodes.indexOf(current) : -1;
      const nextIndex = resolveFocusTrapWrapIndex(
        { key: e.key, shiftKey: e.shiftKey },
        nodes.length,
        activeIndex,
      );
      if (nextIndex !== null) {
        e.preventDefault();
        nodes[nextIndex]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, committing]);

  const rebuildPlan = async (picked: File[]) => {
    setFiles(picked);
    setPlanError(null);
    setAckExternal(false);
    setAckBig(false);
    if (!picked.length) {
      setPlan(null);
      return;
    }
    try {
      const selected: SelectedFile[] = picked.map((f) => ({
        path: f.name,
        name: f.name,
        size: f.size,
        mime: f.type,
      }));
      const contents = new Map<string, ArrayBuffer>();
      let done = 0;
      for (const f of picked) {
        setProgress(
          t("mapEditor.customAssets.progressRead", {
            done: done + 1,
            total: picked.length,
          }),
        );
        contents.set(f.name, await f.arrayBuffer());
        done += 1;
      }
      setProgress(t("mapEditor.customAssets.progressValidate"));
      const next = planImport(selected, contents);
      setPlan(next);
      if (!name.trim()) {
        const base = next.entry.replace(/\.(glb|gltf)$/i, "");
        setName(base);
      }
      setProgress(null);
    } catch (err) {
      setPlan(null);
      setProgress(null);
      setPlanError(errorMessage(t, err));
    }
  };

  const needsExternalAck = (plan?.external.length ?? 0) > 0;
  const needsBigAck =
    (plan?.totalBytes ?? 0) >= appConfig.userAssets.warnBytes;
  const blocked = !plan || importBlocked(plan) || !!planError;
  const canSubmit =
    !blocked &&
    !busy &&
    (!needsExternalAck || ackExternal) &&
    (!needsBigAck || ackBig) &&
    (mode === "replace" || name.trim().length > 0);

  const hosts = useMemo(() => {
    if (!plan) return "";
    return [...new Set(plan.external.map((e) => e.host))].join(", ");
  }, [plan]);

  const handleCancel = () => {
    if (committing) return;
    abortRef.current?.abort();
    abortRef.current = null;
    const restore = restoreFocusRef.current;
    onClose();
    Promise.resolve().then(() => restore?.focus?.());
  };

  const handleSubmit = async () => {
    if (!plan || !canSubmit) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setQuotaError(false);
    setProgress(t("mapEditor.customAssets.progressSave"));
    setCommitting(true);
    try {
      const payload = files.map((f) => ({
        path: f.name,
        blob: f,
        mime: f.type,
      }));
      const allowExternal = plan.external.map((e) => e.url);
      const parsed = Number(targetSize);
      const size =
        targetSize.trim() === "" || !Number.isFinite(parsed)
          ? appConfig.userAssets.defaultTargetSize
          : parsed;
      let id: string;
      if (mode === "replace" && replaceId) {
        const meta = await replaceAsset({
          id: replaceId,
          files: payload,
          allowExternal,
          signal: ac.signal,
        });
        id = meta.id;
      } else {
        const meta = await importAsset({
          name: name.trim(),
          files: payload,
          targetSize: size,
          allowExternal,
          signal: ac.signal,
        });
        id = meta.id;
      }
      onDone?.(id);
      const restore = restoreFocusRef.current;
      onClose();
      Promise.resolve().then(() => restore?.focus?.());
    } catch (err) {
      if (err instanceof UserAssetError && err.code === "aborted") {
        setProgress(t("mapEditor.customAssets.cancelled"));
      } else if (err instanceof UserAssetError && err.code === "quota") {
        setQuotaError(true);
      } else {
        setPlanError(errorMessage(t, err));
      }
    } finally {
      setBusy(false);
      setCommitting(false);
      abortRef.current = null;
      setProgress(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="confirm-dialog confirm-dialog--dark import-asset-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-asset-title"
      onClick={() => {
        if (!committing) handleCancel();
      }}
    >
      <div
        className="confirm-dialog__card import-asset-dialog__card"
        ref={cardRef}
        data-testid="import-asset-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="import-asset-title" className="confirm-dialog__title">
          {mode === "replace"
            ? t("mapEditor.customAssets.replaceTitle")
            : t("mapEditor.customAssets.importTitle")}
        </h3>

        <div className="import-asset-dialog__body">
          <div className="map-editor__field">
            <span>{t("mapEditor.customAssets.pickFiles")}</span>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="import-asset-dialog__file-input"
              data-testid="import-asset-files"
              onChange={(e) => {
                void rebuildPlan(Array.from(e.target.files ?? []));
              }}
            />
            <button
              type="button"
              className="btn map-editor__inline-btn import-asset-dialog__pick-btn"
              onClick={() => fileRef.current?.click()}
              data-testid="import-asset-pick"
            >
              {t("mapEditor.customAssets.pickFiles")}
            </button>
            {files.length > 0 && (
              <ul
                className="import-asset-dialog__selected"
                data-testid="import-asset-selected"
              >
                {files.map((f) => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            )}
            <span className="map-editor__hint">
              {t("mapEditor.customAssets.pickFilesHint")}
            </span>
          </div>

          {mode === "import" && (
            <label className="map-editor__field">
              <span>{t("mapEditor.customAssets.name")}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="import-asset-name"
              />
            </label>
          )}

          {mode === "import" && (
            <label className="map-editor__field">
              <span>{t("mapEditor.customAssets.targetSize")}</span>
              <input
                type="number"
                min={0.05}
                max={50}
                step={0.05}
                value={targetSize}
                onChange={(e) => setTargetSize(e.target.value)}
                data-testid="import-asset-target-size"
              />
              <span className="map-editor__hint">
                {t("mapEditor.customAssets.targetSizeHint")}
              </span>
            </label>
          )}

          {usageLabel && (
            <p className="map-editor__hint" data-testid="import-asset-usage">
              {usageLabel}
            </p>
          )}

          {plan && (
            <ul
              className="import-asset-dialog__files"
              data-testid="import-asset-file-list"
            >
              {plan.needed.map((p) => (
                <li key={p} className="is-ok">
                  {t("mapEditor.customAssets.fileMatched", { file: p })}
                </li>
              ))}
              {plan.missing.map((p) => (
                <li key={`m-${p}`} className="is-bad">
                  {t("mapEditor.customAssets.fileMissing", { file: p })}
                </li>
              ))}
              {plan.rejected.map((r) => (
                <li key={`r-${r.uri}`} className="is-bad">
                  {t("mapEditor.customAssets.errUri", { uri: r.uri })}
                </li>
              ))}
              {plan.unused.map((p) => (
                <li key={`u-${p}`} className="is-warn">
                  {t("mapEditor.customAssets.fileUnused", { file: p })}
                </li>
              ))}
            </ul>
          )}

          {plan?.missing.length ? (
            <p className="import-asset-dialog__alert" role="alert">
              {t("mapEditor.customAssets.warnMissing", {
                files: plan.missing.join(", "),
              })}
            </p>
          ) : null}

          {plan?.rejected.length ? (
            <p className="import-asset-dialog__alert" role="alert">
              {t("mapEditor.customAssets.errUri", {
                uri: plan.rejected.map((r) => r.uri).join(", "),
              })}
            </p>
          ) : null}

          {plan?.ambiguous.length ? (
            <p className="import-asset-dialog__alert" role="alert">
              {t("mapEditor.customAssets.warnAmbiguous", {
                files: plan.ambiguous.map((a) => a.path).join(", "),
              })}
            </p>
          ) : null}

          {needsExternalAck && (
            <div className="import-asset-dialog__alert" role="alert">
              <p>{t("mapEditor.customAssets.warnExternal", { hosts })}</p>
              <label className="import-asset-dialog__ack">
                <input
                  type="checkbox"
                  checked={ackExternal}
                  onChange={(e) => setAckExternal(e.target.checked)}
                  data-testid="import-asset-ack-external"
                />
                {t("mapEditor.customAssets.warnExternalAck")}
              </label>
            </div>
          )}

          {needsBigAck && (
            <div className="import-asset-dialog__alert" role="alert">
              <p>
                {t("mapEditor.customAssets.warnBig", {
                  size: formatStorageBytes(plan!.totalBytes),
                })}
              </p>
              <label className="import-asset-dialog__ack">
                <input
                  type="checkbox"
                  checked={ackBig}
                  onChange={(e) => setAckBig(e.target.checked)}
                  data-testid="import-asset-ack-big"
                />
                {t("mapEditor.customAssets.warnBigAck")}
              </label>
            </div>
          )}

          {quotaError && (
            <p
              className="import-asset-dialog__alert"
              role="alert"
              data-testid="import-asset-quota"
            >
              {t("mapEditor.customAssets.errQuota")}
            </p>
          )}

          {planError && (
            <p className="import-asset-dialog__alert" role="alert">
              {planError}
            </p>
          )}

          {progress && (
            <p className="map-editor__hint" data-testid="import-asset-progress">
              {progress}
              <progress className="import-asset-dialog__progress" />
            </p>
          )}
        </div>

        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleCancel}
            disabled={committing}
            data-testid="import-asset-cancel"
            title={
              committing
                ? t("mapEditor.customAssets.progressSave")
                : undefined
            }
          >
            {t("mapEditor.customAssets.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            data-testid="import-asset-confirm"
          >
            {mode === "replace"
              ? t("mapEditor.customAssets.confirmReplace")
              : t("mapEditor.customAssets.confirmImport")}
          </button>
        </div>
      </div>
    </div>
  );
}
