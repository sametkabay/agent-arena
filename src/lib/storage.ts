import type {
  AgentConfig,
  AgentSkill,
  AppPersisted,
  ChatMessage,
  FloatingChatLine,
  GraphicsSettings,
  LanguageCode,
  MapId,
} from "@/lib/types";
import { isLanguageCode } from "@/i18n/languages";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { isArenaMapDefinition, migrateLegacyMapFloorStyles, migratePlaceableId } from "@/lib/maps/schema";
import { isBuiltinMapId } from "@/lib/maps/runtime";
import { isDayNightMode } from "@/lib/dayNight";
import { DEFAULT_CHARACTER_ID, isCharacterId } from "@/lib/assets/characters";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";

export { DEFAULT_GRAPHICS };

export const STORAGE_KEY = appConfig.storage.key;
/** One-shot: rewrite legacy floor.style "checker" → "surface". */
const FLOOR_STYLE_MIGRATE_KEY = appConfig.storage.floorStyleMigrateKey;

function sanitizeGraphics(raw: unknown): GraphicsSettings {
  const g =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    castShadows:
      typeof g.castShadows === "boolean"
        ? g.castShadows
        : DEFAULT_GRAPHICS.castShadows,
    shadowQuality:
      g.shadowQuality === "off" ||
      g.shadowQuality === "low" ||
      g.shadowQuality === "medium" ||
      g.shadowQuality === "high"
        ? g.shadowQuality
        : DEFAULT_GRAPHICS.shadowQuality,
    contactShadows:
      typeof g.contactShadows === "boolean"
        ? g.contactShadows
        : DEFAULT_GRAPHICS.contactShadows,
    lampLights:
      typeof g.lampLights === "boolean"
        ? g.lampLights
        : DEFAULT_GRAPHICS.lampLights,
    roomLights:
      typeof g.roomLights === "boolean"
        ? g.roomLights
        : DEFAULT_GRAPHICS.roomLights,
    antialias:
      typeof g.antialias === "boolean" ? g.antialias : DEFAULT_GRAPHICS.antialias,
    maxDpr:
      typeof g.maxDpr === "number" && Number.isFinite(g.maxDpr)
        ? Math.min(3, Math.max(0.5, g.maxDpr))
        : DEFAULT_GRAPHICS.maxDpr,
  };
}

export function defaultPersisted(): AppPersisted {
  return {
    userName: "",
    language: appConfig.defaults.language,
    models: [],
    agents: [],
    mapId: appConfig.defaults.mapId,
    customMaps: [],
    graphics: { ...DEFAULT_GRAPHICS },
    dayNight: appConfig.defaults.dayNight,
    favoriteAssets: [],
    chats: {},
    arenaChatHistory: [],
  };
}

const CHAT_ROLES = new Set(["user", "assistant", "system"]);
/** Cap stored messages per agent to protect localStorage quota. */
const MAX_CHAT_MESSAGES_PER_AGENT = appConfig.storage.maxChatMessagesPerAgent;
export const MAX_ARENA_CHAT_HISTORY = appConfig.storage.maxArenaChatHistory;
const ARENA_LINE_KINDS = new Set(["user", "agent", "system"]);

export function sanitizeChats(raw: unknown): Record<string, ChatMessage[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ChatMessage[]> = {};
  for (const [agentId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof agentId !== "string" || !agentId || !Array.isArray(list)) continue;
    const messages = list
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .filter((m) => typeof m.role === "string" && CHAT_ROLES.has(m.role))
      .map((m) => ({
        role: m.role as ChatMessage["role"],
        content: typeof m.content === "string" ? m.content : "",
      }))
      .filter((m) => !(m.role === "assistant" && !m.content.trim()))
      .slice(-MAX_CHAT_MESSAGES_PER_AGENT);
    if (messages.length) out[agentId] = messages;
  }
  return out;
}

export function sanitizeArenaChatHistory(raw: unknown): FloatingChatLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .filter((m) => typeof m.kind === "string" && ARENA_LINE_KINDS.has(m.kind))
    .map((m) => ({
      id: typeof m.id === "string" && m.id ? m.id : uid("flog"),
      agentId: typeof m.agentId === "string" ? m.agentId : undefined,
      agentName: typeof m.agentName === "string" ? m.agentName : "?",
      color: typeof m.color === "string" && m.color ? m.color : appConfig.defaults.fallbackAgentColor,
      text: typeof m.text === "string" ? m.text : "",
      createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
      kind: m.kind as FloatingChatLine["kind"],
    }))
    .filter((m) => m.text.trim())
    .slice(-MAX_ARENA_CHAT_HISTORY);
}

function sanitizeCustomMaps(raw: unknown): ArenaMapDefinition[] {
  if (!Array.isArray(raw)) return [];
  const maps = raw.filter(isArenaMapDefinition).map((m) => ({
    ...m,
    builtin: false,
    version: 1 as const,
    placeables: m.placeables.map((p) => ({
      ...p,
      placeableId: migratePlaceableId(p.placeableId),
    })),
  }));
  // Legacy "checker" meant surface default — migrate once so explicit checker works later.
  if (typeof localStorage !== "undefined" && !localStorage.getItem(FLOOR_STYLE_MIGRATE_KEY)) {
    localStorage.setItem(FLOOR_STYLE_MIGRATE_KEY, "1");
    return maps.map(migrateLegacyMapFloorStyles);
  }
  return maps;
}

const LEGACY_MAP_IDS: Record<string, string> = { mars: "space", empty: "office" };

function migrateMapId(id: string): string {
  return LEGACY_MAP_IDS[id] ?? id;
}

function sanitizeMapId(v: unknown, customMaps: ArenaMapDefinition[]): MapId {
  if (typeof v !== "string" || !v) return appConfig.defaults.mapId;
  const id = migrateMapId(v);
  if (isBuiltinMapId(id)) return id;
  if (customMaps.some((m) => m.id === id)) return id;
  return appConfig.defaults.mapId;
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
      enabled: a.enabled !== false,
      thinkingEnabled: a.thinkingEnabled === true,
      chattiness: clampChattiness(a.chattiness),
      skills: sanitizeSkills(a.skills),
      characterId: isCharacterId(typeof a.characterId === "string" ? a.characterId : undefined)
        ? (a.characterId as string)
        : DEFAULT_CHARACTER_ID,
    }));
}

export function clampChattiness(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function loadPersisted(): AppPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<AppPersisted>;
    const customMaps = sanitizeCustomMaps(parsed.customMaps);
    return {
      userName: typeof parsed.userName === "string" ? parsed.userName : "",
      language: isLanguageCode(parsed.language) ? parsed.language : appConfig.defaults.language,
      models: Array.isArray(parsed.models) ? parsed.models : [],
      agents: sanitizeAgents(parsed.agents),
      customMaps,
      mapId: sanitizeMapId(parsed.mapId, customMaps),
      graphics: sanitizeGraphics(parsed.graphics),
      dayNight: isDayNightMode(parsed.dayNight) ? parsed.dayNight : appConfig.defaults.dayNight,
      favoriteAssets: Array.isArray(parsed.favoriteAssets)
        ? parsed.favoriteAssets
            .filter((x): x is string => typeof x === "string")
            .map(migratePlaceableId)
        : [],
      chats: sanitizeChats(parsed.chats),
      arenaChatHistory: sanitizeArenaChatHistory(parsed.arenaChatHistory),
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
