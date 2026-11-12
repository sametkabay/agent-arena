import type { AiModelConfig, AiProviderKind, ExtraHeader } from "@/lib/types";
import { appConfig } from "@/lib/config";
import { uid } from "@/lib/storage";

export const MODEL_FORMAT = "agent-arena/models" as const;
export const MODEL_VERSION = 1 as const;

export const MODEL_IO_LIMITS = {
  maxFileBytes: 256 * 1024,
  maxModelsInFile: 50,
  maxModelsTotal: 100,
  nameMax: 80,
  modelIdMax: 200,
  baseUrlMax: 2048,
  apiKeyMax: 1024,
  maxHeaders: 20,
  headerNameMax: 100,
  headerValueMax: 2048,
} as const;

const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;
const FORBIDDEN_HEADERS = new Set(["host", "content-length", "cookie"]);

/** Query param names stripped from baseUrl on keyless export (case-insensitive). */
const SECRET_QUERY_PARAMS = new Set([
  "key",
  "api_key",
  "apikey",
  "token",
  "access_token",
  "auth",
  "sig",
  "signature",
  "secret",
  "password",
]);

const KNOWN_PROVIDERS = new Set(
  Object.keys(appConfig.providers) as AiProviderKind[],
);

export type ModelExportRow = {
  name: string;
  provider: AiProviderKind;
  baseUrl: string;
  modelId: string;
  headerNames?: string[];
  extraHeaders?: { key: string; value: string }[];
  apiKey?: string;
};

export type ModelExportFile = {
  format: typeof MODEL_FORMAT;
  version: typeof MODEL_VERSION;
  exportedAt: string;
  includesApiKeys: boolean;
  models: ModelExportRow[];
};

export type ModelImportErrorCode =
  | "tooLarge"
  | "invalidJson"
  | "wrongFormat"
  | "unsupportedVersion"
  | "empty"
  | "tooMany"
  | "tooManyTotal";

export class ModelImportError extends Error {
  readonly code: ModelImportErrorCode;

  constructor(code: ModelImportErrorCode) {
    super(code);
    this.name = "ModelImportError";
    this.code = code;
  }
}

/** Fields ready for `importModels` (fresh id / createdAt assigned in the store). */
export type ImportedModel = {
  name: string;
  provider: AiProviderKind;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  extraHeaders: ExtraHeader[];
};

export type ParseModelImportResult = {
  models: ImportedModel[];
  invalid: number;
  duplicates: number;
  hadApiKeys: boolean;
};

export type ParseModelImportOptions = {
  fileSize?: number;
  existingCount?: number;
  existing?: readonly Pick<
    AiModelConfig,
    "provider" | "baseUrl" | "modelId"
  >[];
};

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

/** C0 controls + DEL — avoids no-control-regex on a literal. */
function hasControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

function hasCrLfNul(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x00 || c === 0x0a || c === 0x0d) return true;
  }
  return false;
}

function isProviderKind(value: unknown): value is AiProviderKind {
  return typeof value === "string" && KNOWN_PROVIDERS.has(value as AiProviderKind);
}

/** Root-relative path used by DEV proxies (`/ollama`, `/local-llm/...`). */
function isRootRelativeBaseUrl(raw: string): boolean {
  return raw.startsWith("/") && !raw.startsWith("//");
}

function normalizeRootRelativeBaseUrl(raw: string): string | null {
  if (raw.length > MODEL_IO_LIMITS.baseUrlMax) return null;
  if (raw === "/") return "/";
  return raw.replace(/\/+$/, "") || null;
}

/**
 * Normalize base URL for dedupe: lowercase scheme+host, drop default ports,
 * strip a single trailing slash, keep query/hash. Accepts absolute http(s) and
 * root-relative paths (`/ollama`). Returns null when invalid.
 */
export function normalizeModelBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isRootRelativeBaseUrl(trimmed)) {
    return normalizeRootRelativeBaseUrl(trimmed);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  // Drop default ports explicitly (URL may already omit them).
  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  let out = parsed.toString();
  // URL.toString() keeps a trailing slash for bare origins; strip path `/` only.
  if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
    out = out.replace(/\/$/, "");
  } else if (out.endsWith("/") && !parsed.search && !parsed.hash) {
    out = out.slice(0, -1);
  }
  return out;
}

/**
 * When exporting without API keys, strip URL userinfo and secret-looking query
 * params so credentials cannot leak via `baseUrl`.
 */
export function stripSecretsFromBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (isRootRelativeBaseUrl(trimmed)) {
    try {
      const parsed = new URL(trimmed, "http://aa.invalid");
      for (const key of [...parsed.searchParams.keys()]) {
        if (SECRET_QUERY_PARAMS.has(key.toLowerCase())) {
          parsed.searchParams.delete(key);
        }
      }
      const q = parsed.searchParams.toString();
      const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
      return `${path}${q ? `?${q}` : ""}${parsed.hash}`;
    } catch {
      return trimmed;
    }
  }

  try {
    const parsed = new URL(trimmed);
    parsed.username = "";
    parsed.password = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    let out = parsed.toString();
    if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
      out = out.replace(/\/$/, "");
    } else if (out.endsWith("/") && !parsed.search && !parsed.hash) {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return trimmed;
  }
}

