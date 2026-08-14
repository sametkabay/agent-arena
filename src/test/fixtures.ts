import type { AgentConfig, AiModelConfig } from "@/lib/types";
import type { ArenaMapDefinition, MapTheme } from "@/lib/maps/schema";
import { blankMap } from "@/lib/maps/schema";

export const SAMPLE_THEME: MapTheme = {
  floor: "#aabbcc",
  accent: "#334455",
  background: "#c0d0e0",
  fog: "#b0c0d0",
  ambient: "#ffffff",
  hemiSky: "#88aaff",
  hemiGround: "#553311",
  sun: "#ffffee",
};

export function sampleAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: "agent-1",
    displayName: "Explorer",
    modelConfigId: "model-1",
    polyPresetId: "explorer",
    characterId: "generic-male",
    systemPrompt: "You are Explorer, a curious scout.",
    enabled: true,
    thinkingEnabled: false,
    chattiness: 40,
    skills: [],
    color: "#4a90d9",
    bio: "Maps caves and talks to rocks.",
    createdAt: 1,
    ...overrides,
  };
}

export function sampleModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    id: "model-1",
    name: "Local",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    modelId: "gpt-4o-mini",
    extraHeaders: [],
    createdAt: 1,
    ...overrides,
  };
}

export function sampleMap(overrides: Partial<ArenaMapDefinition> = {}): ArenaMapDefinition {
  return blankMap({
    id: "test_map",
    name: "Test Map",
    description: "A test floor",
    ...overrides,
  });
}
