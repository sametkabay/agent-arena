import type {
  AgentConfig,
  AgentSkill,
  AppPersisted,
  GraphicsSettings,
  LanguageCode,
  MapId,
} from "@/lib/types";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { isArenaMapDefinition, migrateLegacyMapFloorStyles } from "@/lib/maps/schema";
import { isBuiltinMapId } from "@/lib/maps/runtime";
import { isDayNightMode } from "@/lib/dayNight";

export const STORAGE_KEY = "agent-arena-data";
/** One-shot: rewrite legacy floor.style "checker" → "surface". */
const FLOOR_STYLE_MIGRATE_KEY = "agent-arena-floor-style-v2";

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  castShadows: true,
  shadowQuality: "medium",
  contactShadows: true,
  lampLights: true,
  roomLights: true,
  antialias: true,
  maxDpr: 1.5,
  ambientAudio: true,
  ambientVolume: 0.35,
};

export function defaultPersisted(): AppPersisted {
  return {
    userName: "",
    language: "en",
    models: [],
    agents: [],
    mapId: "office",
    customMaps: [],
    graphics: { ...DEFAULT_GRAPHICS },
    dayNight: "day",
    favoriteAssets: [],
  };
}

function sanitizeCustomMaps(raw: unknown): ArenaMapDefinition[] {
  if (!Array.isArray(raw)) return [];
  const maps = raw.filter(isArenaMapDefinition).map((m) => ({
    ...m,
    builtin: false,
    version: 1 as const,
  }));
  // Legacy "checker" meant surface default — migrate once so explicit checker works later.
  if (typeof localStorage !== "undefined" && !localStorage.getItem(FLOOR_STYLE_MIGRATE_KEY)) {
    localStorage.setItem(FLOOR_STYLE_MIGRATE_KEY, "1");
    return maps.map(migrateLegacyMapFloorStyles);
  }
  return maps;
}

function sanitizeMapId(v: unknown, customMaps: ArenaMapDefinition[]): MapId {
  if (typeof v !== "string" || !v) return "office";
  if (isBuiltinMapId(v)) return v;
  if (customMaps.some((m) => m.id === v)) return v;
  return "office";
}

function sanitizeSkills(raw: unknown): AgentSkill[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s, i) => ({
      id: typeof s.id === "string" && s.id ? s.id : `skill_${i}`,
      name: typeof s.name === "string" ? s.name : "",
      content: typeof s.content === "string" ? s.content : "",
    }));
}

function sanitizeAgents(raw: unknown): AgentConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      ...(a as unknown as AgentConfig),
      thinkingEnabled: a.thinkingEnabled === true,
      skills: sanitizeSkills(a.skills),
    }));
}

export function loadPersisted(): AppPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<AppPersisted>;
    const customMaps = sanitizeCustomMaps(parsed.customMaps);
    return {
      userName: typeof parsed.userName === "string" ? parsed.userName : "",
      language: parsed.language === "tr" || parsed.language === "en" ? parsed.language : "en",
      models: Array.isArray(parsed.models) ? parsed.models : [],
      agents: sanitizeAgents(parsed.agents),
      customMaps,
      mapId: sanitizeMapId(parsed.mapId, customMaps),
      graphics: { ...DEFAULT_GRAPHICS, ...(parsed.graphics ?? {}) },
      dayNight: isDayNightMode(parsed.dayNight) ? parsed.dayNight : "day",
      favoriteAssets: Array.isArray(parsed.favoriteAssets)
        ? parsed.favoriteAssets.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return defaultPersisted();
  }
}

export function savePersisted(data: AppPersisted): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export type { LanguageCode };
