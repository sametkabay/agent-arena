import type { AgentConfig, AgentSkill } from "@/lib/types";
import { normalizeAgentName, nextCopyName } from "@/lib/agentCopy";
import { DEFAULT_CHARACTER_ID, isCharacterId } from "@/lib/assets/characters";
import { ALL_POLY_PRESETS, getPolyPreset } from "@/lib/poly/presets";
import { clampChattiness, clampTemperament, uid } from "@/lib/storage";

export const ROSTER_FORMAT = "agent-arena/agents" as const;
export const ROSTER_VERSION = 1 as const;

export const ROSTER_LIMITS = {
  maxFileBytes: 512 * 1024,
  maxAgentsInFile: 50,
  maxAgentsTotal: 100,
  displayNameMax: 40,
  systemPromptMax: 8000,
  bioMax: 500,
  maxSkills: 10,
  skillNameMax: 60,
  skillContentMax: 4000,
} as const;

const COLOR_RE = /^#[0-9a-f]{6}$/i;

export type RosterExportAgent = {
  displayName: string;
  polyPresetId: string;
  characterId: string;
  systemPrompt: string;
  bio?: string;
  color: string;
  chattiness: number;
  temperament: number;
  thinkingEnabled: boolean;
  enabled: boolean;
  skills: { name: string; content: string }[];
};

export type RosterExportFile = {
  format: typeof ROSTER_FORMAT;
  version: typeof ROSTER_VERSION;
  exportedAt: string;
  agents: RosterExportAgent[];
};

export type RosterImportErrorCode =
  | "tooLarge"
  | "invalidJson"
  | "wrongFormat"
  | "unsupportedVersion"
  | "empty"
  | "tooMany"
  | "tooManyTotal";

export class RosterImportError extends Error {
  readonly code: RosterImportErrorCode;

  constructor(code: RosterImportErrorCode) {
    super(code);
    this.name = "RosterImportError";
    this.code = code;
  }
}

/** Persona fields ready for `importAgents` (no id / model / createdAt yet). */
export type ImportedAgent = {
  displayName: string;
  polyPresetId: string;
  characterId: string;
  systemPrompt: string;
  bio?: string;
  color: string;
  chattiness: number;
  temperament: number;
  thinkingEnabled: boolean;
  enabled: boolean;
  skills: AgentSkill[];
};

export type ParseRosterResult = {
  agents: ImportedAgent[];
  skipped: number;
};

const KNOWN_POLY_IDS = new Set(ALL_POLY_PRESETS.map((p) => p.id));

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

function isKnownPolyPresetId(id: string): boolean {
  return KNOWN_POLY_IDS.has(id);
}

function sanitizeImportSkills(raw: unknown): AgentSkill[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentSkill[] = [];
  for (const item of raw) {
    if (out.length >= ROSTER_LIMITS.maxSkills) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = clip(
      typeof row.name === "string" ? row.name.trim() : "",
      ROSTER_LIMITS.skillNameMax,
    );
    const content = clip(
      typeof row.content === "string" ? row.content.trim() : "",
      ROSTER_LIMITS.skillContentMax,
    );
    if (!name && !content) continue;
    out.push({ id: uid("skill"), name, content });
  }
  return out;
}

function sanitizeImportAgent(raw: unknown): ImportedAgent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;

  const displayName = clip(
    typeof a.displayName === "string" ? a.displayName.trim() : "",
    ROSTER_LIMITS.displayNameMax,
  );
  if (!displayName) return null;

  const polyPresetId =
    typeof a.polyPresetId === "string" && isKnownPolyPresetId(a.polyPresetId)
      ? a.polyPresetId
      : "explorer";

  const characterId =
    typeof a.characterId === "string" && isCharacterId(a.characterId)
      ? a.characterId
      : DEFAULT_CHARACTER_ID;

  const systemPrompt = clip(
    typeof a.systemPrompt === "string" ? a.systemPrompt : "",
    ROSTER_LIMITS.systemPromptMax,
  );

  const bioRaw = typeof a.bio === "string" ? a.bio.trim() : "";
  const bio = bioRaw
    ? clip(bioRaw, ROSTER_LIMITS.bioMax)
    : undefined;

  const preset = getPolyPreset(polyPresetId);
  const color =
    typeof a.color === "string" && COLOR_RE.test(a.color)
      ? a.color
      : preset.defaultColor;

  return {
    displayName,
    polyPresetId,
    characterId,
    systemPrompt,
    ...(bio ? { bio } : {}),
    color,
    chattiness: clampChattiness(a.chattiness),
    temperament: clampTemperament(a.temperament),
    thinkingEnabled: a.thinkingEnabled === true,
    enabled: a.enabled !== false,
    skills: sanitizeImportSkills(a.skills),
  };
}

