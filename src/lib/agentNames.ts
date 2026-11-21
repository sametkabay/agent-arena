import de from "@/i18n/de.json";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import fr from "@/i18n/fr.json";
import ja from "@/i18n/ja.json";
import ko from "@/i18n/ko.json";
import pt from "@/i18n/pt.json";
import ru from "@/i18n/ru.json";
import tr from "@/i18n/tr.json";
import zh from "@/i18n/zh.json";
import { appConfig } from "@/lib/config";
import {
  normalizeAgentName,
  stripCopySuffix,
} from "@/lib/agentCopy";
import { ALL_POLY_PRESETS, getPolyPreset } from "@/lib/poly/presets";

type LocalePoly = Record<string, { name?: string } | undefined>;

/** Every shipped locale, imported statically so role-name checks are language-independent. */
const LOCALE_POLY: readonly LocalePoly[] = [en, tr, es, zh, pt, fr, de, ja, ko, ru].map(
  (l) => (l as { poly: LocalePoly }).poly,
);

const KNOWN_PRESET_IDS = new Set(ALL_POLY_PRESETS.map((p) => p.id));

/** Ordered person-name pool (agent-arena.yaml → defaults.agentNamePool). */
export const AGENT_NAME_POOL: readonly string[] = appConfig.defaults.agentNamePool;

/**
 * First pool name not in `takenNames` (same key as @mentions / normalizeAgentName).
 * When the whole pool is taken: "Kai2", "Kai3", … (first free wins).
 */
export function pickAgentName(takenNames: string[]): string {
  const taken = new Set(takenNames.map(normalizeAgentName));
  const free = AGENT_NAME_POOL.find((n) => !taken.has(normalizeAgentName(n)));
  if (free) return free;
  const base = AGENT_NAME_POOL[0] ?? appConfig.defaults.agentName;
  for (let i = 2; ; i++) {
    const candidate = `${base}${i}`;
    if (!taken.has(normalizeAgentName(candidate))) return candidate;
  }
}

/** All names a role preset ever pre-filled: yaml default + its title in every locale. */
function roleDefaultNames(presetId: string): string[] {
  const preset = getPolyPreset(presetId);
  const names = [preset.defaultDisplayName];
  for (const poly of LOCALE_POLY) {
    const n = poly[preset.id]?.name;
    if (n) names.push(n);
  }
  return names;
}

function foldedRoleBase(name: string): string {
  // Legacy duplicates "Explorer (copy)" / "Explorer (Kopie 2)" count as the role title.
  return normalizeAgentName(stripCopySuffix(name.trim(), "copy"));
}

/**
 * True when `name` is this role's stock title (or a copy-suffix variant), rather
 * than a name the user chose. For a known preset, only that role's titles
 * count. For a missing/unknown preset, every role's titles (yaml + all locales,
 * incl. copy-suffix forms) plus Custom titles count — corrupt localStorage
 * must not keep "Explorer".
 */
export function isRoleDefaultName(name: string, polyPresetId: string): boolean {
  const base = foldedRoleBase(name);
  if (!base) return false;

  const presetId =
    typeof polyPresetId === "string" && KNOWN_PRESET_IDS.has(polyPresetId)
      ? polyPresetId
      : null;

  if (presetId) {
    return roleDefaultNames(presetId).some(
      (r) => normalizeAgentName(r) === base,
    );
  }

  // Missing/unknown preset: any role or Custom stock title is a legacy prefill.
  return ALL_POLY_PRESETS.some((p) =>
    roleDefaultNames(p.id).some((r) => normalizeAgentName(r) === base),
  );
}

/**
 * Assign pool names to role-titled / empty rows. Seeds `taken` with
 * `existingNames` plus every row that keeps its name, then renames the rest
 * in order (same collect-first semantics as migrateAgentNames).
 */
export function renameRoleTitled<
  T extends { displayName: string; polyPresetId: string },
>(items: readonly T[], existingNames: readonly string[] = []): T[] {
  const needsName = (a: T) =>
    !a.displayName.trim() || isRoleDefaultName(a.displayName, a.polyPresetId);
  const taken = [
    ...existingNames,
    ...items.filter((a) => !needsName(a)).map((a) => a.displayName),
  ];
  return items.map((a) => {
    if (!needsName(a)) return a;
    const displayName = pickAgentName(taken);
    taken.push(displayName);
    return { ...a, displayName };
  });
}

/**
 * One-time rename of legacy agents still called by their role (or unnamed).
 * Keeps order; agents with any other name are returned unchanged.
 */
export function migrateAgentNames<T extends { displayName: string; polyPresetId: string }>(
  agents: T[],
): { agents: T[]; changed: boolean } {
  const out = renameRoleTitled(agents, []);
  const changed = out.some((a, i) => a !== agents[i]);
  return { agents: out, changed };
}
