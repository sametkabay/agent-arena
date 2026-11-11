import { chatCompletion } from "@/lib/ai/providers";
import { resolveArenaTargets } from "@/lib/ai/arenaChat";
import {
  abortTurn,
  applyHumanMessage,
  beginTurn,
  canTakeTurn,
  completeTurn,
  createConversationState,
  callableSpeakerIds,
  eligibleSpeakers,
  failTurn,
  formatArenaHistory,
  isWaitingForHuman,
  pickNextSpeaker,
  type ConversationBudget,
  type ConversationState,
  type PauseFlags,
} from "@/lib/ai/conversation";
import {
  buildAgentSystemPrompt,
  getArenaWorldContext,
  withSituationUserMessage,
} from "@/lib/ai/arenaContext";
import type { AgentConfig, AiModelConfig } from "@/lib/types";
import { useArenaStore } from "@/store/arenaStore";
import { appConfig, fillPrompt, prompts, speechMsForText } from "@/lib/config";

export type ConversationRuntime = {
  state: ConversationState | null;
  abort: AbortController | null;
  modeActive: boolean;
};

function budget(): ConversationBudget {
  return appConfig.conversation;
}

export function createConversationRuntime(): ConversationRuntime {
  return { state: null, abort: null, modeActive: false };
}

export function disposeConversationRuntime(rt: ConversationRuntime): void {
  rt.abort?.abort();
  rt.abort = null;
  rt.state = null;
  rt.modeActive = false;
}

function readPauseFlags(): PauseFlags {
  const s = useArenaStore.getState();
  return {
    settingsOpen: s.settingsOpen,
    mapEditorOpen: s.mapEditorOpen,
    hidden:
      typeof document !== "undefined" && document.visibilityState === "hidden",
  };
}

