import type { AgentConfig } from "@/lib/types";
import { getPolyPreset } from "@/lib/poly/presets";

type Translate = (key: string) => string;

/**
 * Name shown for an agent everywhere in the UI (3D label, side list, @mention picker).
 * Always the user-given name; the translated role is only a fallback for nameless agents.
 */
export function agentLabel(
  agent: Pick<AgentConfig, "displayName" | "polyPresetId">,
  t: Translate,
): string {
  const name = agent.displayName.trim();
  if (name) return name;
  const preset = getPolyPreset(agent.polyPresetId);
  return t(preset.nameKey) || preset.defaultDisplayName;
}
