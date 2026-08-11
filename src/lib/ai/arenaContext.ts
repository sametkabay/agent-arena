import type { AgentConfig, DayNightMode } from "@/lib/types";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { resolveMapDefinition } from "@/lib/maps/runtime";
import { getPolyPreset } from "@/lib/poly/presets";
import { useArenaStore } from "@/store/arenaStore";

export interface ArenaWorldContext {
  mapName: string;
  mapDescription: string;
  dayNight: DayNightMode;
  otherAgents: Array<{ name: string; role: string; blurb: string }>;
}

/** Short public blurb for another agent (bio → role → clipped system prompt). */
export function describeAgentBrief(agent: AgentConfig): {
  role: string;
  blurb: string;
} {
  const preset = getPolyPreset(agent.polyPresetId);
  const role = preset.defaultDisplayName || preset.id;

  const bio = agent.bio?.trim();
  if (bio) return { role, blurb: clip(bio, 140) };

  const prompt = agent.systemPrompt.trim().replace(/\s+/g, " ");
  if (prompt) {
    // Strip leading "You are X, ..." so peers read as people, not prompt dumps.
    const cleaned = prompt
      .replace(/^you are [^.,;:]+[.,;:]?\s*/i, "")
      .trim();
    return { role, blurb: clip(cleaned || prompt, 120) };
  }

  return { role, blurb: "" };
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function dayNightLabel(mode: DayNightMode): string {
  return mode === "night" ? "night" : "day";
}

/**
 * Stable world facts for the system prompt.
 * Keep identity/skills here; models treat this as lasting knowledge.
 */
export function buildArenaWorldContext(ctx: ArenaWorldContext): string {
  const mapLine = ctx.mapDescription.trim()
    ? `Place: "${ctx.mapName}" — ${ctx.mapDescription.trim()}`
    : `Place: "${ctx.mapName}"`;
  const timeLine = `Time of day: ${dayNightLabel(ctx.dayNight)}.`;

  const lines = [
    "## World (always true)",
    "These facts are real background. You already know them; never claim you lack them.",
    "Speech discipline (important):",
    "- Default every line to your character: mood, habits, work, opinions, jokes, idle thoughts.",
    "- About ~4 out of 5 lines: do NOT describe the place, weather, sky, lighting, or time of day.",
    "- About ~4 out of 5 lines: do NOT name or tease another person.",
    "- Only occasionally (~1 in 5) weave in the setting, day/night, or someone nearby — and then keep it light, not a tour.",
    "- Never turn a whole answer into scenery commentary or a roll-call of other agents.",
    mapLine,
    timeLine,
  ];

  if (ctx.otherAgents.length === 0) {
    lines.push("Other people here: none right now.");
  } else {
    lines.push("Roster (awareness only — not topics you must cover):");
    for (const other of ctx.otherAgents) {
      const who =
        other.role && other.role !== other.name
          ? `${other.name} (${other.role})`
          : other.name;
      lines.push(
        other.blurb.trim() ? `- ${who}: ${other.blurb.trim()}` : `- ${who}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Compact situation block prepended to the user turn.
 * Short-completion prompts attend to this more reliably than system-only facts.
 */
export function buildSituationUserPrefix(ctx: ArenaWorldContext): string {
  const mapBit = ctx.mapDescription.trim()
    ? `${ctx.mapName} — ${ctx.mapDescription.trim()}`
    : ctx.mapName;

  const peers =
    ctx.otherAgents.length === 0
      ? "nobody else"
      : ctx.otherAgents.map((o) => o.name).join(", ");

  return [
    "[Current arena situation]",
    `Place: ${mapBit}`,
    `Time: ${dayNightLabel(ctx.dayNight)}`,
    `People present: ${peers}`,
    "Meta: this block is silent context. Do not summarize it. Most lines ignore place/time/peers; only rarely mention them.",
    "[/Current arena situation]",
  ].join("\n");
}

export function withSituationUserMessage(
  selfId: string,
  userContent: string,
): string {
  const prefix = buildSituationUserPrefix(getArenaWorldContext(selfId));
  return `${prefix}\n\n${userContent}`;
}

export function worldContextFromMapAndAgents(
  map: ArenaMapDefinition | null | undefined,
  selfId: string,
  agents: AgentConfig[],
  dayNight: DayNightMode,
): ArenaWorldContext {
  return {
    mapName: map?.name?.trim() || "Unknown map",
    mapDescription: map?.description?.trim() || "",
    dayNight,
    otherAgents: agents
      .filter((a) => a.id !== selfId && a.enabled !== false)
      .map((a) => {
        const { role, blurb } = describeAgentBrief(a);
        return {
          name: a.displayName.trim() || "Agent",
          role,
          blurb,
        };
      }),
  };
}

/** Snapshot map + peers from the live store (resolves map even if activeMap is briefly null). */
export function getArenaWorldContext(selfId: string): ArenaWorldContext {
  const s = useArenaStore.getState();
  const map =
    s.activeMap ?? resolveMapDefinition(s.mapId, s.customMaps);
  return worldContextFromMapAndAgents(map, selfId, s.agents, s.dayNight);
}
