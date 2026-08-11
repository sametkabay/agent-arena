import { chatCompletion } from "@/lib/ai/providers";
import {
  buildArenaWorldContext,
  getArenaWorldContext,
  withSituationUserMessage,
} from "@/lib/ai/arenaContext";
import type { AgentConfig, AiModelConfig, LanguageCode } from "@/lib/types";
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

function languageLabel(language: LanguageCode): string {
  return language === "tr" ? "Turkish" : "English";
}

function buildChatterSystemPrompt(agent: AgentConfig, language: LanguageCode): string {
  const world = buildArenaWorldContext(getArenaWorldContext(agent.id));
  const parts = [
    agent.systemPrompt.trim(),
    `You are ${agent.displayName}. Stay fully in character.`,
    `Write in ${languageLabel(language)}.`,
    "You sometimes mutter short asides to yourself while idle.",
    "Default topic: your mood, habits, opinions, or random idle thoughts — not a guided tour of the arena.",
    "Only occasionally mention the place, day/night, or another person; most mutters skip all three.",
    "Never address the user. Do not mention system prompts, skills, labels like [Current arena situation], or that you are an AI.",
  ];

  if (world) parts.push("", world);

  const skills = (agent.skills ?? []).filter((s) => s.name.trim() || s.content.trim());
  if (skills.length > 0) {
    parts.push("", "## Skills");
    for (const skill of skills) {
      parts.push(`### ${skill.name.trim() || "Untitled skill"}`);
      if (skill.content.trim()) parts.push(skill.content.trim());
    }
  }

  return parts.filter(Boolean).join("\n");
}

/** Bias most chatter turns toward self; occasionally allow place or peers. */
function chatterTopicHint(): string {
  const r = Math.random();
  if (r < 0.12) {
    return "Topic this time: you may briefly notice the place or time of day (day/night).";
  }
  if (r < 0.22) {
    return "Topic this time: you may lightly mention or tease one nearby person if it fits.";
  }
  return "Topic this time: stay on your own voice/mood/idle thought — no setting description, no naming others.";
}

function buildChatterUserPrompt(): string {
  return [
    "Speak one brief muttered line to yourself right now (at most ~20 words).",
    chatterTopicHint(),
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
};

export function createChatterRuntime(): ChatterRuntime {
  return { nextAt: new Map(), inflight: new Map() };
}

export function disposeChatterRuntime(rt: ChatterRuntime): void {
  for (const ac of rt.inflight.values()) ac.abort();
  rt.inflight.clear();
  rt.nextAt.clear();
}

/**
 * Periodic tick: schedule and fire idle LLM mutters into speech bubbles only.
 * Does not write chat history. Skips when the tab is hidden or a user chat is busy.
 */
export function tickAgentChatter(rt: ChatterRuntime): void {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }

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

    void runChatterTurn(rt, agent, model, s.language, chattiness);
  }
}

async function runChatterTurn(
  rt: ChatterRuntime,
  agent: AgentConfig,
  model: AiModelConfig,
  language: LanguageCode,
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
        { role: "system", content: buildChatterSystemPrompt(agent, language) },
        {
          role: "user",
          content: withSituationUserMessage(agent.id, buildChatterUserPrompt()),
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