/** Pretty-printed roster JSON with persona fields only (no secrets / ids). */
export function buildRosterExport(agents: readonly AgentConfig[]): string {
  const payload: RosterExportFile = {
    format: ROSTER_FORMAT,
    version: ROSTER_VERSION,
    exportedAt: new Date().toISOString(),
    agents: agents.map((a) => {
      const bio = a.bio?.trim();
      const row: RosterExportAgent = {
        displayName: a.displayName,
        polyPresetId: a.polyPresetId,
        characterId: a.characterId || DEFAULT_CHARACTER_ID,
        systemPrompt: a.systemPrompt,
        color: a.color,
        chattiness: clampChattiness(a.chattiness),
        temperament: clampTemperament(a.temperament),
        thinkingEnabled: a.thinkingEnabled === true,
        enabled: a.enabled !== false,
        skills: (a.skills ?? []).map((s) => ({
          name: s.name,
          content: s.content,
        })),
      };
      if (bio) row.bio = bio;
      return row;
    }),
  };
  return JSON.stringify(payload, null, 2);
}

/** `agent-arena-agents-YYYYMMDD.aa-agents.json` */
export function rosterExportFileName(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `agent-arena-agents-${y}${m}${d}.aa-agents.json`;
}

export type ParseRosterOptions = {
  /** File size in bytes; checked before trusting parsed content. */
  fileSize?: number;
  /** Current roster length; used for the total cap. */
  existingCount?: number;
};

/**
 * Parse and sanitize a roster import file.
 * Throws `RosterImportError` with a stable code for UI toasts.
 */
export function parseRosterImport(
  text: string,
  opts: ParseRosterOptions = {},
): ParseRosterResult {
  if (
    opts.fileSize != null &&
    opts.fileSize > ROSTER_LIMITS.maxFileBytes
  ) {
    throw new RosterImportError("tooLarge");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RosterImportError("invalidJson");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RosterImportError("wrongFormat");
  }

  const root = parsed as Record<string, unknown>;
  if (root.format !== ROSTER_FORMAT) {
    throw new RosterImportError("wrongFormat");
  }
  if (root.version !== ROSTER_VERSION) {
    throw new RosterImportError("unsupportedVersion");
  }
  if (!Array.isArray(root.agents)) {
    throw new RosterImportError("empty");
  }
  if (root.agents.length === 0) {
    throw new RosterImportError("empty");
  }
  if (root.agents.length > ROSTER_LIMITS.maxAgentsInFile) {
    throw new RosterImportError("tooMany");
  }

  const agents: ImportedAgent[] = [];
  let skipped = 0;
  for (const row of root.agents) {
    const agent = sanitizeImportAgent(row);
    if (!agent) {
      skipped += 1;
      continue;
    }
    agents.push(agent);
  }

  if (agents.length === 0) {
    throw new RosterImportError("empty");
  }

  const existing = opts.existingCount ?? 0;
  if (existing + agents.length > ROSTER_LIMITS.maxAgentsTotal) {
    throw new RosterImportError("tooManyTotal");
  }

  return { agents, skipped };
}

/** Map chosen model ids onto the importer's model list (fallback = first). */
export function remapModelIds(
  chosenIds: readonly string[],
  availableIds: readonly string[],
): string[] {
  const fallback = availableIds[0] ?? "";
  const allowed = new Set(availableIds);
  return chosenIds.map((id) => (allowed.has(id) ? id : fallback));
}

/** Fill every row with the same model id ("apply to all"). */
export function applyAllModelIds(count: number, modelId: string): string[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, () => modelId);
}

/**
 * Resolve display names for import: keep non-colliding names, otherwise
 * `nextCopyName` with the localized copy label.
 */
export function resolveImportNames(
  names: readonly string[],
  existingNames: readonly string[],
  copyLabel: string,
): string[] {
  const taken = [...existingNames];
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const collision = taken.some(
      (t) => normalizeAgentName(t) === normalizeAgentName(name),
    );
    const resolved = collision
      ? nextCopyName(name, taken, copyLabel)
      : name;
    out.push(resolved);
    taken.push(resolved);
  }
  return out;
}
