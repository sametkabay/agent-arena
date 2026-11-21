import raw from "@data/legacy-role-prompts.yaml";
import { getPolyPreset } from "@/lib/poly/presets";

type LegacyPromptsYaml = {
  prompts: Record<string, string>;
};

function normalizePromptWs(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim();
}

/**
 * Exact pre-#71 stock texts → role id that owned them.
 * Entries whose legacy text already equals that role's current stock are
 * omitted (e.g. custom) so they are no-ops and never rewrite other roles.
 */
const LEGACY_BY_PROMPT: ReadonlyMap<string, string> = (() => {
  const prompts = (raw as LegacyPromptsYaml).prompts ?? {};
  const map = new Map<string, string>();
  for (const [roleId, text] of Object.entries(prompts)) {
    if (typeof text !== "string" || !text.trim()) continue;
    const norm = normalizePromptWs(text);
    const current = normalizePromptWs(
      getPolyPreset(roleId).defaultSystemPrompt,
    );
    if (norm === current) continue;
    map.set(norm, roleId);
  }
  return map;
})();

/**
 * If `prompt` is a pre-#71 stock role prompt (whitespace-normalized), return
 * the **matched role's** current stock prompt — regardless of the agent's
 * preset — so a Custom agent that kept the old Explorer persona keeps the
 * Explorer persona (name-less). Unchanged prompts (and no-op roles like
 * custom) are returned as-is. Idempotent — safe on every load / import.
 *
 * `presetId` is unused; kept for call-site compatibility.
 */
export function migrateLegacySystemPrompt(
  prompt: string,
  _presetId: string,
): string {
  // Defense in depth: non-string values must not throw into loadPersisted.
  if (typeof prompt !== "string") return "";
  const matchedRoleId = LEGACY_BY_PROMPT.get(normalizePromptWs(prompt));
  if (!matchedRoleId) return prompt;
  return getPolyPreset(matchedRoleId).defaultSystemPrompt;
}
