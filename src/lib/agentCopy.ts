import type { AgentConfig } from "@/lib/types";
import { uid } from "@/lib/storage";

/** Same rule @mentions use: trim, lowercase, collapse spaces. */
export function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Next free display name: `Base (label)`, `Base (label 2)`, …
 * Strips a trailing `(label)` / `(label N)` from the source first.
 */
export function nextCopyName(
  sourceName: string,
  takenNames: readonly string[],
  copyLabel: string,
): string {
  const taken = new Set(takenNames.map(normalizeAgentName));
  const escaped = copyLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripRe = new RegExp(`\\s*\\(${escaped}(?:\\s+\\d+)?\\)\\s*$`, "i");
  const base = sourceName.trim().replace(stripRe, "").trim();

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
  );
  copy.createdAt = Date.now();
  return copy;
}
