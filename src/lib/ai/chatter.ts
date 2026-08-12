import { chatCompletion } from "@/lib/ai/providers";
import {
  buildAgentSystemPrompt,
  getArenaWorldContext,
  withSituationUserMessage,
} from "@/lib/ai/arenaContext";
import type { AgentConfig, AiModelConfig } from "@/lib/types";
import { useArenaStore } from "@/store/arenaStore";

/** At chattiness 100 → average 2 mutters / minute → 30s mean gap. */
const MAX_MUTTERS_PER_MINUTE = 2;

export function meanChatterIntervalMs(chattiness: number): number {
  if (chattiness <= 0) return Number.POSITIVE_INFINITY;
  return (60_000 / MAX_MUTTERS_PER_MINUTE) * (100 / chattiness);
}

export function scheduleNextChatterAt(chattiness: number, now = Date.now()): number {
  const mean = meanChatterIntervalMs(chattiness);
  if (!Number.isFinite(mean)) return Number.POSITIVE_INFINITY;
  // Uniform [0.5, 1.5]× mean keeps long-run average ≈ target rate.
  return now + mean * (0.5 + Math.random());
}

function buildChatterSystemPrompt(agent: AgentConfig): string {
  return buildAgentSystemPrompt({
    agentPrompt: agent.systemPrompt,
    agentName: agent.displayName,
    skills: agent.skills ?? [],
    world: getArenaWorldContext(agent.id),
    mode: "idle_mutter",
  });
}

/** Idle mutters stay on character voice — never force setting/peer topics. */
function buildChatterUserPrompt(): string {
  return [
    "Speak one brief muttered line to yourself right now (at most ~20 words).",
    "Stay on your own mood, habits, opinions, or idle thoughts.",
    "Do not describe the place, time of day, or name other people.",
    "Output only that line — no quotes, no labels, no emoji unless it fits your character.",
  ].join(" ");
}

