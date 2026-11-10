import type { AgentConfig, AiModelConfig, FloatingChatLine } from "@/lib/types";

export type ChatterMode = "off" | "idle" | "conversation";

export interface ConversationBudget {
  minGapMs: number;
  maxAgentTurns: number;
  humanReplyDelayMs: number;
  firstTurnDelayMs: number;
  historyLines: number;
  historyMaxChars: number;
}

export interface ConversationState {
  lastSpeakerId: string | null;
  lastTurnEndedAt: number;
  agentTurnsSinceHuman: number;
  /** Ids addressed by @mention, FIFO, deduped. */
  priorityQueue: string[];
  inflightAgentId: string | null;
  humanSeq: number;
}

export interface PauseFlags {
  settingsOpen: boolean;
  mapEditorOpen: boolean;
  hidden: boolean;
}

export type CanTakeTurnResult =
  | { ok: true }
  | { ok: false; reason: "paused" | "inflight" | "budget" | "gap" };

export interface EligibleSpeaker {
  id: string;
  chattiness: number;
}

const VALID_MODES = new Set<ChatterMode>(["off", "idle", "conversation"]);

/** Resolve persisted mode; migrate legacy idleChatterEnabled when mode is missing. */
export function parseChatterMode(raw: unknown, legacyIdle?: unknown): ChatterMode {
  if (typeof raw === "string" && VALID_MODES.has(raw as ChatterMode)) {
    return raw as ChatterMode;
  }
  if (legacyIdle === true) return "idle";
  return "off";
}

/** Fresh conversation state; first turn is delayed by firstTurnDelayMs. */
export function createConversationState(
  now: number,
  budget: ConversationBudget,
): ConversationState {
  return {
    lastSpeakerId: null,
    lastTurnEndedAt: now - budget.minGapMs + budget.firstTurnDelayMs,
    agentTurnsSinceHuman: 0,
    priorityQueue: [],
    inflightAgentId: null,
    humanSeq: 0,
  };
}

/** Enabled agents that point at a known model (any chattiness, stable order). */
export function callableSpeakerIds(
  agents: AgentConfig[],
  models: AiModelConfig[],
): Set<string> {
  const modelIds = new Set(models.map((m) => m.id));
  const out = new Set<string>();
  for (const agent of agents) {
    if (agent.enabled === false) continue;
    if (!agent.modelConfigId || !modelIds.has(agent.modelConfigId)) continue;
    out.add(agent.id);
  }
  return out;
}

/** Enabled agents with chattiness > 0 that point at a known model (stable order). */
export function eligibleSpeakers(
  agents: AgentConfig[],
  models: AiModelConfig[],
): EligibleSpeaker[] {
  const modelIds = new Set(models.map((m) => m.id));
  const out: EligibleSpeaker[] = [];
  for (const agent of agents) {
    if (agent.enabled === false) continue;
    const chattiness = agent.chattiness ?? 0;
    if (chattiness <= 0) continue;
    if (!agent.modelConfigId || !modelIds.has(agent.modelConfigId)) continue;
    out.push({ id: agent.id, chattiness });
  }
  return out;
}

export function canTakeTurn(
  state: ConversationState,
  budget: ConversationBudget,
  now: number,
  pause: PauseFlags,
): CanTakeTurnResult {
  if (pause.settingsOpen || pause.mapEditorOpen || pause.hidden) {
    return { ok: false, reason: "paused" };
  }
  if (state.inflightAgentId != null) {
    return { ok: false, reason: "inflight" };
  }
  if (state.agentTurnsSinceHuman >= budget.maxAgentTurns) {
    return { ok: false, reason: "budget" };
  }
  if (now - state.lastTurnEndedAt < budget.minGapMs) {
    return { ok: false, reason: "gap" };
  }
  return { ok: true };
}

