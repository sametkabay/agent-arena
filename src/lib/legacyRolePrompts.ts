import raw from "@data/legacy-role-prompts.yaml";
import { getPolyPreset } from "@/lib/poly/presets";

type LegacyPromptsYaml = {
  prompts: Record<string, string>;
};

const LEGACY_PROMPTS: readonly string[] = Object.values(
  (raw as LegacyPromptsYaml).prompts ?? {},
).filter((p): p is string => typeof p === "string" && p.trim().length > 0);

function normalizePromptWs(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim();
}

const LEGACY_NORM = new Set(LEGACY_PROMPTS.map(normalizePromptWs));

/**
 * If `prompt` is any pre-#71 stock role prompt (whitespace-normalized),
 * return the current stock prompt for `presetId`; otherwise leave unchanged.
 * Idempotent — safe to run on every load / import.
 */
export function migrateLegacySystemPrompt(
  prompt: string,
  presetId: string,
): string {
  if (!LEGACY_NORM.has(normalizePromptWs(prompt))) return prompt;
  return getPolyPreset(presetId).defaultSystemPrompt;
}
