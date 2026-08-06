export type AiProviderKind = "openai" | "gemini" | "claude" | "ollama" | "custom";

export type LanguageCode = "en" | "tr";

export type MapId = "office" | "nature" | "factory" | "mars";

export type AgentVisualState = "idle" | "wander" | "walk" | "thinking" | "talking";

export type ShadowQuality = "off" | "low" | "medium" | "high";

export interface ExtraHeader {
  key: string;
  value: string;
}

export interface AiModelConfig {
  id: string;
  name: string;
  provider: AiProviderKind;
  baseUrl: string;
  apiKey?: string;
  modelId: string;
  extraHeaders: ExtraHeader[];
  createdAt: number;
}

export interface AgentConfig {
  id: string;
  displayName: string;
  modelConfigId: string;
  polyPresetId: string;
  systemPrompt: string;
  color: string;
  bio?: string;
  createdAt: number;
}

export interface GraphicsSettings {
  castShadows: boolean;
  shadowQuality: ShadowQuality;
  contactShadows: boolean;
  lampLights: boolean;
  roomLights: boolean;
  antialias: boolean;
  maxDpr: number;
}

export interface AppPersisted {
  userName: string;
  language: LanguageCode;
  models: AiModelConfig[];
  agents: AgentConfig[];
  mapId: MapId;
  graphics: GraphicsSettings;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PlaceableInstance {
  id: string;
  placeableId: string;
  position: [number, number, number];
  rotationY: number;
  scale?: number;
}

export interface ArenaAgent {
  id: string;
  displayName: string;
  modelConfigId: string;
  polyPresetId: string;
  systemPrompt: string;
  color: string;
  bio?: string;
  position: [number, number, number];
  rotationY: number;
  homePosition: [number, number, number];
  state: AgentVisualState;
  target?: [number, number, number];
  walkPath?: [number, number, number][];
  speechBubble?: string;
  speechBubbleUntil?: number;
  thinkingIntensity: number;
  moveSpeed: number;
}

export interface BuiltLayout {
  floorSize: number;
  placeables: PlaceableInstance[];
  agents: ArenaAgent[];
}
