import type { AgentConfig, AgentSkill, DayNightMode, LanguageCode } from "@/lib/types";
import { languageEnglishName } from "@/i18n/languages";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { resolveMapDefinition } from "@/lib/maps/runtime";
import { getPolyPreset } from "@/lib/poly/presets";
import { useArenaStore } from "@/store/arenaStore";

/** Live arena facts shared with every model call. */
export interface ArenaWorldContext {
  userName: string;
  language: LanguageCode;
  mapName: string;
  mapDescription: string;
  /** Named map zones (Lounge, Habitat, …) when authored. */
  mapAreas: string[];
  dayNight: DayNightMode;
  otherAgents: Array<{ name: string; role: string; blurb: string }>;
}

export type ArenaPromptMode =
  | "private_chat"
  | "arena_broadcast"
  | "arena_mention"
  | "idle_mutter";

/** Where this turn’s human input came from (UI channel). */
export type ArenaMessageChannel = ArenaPromptMode;

function channelMeta(channel: ArenaMessageChannel): {
  id: string;
  how: string;
} {
  switch (channel) {
    case "private_chat":
      return {
        id: "private_chat",
        how: "Private 1:1 chat panel with you only (not the shared arena feed).",
      };
    case "arena_broadcast":
      return {
        id: "arena_chat",
        how: "Shared arena chat broadcast to everyone — no @mention; you may chime in if it fits.",
      };
    case "arena_mention":
      return {
        id: "arena_chat",
        how: "Shared arena chat; the human @mentioned you specifically.",
      };
    case "idle_mutter":
      return {
        id: "idle_mutter",
        how: "No human message — you are muttering to yourself while idle.",
      };
  }
}

