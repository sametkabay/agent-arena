import { nextCopyName } from "@/lib/agentCopy";
import { cloneMap, type ArenaMapDefinition } from "@/lib/maps/schema";

/**
 * Same `custom_*` id pattern used by createBlankCustomMap /
 * createCustomMapFromBuiltin / createMapFromPreset.
 */
export function newCustomMapId(): string {
  return `custom_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalize an imported map id the way the store has always done:
 * - ids that already start with `custom_` are kept (may collide with an
 *   existing entry in `customMaps`);
 * - any other id — including builtin ids like `office` — gets a fresh
 *   `custom_*` id, so re-importing a builtin never overwrites a custom map
 *   by id.
 */
export function resolveImportedMapId(parsedId: string): string {
  return parsedId.startsWith("custom_") ? parsedId : newCustomMapId();
}

/** Find an existing custom map with the same id, if any. */
export function findMapIdCollision(
  id: string,
  customMaps: readonly ArenaMapDefinition[],
): ArenaMapDefinition | null {
  return customMaps.find((m) => m.id === id) ?? null;
}

export type PreparedMapImport = {
  /** Parsed map with resolved id / builtin:false / fallback name. */
  def: ArenaMapDefinition;
  /** Existing custom map that shares `def.id`, or null when free to import. */
  collision: ArenaMapDefinition | null;
};

/**
 * Prepare a parsed map for import: resolve id, strip builtin, detect id clash.
 * Pure — no store / storage side effects.
 */
export function prepareMapImport(
  parsed: ArenaMapDefinition,
  customMaps: readonly ArenaMapDefinition[],
): PreparedMapImport {
  const id = resolveImportedMapId(parsed.id);
  const def = cloneMap(parsed, {
    id,
    builtin: false,
    name: parsed.name.trim() || "Imported map",
  });
  return {
    def,
    collision: findMapIdCollision(def.id, customMaps),
  };
}

/**
 * Build an import-as-copy payload: fresh custom id + localized copy name
 * unique among existing custom map names (and optional extras such as
 * builtin names). Reuses agent `nextCopyName`.
 */
export function buildMapImportCopy(
  source: ArenaMapDefinition,
  customMaps: readonly ArenaMapDefinition[],
  copyLabel: string,
  extraTakenNames: readonly string[] = [],
): ArenaMapDefinition {
  let id: string;
  do {
    id = newCustomMapId();
  } while (customMaps.some((m) => m.id === id));

  return cloneMap(source, {
    id,
    name: nextCopyName(
      source.name,
      [...customMaps.map((m) => m.name), ...extraTakenNames],
      copyLabel,
    ),
    builtin: false,
  });
}

export type MapImportCommitMode = "overwrite" | "copy";
