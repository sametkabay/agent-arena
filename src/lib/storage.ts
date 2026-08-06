import type { AppPersisted, GraphicsSettings, LanguageCode, MapId } from "@/lib/types";

export const STORAGE_KEY = "agent-arena-data";

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  castShadows: true,
  shadowQuality: "medium",
  contactShadows: true,
  lampLights: false,
  roomLights: true,
  antialias: true,
  maxDpr: 1.5,
};

export function defaultPersisted(): AppPersisted {
  return {
    userName: "",
    language: "en",
    models: [],
    agents: [],
    mapId: "office",
    graphics: { ...DEFAULT_GRAPHICS },
  };
}

export function loadPersisted(): AppPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<AppPersisted>;
    const base = defaultPersisted();
    return {
      userName: typeof parsed.userName === "string" ? parsed.userName : "",
      language: parsed.language === "tr" || parsed.language === "en" ? parsed.language : "en",
      models: Array.isArray(parsed.models) ? parsed.models : [],
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      mapId: isMapId(parsed.mapId) ? parsed.mapId : "office",
      graphics: { ...DEFAULT_GRAPHICS, ...(parsed.graphics ?? {}) },
    };
  } catch {
    return defaultPersisted();
  }
}

export function savePersisted(data: AppPersisted): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isMapId(v: unknown): v is MapId {
  return v === "office" || v === "nature" || v === "factory" || v === "mars";
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export type { LanguageCode };