/** Dedupe key: provider | normalizedUrl | modelId */
export function modelDedupeKey(
  provider: string,
  baseUrl: string,
  modelId: string,
): string | null {
  const norm = normalizeModelBaseUrl(baseUrl);
  if (!norm) return null;
  return `${provider}|${norm}|${modelId.trim()}`;
}

export function dedupeImportedModels(
  items: readonly ImportedModel[],
  existing: readonly Pick<
    AiModelConfig,
    "provider" | "baseUrl" | "modelId"
  >[] = [],
): { models: ImportedModel[]; duplicates: number } {
  const seen = new Set<string>();
  for (const row of existing) {
    const key = modelDedupeKey(row.provider, row.baseUrl, row.modelId);
    if (key) seen.add(key);
  }
  const models: ImportedModel[] = [];
  let duplicates = 0;
  for (const item of items) {
    const key = modelDedupeKey(item.provider, item.baseUrl, item.modelId);
    if (!key || seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    models.push(item);
  }
  return { models, duplicates };
}

function sanitizeHeaderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > MODEL_IO_LIMITS.headerNameMax) return null;
  if (!HEADER_NAME_RE.test(name)) return null;
  if (FORBIDDEN_HEADERS.has(name.toLowerCase())) return null;
  return name;
}

/**
 * Returns the value, or `undefined` to skip the header, or throws via sentinel
 * `null` when the value is over-length (caller rejects the whole row).
 */
function sanitizeHeaderValue(
  raw: unknown,
): { ok: true; value: string } | { ok: false; rejectRow: boolean } {
  if (typeof raw !== "string") return { ok: false, rejectRow: false };
  if (hasCrLfNul(raw)) return { ok: false, rejectRow: false };
  if (raw.length > MODEL_IO_LIMITS.headerValueMax) {
    return { ok: false, rejectRow: true };
  }
  return { ok: true, value: raw };
}

function sanitizeHeadersFromNames(names: unknown): ExtraHeader[] {
  if (!Array.isArray(names)) return [];
  const out: ExtraHeader[] = [];
  const seen = new Set<string>();
  for (const item of names) {
    if (out.length >= MODEL_IO_LIMITS.maxHeaders) break;
    const key = sanitizeHeaderName(item);
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push({ key, value: "" });
  }
  return out;
}

/** `null` means reject the whole model row (e.g. over-length header value). */
function sanitizeExtraHeaders(raw: unknown): ExtraHeader[] | null {
  if (!Array.isArray(raw)) return [];
  const out: ExtraHeader[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MODEL_IO_LIMITS.maxHeaders) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const key = sanitizeHeaderName(row.key);
    if (!key) continue;
    const valueResult = sanitizeHeaderValue(row.value);
    if (!valueResult.ok) {
      if (valueResult.rejectRow) return null;
      continue;
    }
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push({ key, value: valueResult.value });
  }
  return out;
}

function rowHadApiKeys(row: Record<string, unknown>): boolean {
  if (typeof row.apiKey === "string" && row.apiKey.trim()) return true;
  if (Array.isArray(row.extraHeaders)) {
    for (const h of row.extraHeaders) {
      if (!h || typeof h !== "object") continue;
      const value = (h as Record<string, unknown>).value;
      if (typeof value === "string" && value.length > 0) return true;
    }
  }
  return false;
}

function sanitizeImportModel(raw: unknown): ImportedModel | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  if (!isProviderKind(row.provider)) return null;

  const modelIdRaw =
    typeof row.modelId === "string" ? row.modelId.trim() : "";
  if (!modelIdRaw) return null;
  if (hasControlChars(modelIdRaw)) return null;
  if (modelIdRaw.length > MODEL_IO_LIMITS.modelIdMax) return null;
  const modelId = modelIdRaw;

  const baseUrlRaw =
    typeof row.baseUrl === "string" ? row.baseUrl.trim() : "";
  if (!baseUrlRaw || baseUrlRaw.length > MODEL_IO_LIMITS.baseUrlMax) return null;
  const baseUrl = normalizeModelBaseUrl(baseUrlRaw);
  if (!baseUrl) return null;

  const nameRaw =
    typeof row.name === "string" ? row.name.trim() : "";
  if (nameRaw && hasControlChars(nameRaw)) return null;
  const name = clip(nameRaw || modelId, MODEL_IO_LIMITS.nameMax);

  let apiKey: string | undefined;
  if (typeof row.apiKey === "string" && row.apiKey.trim()) {
    const key = row.apiKey.trim();
    if (hasControlChars(key)) return null;
    if (key.length > MODEL_IO_LIMITS.apiKeyMax) return null;
    apiKey = key;
  }

  // Prefer full header values when present; otherwise restore names only.
  const hasExtra =
    Array.isArray(row.extraHeaders) && row.extraHeaders.length > 0;
  const extraHeaders = hasExtra
    ? sanitizeExtraHeaders(row.extraHeaders)
    : sanitizeHeadersFromNames(row.headerNames);
  if (extraHeaders === null) return null;

  return {
    name,
    provider: row.provider,
    baseUrl,
    modelId,
    ...(apiKey ? { apiKey } : {}),
    extraHeaders,
  };
}

