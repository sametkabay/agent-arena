import { builtinDisplayText } from "@/lib/maps/builtinText";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import type { MapLightPoint, MapZone } from "@/lib/maps/mapRegions";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** i18n key for a built-in zone's default name. */
export function builtinZoneNameKey(mapId: string, zoneId: string): string {
  return `maps.${mapId}.zones.${zoneId}`;
}

/**
 * Display name for a zone: translation only while stored equals the built-in
 * default. Custom maps / renamed zones return the stored name as written.
 */
export function builtinZoneDisplayName(opts: {
  stored: string;
  mapId: string;
  zoneId: string;
  /** Built-in JSON default name; null/undefined → custom / no translation. */
  builtinDefault?: string | null;
  t: Translate;
}): string {
  const { stored, mapId, zoneId, builtinDefault, t } = opts;
  const translated =
    builtinDefault != null
      ? (t(builtinZoneNameKey(mapId, zoneId), { defaultValue: "" }) as string) ||
        null
      : null;
  return builtinDisplayText({ stored, builtinDefault, translated });
}

/**
 * 1-based index of a light in the map's light list (0 if not found).
 */
export function lightListIndex(
  lights: MapLightPoint[] | undefined | null,
  lightId: string,
): number {
  const i = (lights ?? []).findIndex((L) => L.id === lightId);
  return i >= 0 ? i + 1 : 0;
}

/**
 * Display name for a map light — always the numbered list item by position.
 * Lights have no stored `name` field.
 */
export function builtinLightDisplayName(opts: {
  /** 1-based index in the map's light list. */
  index: number;
  t: Translate;
}): string {
  return opts.t("mapEditor.lightListItem", { n: opts.index }) as string;
}

/** Resolve zone display name from a draft + optional builtin base. */
export function zoneDisplayName(
  zone: MapZone,
  draft: ArenaMapDefinition,
  builtinBase: ArenaMapDefinition | null,
  t: Translate,
): string {
  const builtinDefault =
    builtinBase?.zones?.find((z) => z.id === zone.id)?.name ?? null;
  return builtinZoneDisplayName({
    stored: zone.name,
    mapId: draft.id,
    zoneId: zone.id,
    builtinDefault: draft.builtin ? builtinDefault : null,
    t,
  });
}

/** Resolve light display name from a draft (by list position). */
export function lightDisplayName(
  light: MapLightPoint,
  draft: ArenaMapDefinition,
  index: number,
  t: Translate,
): string {
  void light;
  void draft;
  return builtinLightDisplayName({ index, t });
}