function dedupeQueue(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Pick the next speaker: priority queue first, else chattiness-weighted random.
 * Never returns lastSpeakerId. With one eligible agent, returns null after their turn.
 * Priority entries may include chattiness-0 agents via `priorityAllowIds` (enabled + model).
 * If the next priority agent is busy, wait (null) instead of giving the turn to someone else.
 */
export function pickNextSpeaker(
  state: ConversationState,
  eligible: EligibleSpeaker[],
  busyIds: ReadonlySet<string> | Record<string, boolean>,
  rng: () => number = Math.random,
  priorityAllowIds?: ReadonlySet<string>,
): string | null {
  const busy =
    busyIds instanceof Set
      ? busyIds
      : new Set(
          Object.entries(busyIds)
            .filter(([, v]) => v)
            .map(([id]) => id),
        );
  const priorityOk =
    priorityAllowIds ?? new Set(eligible.map((e) => e.id));
  const candidates = eligible.filter(
    (e) => e.id !== state.lastSpeakerId && !busy.has(e.id),
  );

  for (const id of state.priorityQueue) {
    if (id === state.lastSpeakerId) continue;
    if (!priorityOk.has(id)) continue;
    if (busy.has(id)) return null;
    return id;
  }

  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, c) => sum + c.chattiness, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const c of candidates) {
    roll -= c.chattiness;
    if (roll < 0) return c.id;
  }
  return candidates[candidates.length - 1]!.id;
}

export function applyHumanMessage(
  state: ConversationState,
  mentionedIds: string[],
  now: number,
  budget: ConversationBudget,
): ConversationState {
  return {
    ...state,
    agentTurnsSinceHuman: 0,
    lastSpeakerId: null,
    priorityQueue: dedupeQueue(mentionedIds),
    lastTurnEndedAt: now - budget.minGapMs + budget.humanReplyDelayMs,
    humanSeq: state.humanSeq + 1,
  };
}

export function beginTurn(state: ConversationState, id: string): ConversationState {
  return { ...state, inflightAgentId: id };
}

/** Finish a successful turn; prepend mentions (self removed) to the priority queue. */
export function completeTurn(
  state: ConversationState,
  id: string,
  now: number,
  mentionIds: string[],
): ConversationState {
  const withoutSelf = mentionIds.filter((m) => m !== id);
  const merged = dedupeQueue([...withoutSelf, ...state.priorityQueue.filter((q) => q !== id)]);
  return {
    ...state,
    inflightAgentId: null,
    agentTurnsSinceHuman: state.agentTurnsSinceHuman + 1,
    lastSpeakerId: id,
    lastTurnEndedAt: now,
    priorityQueue: merged,
  };
}

/** Count a failed turn so a broken endpoint cannot loop forever. */
export function failTurn(
  state: ConversationState,
  id: string,
  now: number,
): ConversationState {
  return {
    ...state,
    inflightAgentId: null,
    agentTurnsSinceHuman: state.agentTurnsSinceHuman + 1,
    lastSpeakerId: id,
    lastTurnEndedAt: now,
    priorityQueue: state.priorityQueue.filter((q) => q !== id),
  };
}

/** Clear in-flight work without counting it (pauses / human preempt). */
export function abortTurn(state: ConversationState): ConversationState {
  return { ...state, inflightAgentId: null };
}

export function formatArenaHistory(
  lines: FloatingChatLine[],
  selfId: string,
  opts: { max: number; maxChars: number },
): string {
  const usable = lines
    .filter((l) => l.kind === "user" || l.kind === "agent")
    .slice(-opts.max);

  const formatted = usable.map((l) => {
    const name =
      l.kind === "agent" && l.agentId === selfId
        ? `${l.agentName} (you)`
        : l.agentName;
    return `${name}: ${l.text}`;
  });

  let joined = formatted.join("\n");
  if (joined.length <= opts.maxChars) return joined;

  // Drop oldest lines first until under the character limit.
  let start = 0;
  while (start < formatted.length) {
    joined = formatted.slice(start).join("\n");
    if (joined.length <= opts.maxChars) return joined;
    start += 1;
  }
  // Newest line alone exceeds maxChars — keep a truncated steering line.
  const newest = formatted[formatted.length - 1] ?? "";
  return newest.slice(0, opts.maxChars);
}

/** True when the budget is used up, or nobody but the last speaker can talk. */
export function isWaitingForHuman(
  state: ConversationState,
  budget: ConversationBudget,
  eligible: EligibleSpeaker[],
): boolean {
  if (state.agentTurnsSinceHuman >= budget.maxAgentTurns) return true;
  const others = eligible.filter((e) => e.id !== state.lastSpeakerId);
  return others.length === 0 && eligible.length > 0 && state.lastSpeakerId != null;
}
