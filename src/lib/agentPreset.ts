import type { AgentConfig } from "@/lib/types";
import { CUSTOM_PRESET, getPolyPreset, isCustomPreset } from "@/lib/poly/presets";
import { getCharacter } from "@/lib/assets/characters";

/** True when the bio is empty or still one of the stock look/role bios. */
export function isStockBio(
  bio: string | undefined,
  characterId: string,
  roleId: string,
): boolean {
  const trimmed = bio?.trim() ?? "";
  if (!trimmed) return true;
  const lookBio = getCharacter(characterId).defaultBio ?? "";
  const roleBio = getPolyPreset(roleId).defaultBio ?? "";
  return trimmed === lookBio || trimmed === roleBio;
}

/**
 * Switch an agent draft to another role preset.
 * The role only sets persona / color / stock bio — it never touches the
 * user-given `displayName` (agents are addressed by name, not class).
 */
export function applyRolePreset(editing: AgentConfig, presetId: string): AgentConfig {
  const preset = getPolyPreset(presetId);
  const custom = isCustomPreset(presetId);
  const nextBio = custom
    ? editing.bio
    : isStockBio(editing.bio, editing.characterId, editing.polyPresetId)
      ? preset.defaultBio || editing.bio
      : editing.bio;

  return {
    ...editing,
    polyPresetId: presetId,
    systemPrompt: custom
      ? editing.systemPrompt || CUSTOM_PRESET.defaultSystemPrompt
      : preset.defaultSystemPrompt,
    color: custom ? editing.color || preset.defaultColor : preset.defaultColor,
    bio: nextBio,
  };
}
