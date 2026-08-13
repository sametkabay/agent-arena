import type { AgentConfig, AgentSkill, DayNightMode, LanguageCode } from "@/lib/types";
import { languageEnglishName } from "@/i18n/languages";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { resolveMapDefinition } from "@/lib/maps/runtime";
import { getPolyPreset } from "@/lib/poly/presets";
import { useArenaStore } from "@/store/arenaStore";
import {
  appConfig,
  fillPrompt,
  fillPromptLines,
  promptMode,
  prompts,
  type ArenaPromptMode,
} from "@/lib/config";

export type { ArenaPromptMode };

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

/** Where this turn’s human input came from (UI channel). */
export type ArenaMessageChannel = ArenaPromptMode;

function channelMeta(channel: ArenaMessageChannel): {
  id: string;
  how: string;
} {
  const spec = promptMode(channel);
  return { id: spec.channelId, how: spec.how };
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
  if (bio) return { role, blurb: clip(bio, prompts.briefs.bioMax) };

  const prompt = agent.systemPrompt.trim().replace(/\s+/g, " ");
  if (prompt) {
    const cleaned = prompt
      .replace(/^you are [^.,;:]+[.,;:]?\s*/i, "")
      .trim();
    return { role, blurb: clip(cleaned || prompt, prompts.briefs.promptMax) };
  }

  return { role, blurb: "" };
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function dayNightLabel(mode: DayNightMode): string {
  return mode === "night" ? prompts.labels.night : prompts.labels.day;
}

function formatPeopleLines(
  agents: ArenaWorldContext["otherAgents"],
): string[] {
  if (agents.length === 0) return [`- ${prompts.labels.none}`];
  return agents.map((other) => {
    const who =
      other.role && other.role !== other.name
        ? `${other.name} (${other.role})`
        : other.name;
    return other.blurb.trim() ? `- ${who}: ${other.blurb.trim()}` : `- ${who}`;
  });
}

/**
 * Full session facts for the system prompt.
 * Tagged block = industry-standard structured context (portable across providers).
 */
export function buildArenaWorldContext(ctx: ArenaWorldContext): string {
  const peopleLines = formatPeopleLines(ctx.otherAgents).join("\n");
  const areas =
    ctx.mapAreas.length > 0 ? ctx.mapAreas.join("; ") : prompts.labels.noneListed;

  const session = fillPrompt(prompts.session.block, {
    userName: ctx.userName,
    language: languageLabel(ctx.language),
    timeOfDay: dayNightLabel(ctx.dayNight),
    mapName: ctx.mapName,
    mapDescription: ctx.mapDescription.trim() || prompts.labels.none,
    namedAreas: areas,
    peopleLines,
  }).trim();

  return [
    prompts.session.heading,
    prompts.session.intro.trim(),
    session,
    prompts.session.speechDiscipline.trim(),
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
      ? prompts.labels.none
      : ctx.otherAgents.map((o) => o.name).join(", ");
  const areas =
    ctx.mapAreas.length > 0 ? ctx.mapAreas.join("; ") : prompts.labels.noneListed;
  const ch = channelMeta(channel);

  return [
    fillPrompt(prompts.situation.block, {
      channelId: ch.id,
      channelHow: ch.how,
      userName: ctx.userName,
      language: languageLabel(ctx.language),
      timeOfDay: dayNightLabel(ctx.dayNight),
      mapName: ctx.mapName,
      mapDescription: ctx.mapDescription.trim() || prompts.labels.none,
      namedAreas: areas,
      peoplePresent: peers,
    }).trim(),
    prompts.situation.footer,
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
  const lines = ["", prompts.skills.heading];
  for (const skill of usable) {
    lines.push(`### ${skill.name.trim() || prompts.skills.untitled}`);
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
  const vars = { agentName, language: languageLabel(world.language), userName: world.userName };
  const parts: string[] = [
    agentPrompt.trim(),
    fillPrompt(prompts.identity, vars),
    fillPrompt(prompts.language, vars),
    ...fillPromptLines(promptMode(mode).lines, vars),
    prompts.internals,
  ];

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
    userName: userName.trim() || appConfig.defaults.unknownUser,
    language,
    mapName: map?.name?.trim() || appConfig.defaults.unknownMap,
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
          name: a.displayName.trim() || appConfig.defaults.unknownAgent,
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