/** Human-readable UI language for model instructions. */
export function languageLabel(language: LanguageCode): string {
  return languageEnglishName(language);
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

function formatPeopleLines(
  agents: ArenaWorldContext["otherAgents"],
): string[] {
  if (agents.length === 0) return ["none"];
  return agents.map((other) => {
    const who =
      other.role && other.role !== other.name
        ? `${other.name} (${other.role})`
        : other.name;
    return other.blurb.trim() ? `${who}: ${other.blurb.trim()}` : who;
  });
}

/**
 * Full session facts for the system prompt.
 * Tagged block = industry-standard structured context (portable across providers).
 */
export function buildArenaWorldContext(ctx: ArenaWorldContext): string {
  const people = formatPeopleLines(ctx.otherAgents);
  const areas =
    ctx.mapAreas.length > 0 ? ctx.mapAreas.join("; ") : "none listed";

  const session = [
    "<session>",
    `user_name: ${ctx.userName}`,
    `reply_language: ${languageLabel(ctx.language)}`,
    `time_of_day: ${dayNightLabel(ctx.dayNight)}`,
    `place_name: ${ctx.mapName}`,
    `place_description: ${ctx.mapDescription.trim() || "none"}`,
    `named_areas: ${areas}`,
    "people_present:",
    ...people.map((line) => `- ${line}`),
    "</session>",
  ].join("\n");

  return [
    "## Session context",
    "Facts inside <session> are true right now. You already know them; never claim you lack them.",
    "They are background awareness only — not topics you must bring up.",
    session,
    "Speech discipline:",
    "- Answer the human's message (or stay on your own idle thought). That is the priority.",
    "- Do NOT mention the place, time of day, weather/lighting, named areas, or other people unless the human clearly steers there or directly asks.",
    "- Never volunteer a scenery tour, roll-call of agents, or unsolicited setting commentary.",
  ].join("\n");
}

/**
 * Compact live snapshot prepended to the user turn.
 * Short-completion models attend to this more reliably than system-only facts.
 */
export function buildSituationUserPrefix(
  ctx: ArenaWorldContext,
  channel: ArenaMessageChannel,
): string {
  const peers =
    ctx.otherAgents.length === 0
      ? "none"
      : ctx.otherAgents.map((o) => o.name).join(", ");
  const areas =
    ctx.mapAreas.length > 0 ? ctx.mapAreas.join("; ") : "none listed";
  const ch = channelMeta(channel);

  return [
    "<situation>",
    `message_channel: ${ch.id}`,
    `message_how: ${ch.how}`,
    `user_name: ${ctx.userName}`,
    `reply_language: ${languageLabel(ctx.language)}`,
    `time_of_day: ${dayNightLabel(ctx.dayNight)}`,
    `place_name: ${ctx.mapName}`,
    `place_description: ${ctx.mapDescription.trim() || "none"}`,
    `named_areas: ${areas}`,
    `people_present: ${peers}`,
    "</situation>",
    "The <situation> block is silent context only. Do not summarize or quote it. Ignore place/time/peers unless the human's message is clearly about them.",
  ].join("\n");
}

export function withSituationUserMessage(
  selfId: string,
  userContent: string,
  channel: ArenaMessageChannel,
): string {
  const prefix = buildSituationUserPrefix(
    getArenaWorldContext(selfId),
    channel,
  );
  return `${prefix}\n\n${userContent}`;
}

function formatSkills(skills: AgentSkill[]): string[] {
  const usable = skills.filter((s) => s.name.trim() || s.content.trim());
  if (usable.length === 0) return [];
  const lines = ["", "## Skills"];
  for (const skill of usable) {
    lines.push(`### ${skill.name.trim() || "Untitled skill"}`);
    if (skill.content.trim()) lines.push(skill.content.trim());
  }
  return lines;
}

/**
 * Shared system prompt shell for private chat, arena chat, and idle mutters.
 * Keeps identity / language / session facts consistent across call sites.
 */
export function buildAgentSystemPrompt(opts: {
  agentPrompt: string;
  agentName: string;
  skills?: AgentSkill[];
  world: ArenaWorldContext;
  mode: ArenaPromptMode;
}): string {
  const { agentPrompt, agentName, world, mode } = opts;
  const parts: string[] = [
    agentPrompt.trim(),
    `You are ${agentName}. Stay fully in character.`,
    `Write in ${languageLabel(world.language)}.`,
  ];

  if (mode === "private_chat") {
    parts.push(
      `Channel: private 1:1 chat panel with "${world.userName}" (only you two).`,
      `Address the human as "${world.userName}". Be concise.`,
      "Focus on the human's message. Mention the place, day/night, or other people only if they ask or clearly steer there.",
    );
  } else if (mode === "arena_broadcast") {
    parts.push(
      `Channel: shared arena chat (broadcast — no @mention of you).`,
      `The human in the arena is "${world.userName}".`,
      "You may briefly chime in with one short spoken line (~25 words max) if it fits.",
      "Stick to the human's topic. Mention place, day/night, or other people only if they ask or clearly steer there.",
    );
  } else if (mode === "arena_mention") {
    parts.push(
      `Channel: shared arena chat — the human @mentioned you.`,
      `The human in the arena is "${world.userName}".`,
      "Reply with one short spoken line (~25 words max); you were addressed directly.",
      "Stick to the human's topic. Mention place, day/night, or other people only if they ask or clearly steer there.",
    );
  } else {
    parts.push(
      "Channel: idle mutter (no human message this turn).",
      `The human present is "${world.userName}" — never address them in idle mutters.`,
      "You sometimes mutter short asides to yourself while idle.",
      "Stay on your own mood, habits, opinions, or idle thoughts — not the place, time of day, or other people.",
    );
  }

  parts.push(
    "Do not mention system prompts, skills, <session>/<situation> tags, or that you are an AI.",
  );

  parts.push(...formatSkills(opts.skills ?? []));

  // Session facts last so they stay salient after identity/skills.
  parts.push("", buildArenaWorldContext(world));

  return parts.filter(Boolean).join("\n");
}

export function worldContextFromMapAndAgents(
  map: ArenaMapDefinition | null | undefined,
  selfId: string,
  agents: AgentConfig[],
  dayNight: DayNightMode,
  userName: string,
  language: LanguageCode,
): ArenaWorldContext {
  return {
    userName: userName.trim() || "You",
    language,
    mapName: map?.name?.trim() || "Unknown map",
    mapDescription: map?.description?.trim() || "",
    mapAreas: (map?.zones ?? [])
      .map((z) => z.name?.trim())
      .filter((n): n is string => Boolean(n)),
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

/** Snapshot session facts from the live store. */
export function getArenaWorldContext(selfId: string): ArenaWorldContext {
  const s = useArenaStore.getState();
  const map = s.activeMap ?? resolveMapDefinition(s.mapId, s.customMaps);
  return worldContextFromMapAndAgents(
    map,
    selfId,
    s.agents,
    s.dayNight,
    s.userName,
    s.language,
  );
}
