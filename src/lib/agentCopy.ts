import type { AgentConfig } from "@/lib/types";
import { uid } from "@/lib/storage";

/** Same rule @mentions use: trim, lowercase, collapse spaces. */
export function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

type LocaleAgentsSlice = {
  settings?: { agents?: { copyLabel?: unknown } };
};

const localeModules = import.meta.glob("../i18n/*.json", {
  eager: true,
  import: "default",
}) as Record<string, LocaleAgentsSlice>;

/**
 * `settings.agents.copyLabel` from every bundled locale JSON.
 * Used so stripping recognizes suffixes from any language.
 */
export const AGENT_COPY_LABELS: readonly string[] = (() => {
  const labels = new Set<string>();
  for (const data of Object.values(localeModules)) {
    const label = data?.settings?.agents?.copyLabel;
    if (typeof label === "string" && label.trim()) labels.add(label.trim());
  }
  return Object.freeze([...labels]);
})();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Unique labels to strip, longest first so longer phrases win. */
export function copyLabelsForStrip(
  copyLabel: string,
  knownCopyLabels: readonly string[] = AGENT_COPY_LABELS,
): string[] {
  const set = new Set<string>();
  for (const label of knownCopyLabels) {
    if (typeof label === "string" && label.trim()) set.add(label.trim());
  }
  if (copyLabel.trim()) set.add(copyLabel.trim());
  return [...set].sort((a, b) => b.length - a.length);
}

/**
 * Strip a trailing `(label)` / `(label N)` for any known copy label.
 * Non-copy parentheticals (e.g. "Bot (beta)") are left intact.
 */
export function stripCopySuffix(
  sourceName: string,
  copyLabel: string,
  knownCopyLabels: readonly string[] = AGENT_COPY_LABELS,
): string {
  const labels = copyLabelsForStrip(copyLabel, knownCopyLabels);
  if (labels.length === 0) return sourceName.trim();
  const alt = labels.map(escapeRegExp).join("|");
  const stripRe = new RegExp(`\\s*\\((?:${alt})(?:\\s+\\d+)?\\)\\s*$`, "i");
  return sourceName.trim().replace(stripRe, "").trim();
}

/**
 * Next free display name: `Base (label)`, `Base (label 2)`, …
 * Strips a trailing copy suffix in any known locale before numbering.
 */
export function nextCopyName(
  sourceName: string,
  takenNames: readonly string[],
  copyLabel: string,
  knownCopyLabels: readonly string[] = AGENT_COPY_LABELS,
): string {
  const taken = new Set(takenNames.map(normalizeAgentName));
  const base = stripCopySuffix(sourceName, copyLabel, knownCopyLabels);

  for (let n = 1; ; n++) {
    const name =
      n <= 1
        ? base
          ? `${base} (${copyLabel})`
          : `(${copyLabel})`
        : base
          ? `${base} (${copyLabel} ${n})`
          : `(${copyLabel} ${n})`;
    if (!taken.has(normalizeAgentName(name))) return name;
  }
}

/** Deep-clone an agent with a new id, copy name, and createdAt. */
export function createAgentCopy(
  source: AgentConfig,
  existing: readonly AgentConfig[],
  copyLabel: string,
  knownCopyLabels: readonly string[] = AGENT_COPY_LABELS,
): AgentConfig {
  const copy = structuredClone({
    ...source,
    skills: source.skills ?? [],
  });
  copy.id = uid("agent");
  copy.displayName = nextCopyName(
    source.displayName,
    existing.map((a) => a.displayName),
    copyLabel,
    knownCopyLabels,
  );
  copy.createdAt = Date.now();
  return copy;
}
