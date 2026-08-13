import raw from "../../../agent-arena.yaml";
import type { AiProviderKind, GraphicsSettings, ShadowQuality } from "@/lib/types";
import type { DayNightMode } from "@/lib/dayNight";

export interface LanguageEntry {
  code: string;
  label: string;
  englishName: string;
}

export interface ProviderDefaults {
  name: string;
  baseUrl: string;
  modelId: string;
  host?: string;
  port?: number;
  anthropicVersion?: string;
  maxTokens?: number;
  thinkingBudget?: number;
}

export interface AppConfig {
  app: {
    name: string;
    title: string;
    description: string;
    themeColor: string;
  };
  defaults: {
    language: string;
    mapId: string;
    dayNight: DayNightMode;
    characterId: string;
    roleId: string;
    agentName: string;
    agentColor: string;
    agentChattiness: number;
    agentEnabled: boolean;
    agentThinking: boolean;
    modelName: string;
    modelProvider: AiProviderKind;
    thinkingBubble: string;
    unknownUser: string;
    unknownMap: string;
    unknownAgent: string;
    fallbackAgentColor: string;
  };
  storage: {
    key: string;
    floorStyleMigrateKey: string;
    chatPanelKey: string;
    sidePanelsKey: string;
    maxChatMessagesPerAgent: number;
    maxArenaChatHistory: number;
    maxApiChatHistory: number;
  };
  graphics: GraphicsSettings & {
    shadowMapSizes: Record<ShadowQuality, number>;
  };
  chatter: {
    maxMuttersPerMinute: number;
  };
  speech: {
    maxChars: number;
    msPerChar: number;
    minMs: number;
    maxMs: number;
    streamingHoldMs: number;
  };
  chat: {
    userColor: string;
    systemColor: string;
    systemName: string;
    panel: {
      minWidth: number;
      minHeight: number;
      margin: number;
      defaultWidth: number;
      defaultHeight: number;
    };
    toastMs: number;
  };
  ui: {
    dayNightBlendSpeed: number;
    editorMaxHistory: number;
  };
  maps: {
    floorSizeMin: number;
    floorSizeMax: number;
    floorBorderMeters: number;
    floorTopY: number;
    defaultBlankName: string;
    defaultBlankSize: number;
    defaultBlankSurface: string;
    defaultCustomName: string;
    copySuffix: string;
    agentMoveSpeed: number;
    spawnRingAngle: number;
    spawnRingOffset: number;
    indoorSurfaces: string[];
    defaultTheme: {
      accent: string;
      background: string;
      fog: string;
      ambient: string;
      hemiSky: string;
      hemiGround: string;
      sun: string;
    };
    defaultSpawn: {
      id: string;
      position: [number, number, number];
      rotationY: number;
    };
  };
  character: {
    defaultHeadScale: number;
    defaultHandScale: number;
    handInset: number;
    handLift: number;
  };
  dayNight: {
    day: {
      ambientIntensity: number;
      hemiIntensity: number;
      sunIntensity: number;
      sunPosition: [number, number, number];
      fillIntensity: number;
      fillColor: string;
      fillPosition: [number, number, number];
    };
    night: {
      mixBackground: string;
      mixBackgroundAmount: number;
      mixFog: string;
      mixFogAmount: number;
      mixAmbient: string;
      mixAmbientAmount: number;
      mixHemiSky: string;
      mixHemiSkyAmount: number;
      mixHemiGround: string;
      mixHemiGroundAmount: number;
      sun: string;
      ambientIntensity: number;
      hemiIntensity: number;
      sunIntensity: number;
      sunPosition: [number, number, number];
      fillIntensity: number;
      fillColor: string;
      fillPosition: [number, number, number];
    };
  };
  providers: Record<AiProviderKind, ProviderDefaults>;
  dev: {
    port: number;
    ollamaProxy: string;
    localLlmFallback: string;
  };
  languages: LanguageEntry[];
}

export const appConfig = raw as AppConfig;

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  castShadows: appConfig.graphics.castShadows,
  shadowQuality: appConfig.graphics.shadowQuality,
  contactShadows: appConfig.graphics.contactShadows,
  lampLights: appConfig.graphics.lampLights,
  roomLights: appConfig.graphics.roomLights,
  antialias: appConfig.graphics.antialias,
  maxDpr: appConfig.graphics.maxDpr,
};

export function speechMsForText(text: string): number {
  const { msPerChar, minMs, maxMs } = appConfig.speech;
  return Math.min(maxMs, Math.max(minMs, Math.round(text.length * msPerChar)));
}