/** True when any imported header name has an empty value (needs filling in). */
export function importedModelsHaveEmptyHeaders(
  models: readonly { extraHeaders: readonly ExtraHeader[] }[],
): boolean {
  return models.some((m) =>
    m.extraHeaders.some((h) => h.key.trim() !== "" && h.value === ""),
  );
}

/** Pretty-printed model configs. Keys/header values only when `includeApiKeys`. */
export function buildModelExport(
  models: readonly AiModelConfig[],
  includeApiKeys: boolean,
): string {
  const payload: ModelExportFile = {
    format: MODEL_FORMAT,
    version: MODEL_VERSION,
    exportedAt: new Date().toISOString(),
    includesApiKeys: includeApiKeys,
    models: models.map((m) => {
      const row: ModelExportRow = {
        name: m.name,
        provider: m.provider,
        baseUrl: includeApiKeys
          ? m.baseUrl
          : stripSecretsFromBaseUrl(m.baseUrl),
        modelId: m.modelId,
      };
      if (includeApiKeys) {
        if (m.apiKey) row.apiKey = m.apiKey;
        if (m.extraHeaders.length > 0) {
          row.extraHeaders = m.extraHeaders.map((h) => ({
            key: h.key,
            value: h.value,
          }));
        }
      } else {
        const names = m.extraHeaders
          .map((h) => h.key.trim())
          .filter(Boolean);
        if (names.length > 0) row.headerNames = names;
      }
      return row;
    }),
  };
  return JSON.stringify(payload, null, 2);
}

/** `agent-arena-models-YYYYMMDD[. -WITH-KEYS].aa-models.json` */
export function modelExportFileName(
  includeApiKeys: boolean,
  date: Date = new Date(),
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const keys = includeApiKeys ? "-WITH-KEYS" : "";
  return `agent-arena-models-${y}${m}${d}${keys}.aa-models.json`;
}

/**
 * Parse and sanitize a model-config import file.
 * Throws `ModelImportError` with a stable code for UI toasts.
 */
export function parseModelImport(
  text: string,
  opts: ParseModelImportOptions = {},
): ParseModelImportResult {
  if (
    text.length > MODEL_IO_LIMITS.maxFileBytes ||
    (opts.fileSize != null && opts.fileSize > MODEL_IO_LIMITS.maxFileBytes)
  ) {
    throw new ModelImportError("tooLarge");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ModelImportError("invalidJson");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ModelImportError("wrongFormat");
  }

  const root = parsed as Record<string, unknown>;
  if (root.format !== MODEL_FORMAT) {
    throw new ModelImportError("wrongFormat");
  }
  if (root.version !== MODEL_VERSION) {
    throw new ModelImportError("unsupportedVersion");
  }
  if (!Array.isArray(root.models)) {
    throw new ModelImportError("empty");
  }
  if (root.models.length === 0) {
    throw new ModelImportError("empty");
  }
  if (root.models.length > MODEL_IO_LIMITS.maxModelsInFile) {
    throw new ModelImportError("tooMany");
  }

  let hadApiKeys = root.includesApiKeys === true;
  const sanitized: ImportedModel[] = [];
  let invalid = 0;

  for (const row of root.models) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      if (rowHadApiKeys(row as Record<string, unknown>)) hadApiKeys = true;
    }
    const model = sanitizeImportModel(row);
    if (!model) {
      invalid += 1;
      continue;
    }
    sanitized.push(model);
  }

  if (sanitized.length === 0) {
    throw new ModelImportError("empty");
  }

  const { models, duplicates } = dedupeImportedModels(
    sanitized,
    opts.existing ?? [],
  );

  if (models.length === 0 && duplicates > 0) {
    // All rows were duplicates — still a valid parse; caller shows allDuplicates.
    return { models: [], invalid, duplicates, hadApiKeys };
  }

  if (models.length === 0) {
    throw new ModelImportError("empty");
  }

  const existing = opts.existingCount ?? opts.existing?.length ?? 0;
  if (existing + models.length > MODEL_IO_LIMITS.maxModelsTotal) {
    throw new ModelImportError("tooManyTotal");
  }

  return { models, invalid, duplicates, hadApiKeys };
}

/** Assign fresh ids for store commit (pure helper for tests / round-trips). */
export function toAiModelConfigs(
  items: readonly ImportedModel[],
  createdAt: number = Date.now(),
): AiModelConfig[] {
  return items.map((item) => ({
    id: uid("model"),
    name: item.name,
    provider: item.provider,
    baseUrl: item.baseUrl,
    modelId: item.modelId,
    apiKey: item.apiKey,
    extraHeaders: item.extraHeaders.map((h) => ({ ...h })),
    createdAt,
  }));
}