function sanitizeMutter(text: string): string {
  return text
    .replace(/^["'«»‘’“”]+|["'«»‘’“”]+$/g, "")
    .replace(/^\s*(mutter|aside|line)\s*:\s*/i, "")
    .trim();
}

function speechMsForText(text: string): number {
  // ~45ms per character, clamped so short lines linger and long ones expire.
  return Math.min(12_000, Math.max(3500, Math.round(text.length * 45)));
}

type ChatterRuntime = {
  nextAt: Map<string, number>;
  inflight: Map<string, AbortController>;
  /** Wall-clock when the tab went hidden; null while visible. */
  pausedAt: number | null;
};

export function createChatterRuntime(): ChatterRuntime {
  return { nextAt: new Map(), inflight: new Map(), pausedAt: null };
}

export function disposeChatterRuntime(rt: ChatterRuntime): void {
  for (const ac of rt.inflight.values()) ac.abort();
  rt.inflight.clear();
  rt.nextAt.clear();
  rt.pausedAt = null;
}

/** Freeze chatter countdowns while the tab is in the background. */
export function pauseChatterRuntime(rt: ChatterRuntime): void {
  if (rt.pausedAt != null) return;
  rt.pausedAt = Date.now();
  for (const ac of rt.inflight.values()) ac.abort();
  rt.inflight.clear();
}

/** Push every next-mutter timestamp by the time spent hidden. */
export function resumeChatterRuntime(rt: ChatterRuntime): void {
  if (rt.pausedAt == null) return;
  const delta = Date.now() - rt.pausedAt;
  rt.pausedAt = null;
  if (delta <= 0) return;
  for (const [id, at] of rt.nextAt) {
    if (Number.isFinite(at)) rt.nextAt.set(id, at + delta);
  }
}

/**
 * Periodic tick: schedule and fire idle LLM mutters into speech bubbles only.
 * Does not write chat history. Skips when the tab is hidden or a user chat is busy.
 */
export function tickAgentChatter(rt: ChatterRuntime): void {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    pauseChatterRuntime(rt);
    return;
  }
  resumeChatterRuntime(rt);

  const s = useArenaStore.getState();
  if (s.mapEditorOpen || s.settingsOpen) return;

  const now = Date.now();
  const agentIds = new Set(
    s.agents.filter((a) => a.enabled !== false).map((a) => a.id),
  );

  for (const id of [...rt.nextAt.keys()]) {
    if (!agentIds.has(id)) {
      rt.nextAt.delete(id);
      const ac = rt.inflight.get(id);
      if (ac) {
        ac.abort();
        rt.inflight.delete(id);
      }
    }
  }

  for (const agent of s.agents) {
    if (agent.enabled === false) {
      rt.nextAt.delete(agent.id);
      continue;
    }
    const chattiness = agent.chattiness ?? 0;
    if (chattiness <= 0) {
      rt.nextAt.delete(agent.id);
      continue;
    }

    if (!rt.nextAt.has(agent.id)) {
      // Stagger first mutter so agents don't sync-fire on load.
      rt.nextAt.set(agent.id, scheduleNextChatterAt(chattiness, now));
      continue;
    }

    if (s.chatBusyById[agent.id]) {
      const busyAbort = rt.inflight.get(agent.id);
      if (busyAbort) {
        busyAbort.abort();
        rt.inflight.delete(agent.id);
      }
      // Push the next attempt until after the user turn.
      rt.nextAt.set(agent.id, scheduleNextChatterAt(chattiness, now));
      continue;
    }

    if (rt.inflight.has(agent.id)) continue;

    const due = rt.nextAt.get(agent.id)!;
    if (now < due) continue;

    const model = s.models.find((m) => m.id === agent.modelConfigId);
    if (!model) {
      rt.nextAt.set(agent.id, scheduleNextChatterAt(chattiness, now));
      continue;
    }

    void runChatterTurn(rt, agent, model, chattiness);
  }
}

async function runChatterTurn(
  rt: ChatterRuntime,
  agent: AgentConfig,
  model: AiModelConfig,
  chattiness: number,
): Promise<void> {
  const ac = new AbortController();
  rt.inflight.set(agent.id, ac);
  // Reserve the next slot immediately so failures don't rapid-fire.
  rt.nextAt.set(agent.id, scheduleNextChatterAt(chattiness));

  const { setAgentSpeech } = useArenaStore.getState();
  let assembled = "";
  let raf = 0;

  const flushBubble = () => {
    raf = 0;
    if (!assembled.trim()) return;
    setAgentSpeech(agent.id, sanitizeMutter(assembled) || "…", 120_000);
  };

  try {
    const reply = await chatCompletion({
      model,
      signal: ac.signal,
      thinkingEnabled: false,
      messages: [
        { role: "system", content: buildChatterSystemPrompt(agent) },
        {
          role: "user",
          content: withSituationUserMessage(
            agent.id,
            buildChatterUserPrompt(),
            "idle_mutter",
          ),
        },
      ],
      onToken: (chunk) => {
        assembled += chunk;
        if (!raf) raf = requestAnimationFrame(flushBubble);
      },
    });

    if (raf) cancelAnimationFrame(raf);
    const text = sanitizeMutter((reply || assembled).trim());
    if (text) {
      setAgentSpeech(agent.id, text, speechMsForText(text));
      useArenaStore.getState().pushFloatingChatLog({
        agentId: agent.id,
        agentName: agent.displayName,
        color: agent.color,
        text,
        kind: "agent",
      });
    } else setAgentSpeech(agent.id, undefined);
  } catch (e) {
    if (raf) cancelAnimationFrame(raf);
    if ((e as Error).name === "AbortError") {
      setAgentSpeech(agent.id, undefined);
      return;
    }
    // Quietly skip failed mutters — don't spam toasts / chat history.
    setAgentSpeech(agent.id, undefined);
  } finally {
    if (rt.inflight.get(agent.id) === ac) rt.inflight.delete(agent.id);
  }
}