function sanitizeReply(text: string): string {
  return text
    .replace(/^["'«»‘’“”]+|["'«»‘’“”]+$/g, "")
    .replace(/^\s*(reply|answer|response|line)\s*:\s*/i, "")
    .trim();
}

function setStatus(
  status: "inactive" | "running" | "waitingForHuman" | "paused",
): void {
  const cur = useArenaStore.getState().conversationStatus;
  if (cur !== status) useArenaStore.getState().setConversationStatus(status);
}

function abortInflight(rt: ConversationRuntime): void {
  if (rt.abort) {
    rt.abort.abort();
    rt.abort = null;
  }
  if (rt.state) rt.state = abortTurn(rt.state);
}

/**
 * Periodic tick for conversation mode: one in-flight completion, budget + gap gated.
 */
export function tickConversation(rt: ConversationRuntime): void {
  const store = useArenaStore.getState();
  if (store.chatterMode !== "conversation") {
    if (rt.modeActive || rt.state || rt.abort) {
      abortInflight(rt);
      rt.state = null;
      rt.modeActive = false;
      setStatus("inactive");
    }
    return;
  }

  const now = Date.now();
  const b = budget();

  if (!rt.modeActive || !rt.state) {
    abortInflight(rt);
    rt.state = {
      ...createConversationState(now, b),
      // Do not re-apply an old seed from a previous mode.
      humanSeq: store.conversationSeed.seq,
    };
    rt.modeActive = true;
  }

  const pause = readPauseFlags();
  if (pause.settingsOpen || pause.mapEditorOpen || pause.hidden) {
    if (rt.abort) abortInflight(rt);
    setStatus("paused");
    return;
  }

  // Human seed takes priority over any in-flight agent turn.
  if (store.conversationSeed.seq !== rt.state.humanSeq) {
    abortInflight(rt);
    rt.state = applyHumanMessage(
      rt.state,
      store.conversationSeed.mentionIds,
      now,
      b,
    );
    // Align seq with the seed (applyHumanMessage increments from previous).
    rt.state = { ...rt.state, humanSeq: store.conversationSeed.seq };
  }

  const eligible = eligibleSpeakers(store.agents, store.models);
  const priorityAllow = callableSpeakerIds(store.agents, store.models);
  const gate = canTakeTurn(rt.state, b, now, pause);
  if (!gate.ok) {
    if (gate.reason === "budget" || isWaitingForHuman(rt.state, b, eligible)) {
      setStatus("waitingForHuman");
    } else if (gate.reason === "inflight") {
      setStatus("running");
    } else if (gate.reason === "gap") {
      setStatus(
        isWaitingForHuman(rt.state, b, eligible) ? "waitingForHuman" : "running",
      );
    } else {
      setStatus("paused");
    }
    return;
  }

  if (isWaitingForHuman(rt.state, b, eligible)) {
    setStatus("waitingForHuman");
    return;
  }

  const speakerId = pickNextSpeaker(
    rt.state,
    eligible,
    store.chatBusyById,
    Math.random,
    priorityAllow,
  );
  if (!speakerId) {
    // Busy priority target → stay running and wait; otherwise nothing to say.
    const waitingOnBusyPriority = rt.state.priorityQueue.some(
      (id) =>
        id !== rt.state!.lastSpeakerId &&
        priorityAllow.has(id) &&
        Boolean(store.chatBusyById[id]),
    );
    if (waitingOnBusyPriority) {
      setStatus("running");
      return;
    }
    setStatus(
      eligible.length > 0 || priorityAllow.size > 0 ? "waitingForHuman" : "inactive",
    );
    return;
  }

  const agent = store.agents.find((a) => a.id === speakerId);
  const model = agent
    ? store.models.find((m) => m.id === agent.modelConfigId)
    : undefined;
  if (!agent || !model) {
    setStatus("waitingForHuman");
    return;
  }

  setStatus("running");
  void runConversationTurn(rt, agent, model);
}

export async function runConversationTurn(
  rt: ConversationRuntime,
  agent: AgentConfig,
  model: AiModelConfig,
): Promise<void> {
  if (!rt.state || rt.abort) return;

  const ac = new AbortController();
  rt.abort = ac;
  rt.state = beginTurn(rt.state, agent.id);
  useArenaStore.getState().setChatBusy(agent.id, true);

  const { setAgentSpeech, pushFloatingChatLog } = useArenaStore.getState();
  let assembled = "";
  let raf = 0;

  const flushBubble = () => {
    raf = 0;
    if (!assembled.trim()) return;
    setAgentSpeech(
      agent.id,
      sanitizeReply(assembled) || "…",
      appConfig.speech.streamingHoldMs,
    );
  };

  const history = formatArenaHistory(
    useArenaStore.getState().arenaChatHistory,
    agent.id,
    {
      max: budget().historyLines,
      maxChars: budget().historyMaxChars,
    },
  );
  const userPrompt = fillPrompt(prompts.user.arenaConversation, {
    history,
  }).trim();

  try {
    const reply = await chatCompletion({
      model,
      signal: ac.signal,
      thinkingEnabled: false,
      messages: [
        {
          role: "system",
          content: buildAgentSystemPrompt({
            agentPrompt: agent.systemPrompt,
            agentName: agent.displayName,
            skills: agent.skills ?? [],
            world: getArenaWorldContext(agent.id),
            mode: "arena_conversation",
          }),
        },
        {
          role: "user",
          content: withSituationUserMessage(
            agent.id,
            userPrompt,
            "arena_conversation",
          ),
        },
      ],
      onToken: (chunk) => {
        assembled += chunk;
        if (!raf) raf = requestAnimationFrame(flushBubble);
      },
    });

    if (raf) cancelAnimationFrame(raf);
    if (ac.signal.aborted || rt.abort !== ac) {
      setAgentSpeech(agent.id, undefined);
      return;
    }

    const text = sanitizeReply((reply || assembled).trim());
    const now = Date.now();
    if (text) {
      setAgentSpeech(agent.id, text, speechMsForText(text));
      pushFloatingChatLog({
        agentId: agent.id,
        agentName: agent.displayName,
        color: agent.color,
        text,
        kind: "agent",
      });
      const { targets, mentioned } = resolveArenaTargets(
        text,
        useArenaStore.getState().agents,
        { selfId: agent.id },
      );
      if (rt.state) {
        rt.state = completeTurn(
          rt.state,
          agent.id,
          now,
          mentioned ? targets.map((t) => t.id) : [],
        );
      }
    } else {
      setAgentSpeech(agent.id, undefined);
      if (rt.state) rt.state = failTurn(rt.state, agent.id, now);
    }
  } catch (e) {
    if (raf) cancelAnimationFrame(raf);
    if ((e as Error).name === "AbortError") {
      setAgentSpeech(agent.id, undefined);
      return;
    }
    setAgentSpeech(agent.id, undefined);
    if (rt.state && rt.abort === ac) {
      rt.state = failTurn(rt.state, agent.id, Date.now());
    }
  } finally {
    if (rt.abort === ac) rt.abort = null;
    useArenaStore.getState().setChatBusy(agent.id, false);
  }
}
