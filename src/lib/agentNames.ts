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
import { CUSTOM_PRESET, getPolyPreset } from "@/lib/poly/presets";

type LocalePoly = Record<string, { name?: string } | undefined>;

/** Every shipped locale, imported statically so role-name checks are language-independent. */
const LOCALE_POLY: readonly LocalePoly[] = [en, tr, es, zh, pt, fr, de, ja, ko, ru].map(
  (l) => (l as { poly: LocalePoly }).poly,
);

/** Ordered person-name pool (agent-arena.yaml → defaults.agentNamePool). */
export const AGENT_NAME_POOL: readonly string[] = appConfig.defaults.agentNamePool;

function normName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * First pool name not in `takenNames` (case-insensitive, trimmed).
 * When the whole pool is taken: "Kai 2", "Kai 3", … (first free wins).
 */
export function pickAgentName(takenNames: string[]): string {
  const taken = new Set(takenNames.map(normName));
  const free = AGENT_NAME_POOL.find((n) => !taken.has(normName(n)));
  if (free) return free;
  const base = AGENT_NAME_POOL[0] ?? appConfig.defaults.agentName;
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!taken.has(normName(candidate))) return candidate;
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

/**
 * True when `name` is a role's stock title (the legacy "Add agent" pre-fill)
 * rather than a name the user chose — for the agent's preset or the custom preset.
 */
export function isRoleDefaultName(name: string, polyPresetId: string): boolean {
  const n = normName(name);
  if (!n) return false;
  return [...roleDefaultNames(polyPresetId), ...roleDefaultNames(CUSTOM_PRESET.id)].some(
    (r) => normName(r) === n,
  );
}

/**
 * One-time rename of legacy agents still called by their role (or unnamed).
 * Keeps order; agents with any other name are returned unchanged.
 */
export function migrateAgentNames<T extends { displayName: string; polyPresetId: string }>(
  agents: T[],
): { agents: T[]; changed: boolean } {
  const needsName = (a: T) =>
    !a.displayName.trim() || isRoleDefaultName(a.displayName, a.polyPresetId);
  const taken = agents.filter((a) => !needsName(a)).map((a) => a.displayName);
  let changed = false;
  const out = agents.map((a) => {
    if (!needsName(a)) return a;
    const displayName = pickAgentName(taken);
    taken.push(displayName);
    changed = true;
    return { ...a, displayName };
  });
  return { agents: out, changed };
}
