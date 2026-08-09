import type { ArenaMapDefinition } from "@/lib/maps/schema";
import type { DayNightMode } from "@/lib/dayNight";

export type { DayNightMode } from "@/lib/dayNight";

export type AiProviderKind = "openai" | "gemini" | "claude" | "ollama" | "custom";

export type LanguageCode = "en" | "tr";

/** Builtin id or custom_* user map id. */
export type MapId = string;

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

export interface AgentSkill {
  id: string;
  name: string;
  content: string;
}

export interface AgentConfig {
  id: string;
  displayName: string;
  modelConfigId: string;
  polyPresetId: string;
  systemPrompt: string;
  /** Enable model reasoning / thinking when the provider supports it. */
  thinkingEnabled: boolean;
  /** Optional skill blocks injected into the system prompt. */
  skills: AgentSkill[];
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
  /** Procedural map ambience (Web Audio — no sample files). */
  ambientAudio: boolean;
  ambientVolume: number;
}

export interface AppPersisted {
  userName: string;
  language: LanguageCode;
  models: AiModelConfig[];
  agents: AgentConfig[];
  mapId: MapId;
  /** User-authored aamf v1 maps (builtins live in src/lib/maps/defs). */
  customMaps: ArenaMapDefinition[];
  graphics: GraphicsSettings;
  /** Arena + UI day/night preference (persisted). */
  dayNight: DayNightMode;
  /** Favorite placeable ids for the map editor library. */
  favoriteAssets?: string[];
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
  /**
   * Motion mode for capable assets:
   * - `wander` — `canWander` animals walk randomly
   * - `animated` — in-place FX (e.g. Fire.glb flame stretch)
   * - `static` — frozen
   * Omit: wander assets default static in runtime unless placed as wander;
   * animate-capable assets default to animated when omitted.
   */
  behavior?: "static" | "wander" | "animated";
  /** Anchor for random wander radius (play runtime; optional in map JSON). */
  homePosition?: [number, number, number];
  /** Current walk target (runtime). */
  target?: [number, number, number];
  moveSpeed?: number;
  /** Max distance from home when wandering (meters). Default ~3.4. */
  wanderRadius?: number;
  /** Drives clip selection (runtime). */
  locomotion?: "idle" | "walk";
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
  /** User right-click destination — shown while selected until arrival. */
  commandTarget?: [number, number, number];
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
