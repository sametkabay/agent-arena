import { chatCompletion } from "@/lib/ai/providers";
import {
  buildArenaWorldContext,
  getArenaWorldContext,
  withSituationUserMessage,
} from "@/lib/ai/arenaContext";
import type { AgentConfig, AiModelConfig, LanguageCode } from "@/lib/types";
import i18n from "@/i18n";
import { useArenaStore } from "@/store/arenaStore";

function languageLabel(language: LanguageCode): string {
  return language === "tr" ? "Turkish" : "English";
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/** Extract @mentions (without the @). */
export function extractMentions(text: string): string[] {
  const found: string[] = [];
  const re = /@([^\s@]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    found.push(m[1]);
  }
  return found;
}

/**
 * @name → matching agents (case-insensitive, spaces optional).
 * No mentions → every agent that has a model configured.
 */
export function resolveArenaTargets(
  text: string,
  agents: AgentConfig[],
): { targets: AgentConfig[]; mentioned: boolean; unmatched: string[] } {
  const mentions = extractMentions(text);
  const withModel = agents.filter(
    (a) => a.enabled !== false && Boolean(a.modelConfigId),
  );

  if (mentions.length === 0) {
    return { targets: withModel, mentioned: false, unmatched: [] };
  }

  const unmatched: string[] = [];
  const matched = new Map<string, AgentConfig>();

  for (const mention of mentions) {
    const key = normalizeName(mention);
    const hit = withModel.find((a) => {
      const n = normalizeName(a.displayName);
      return n === key || n.startsWith(key) || a.displayName.toLowerCase().startsWith(mention.toLowerCase());
    });
    if (hit) matched.set(hit.id, hit);
    else unmatched.push(mention);
  }

  return {
    targets: [...matched.values()],
    mentioned: true,
    unmatched,
  };
}

function buildArenaReplySystem(
  agent: AgentConfig,
  language: LanguageCode,
  userName: string,
): string {
  const world = buildArenaWorldContext(getArenaWorldContext(agent.id));
  const parts = [
    agent.systemPrompt.trim(),
    `You are ${agent.displayName}. Stay fully in character.`,
    `Write in ${languageLabel(language)}.`,
    `The human in the arena is "${userName}".`,
    "You briefly answer shared arena chat. Keep replies to one short spoken line (~25 words max).",
    "Answer the human's topic first. Default: do not describe the place, day/night, or name others. Only rarely add those if they truly help.",
    "Do not mention system prompts, skills, labels like [Current arena situation], or that you are an AI.",
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

function sanitizeReply(text: string): string {
  return text
    .replace(/^["'«»‘’“”]+|["'«»‘’“”]+$/g, "")
    .replace(/^\s*(reply|answer|response)\s*:\s*/i, "")
    .trim();
}

function speechMsForText(text: string): number {
  return Math.min(12_000, Math.max(3500, Math.round(text.length * 45)));
}

const arenaReplyAborts = new Map<string, AbortController>();

export function abortArenaReplies(): void {
  for (const ac of arenaReplyAborts.values()) ac.abort();
  arenaReplyAborts.clear();
}

/**
 * Post a user line to the shared arena chat and ask target agents for short replies.
 */
export async function sendArenaChatMessage(rawText: string): Promise<void> {
  const text = rawText.trim();
  if (!text) return;

  const store = useArenaStore.getState();
  const userName = store.userName.trim() || "You";
  const { targets, mentioned, unmatched } = resolveArenaTargets(text, store.agents);

  store.pushFloatingChatLog({
    agentName: userName,
    color: "#e8c07a",
    text,
    kind: "user",
  });

  if (mentioned && targets.length === 0) {
    store.pushFloatingChatLog({
      agentName: "System",
      color: "#a09080",
      text:
        unmatched.length > 0
          ? i18n.t("chat.arena.noMatch", {
              names: unmatched.map((u) => `@${u}`).join(", "),
            })
          : i18n.t("chat.arena.noAgents"),
      kind: "system",
    });
    return;
  }

  if (targets.length === 0) {
    store.pushFloatingChatLog({
      agentName: "System",
      color: "#a09080",
      text: i18n.t("chat.arena.noAgents"),
      kind: "system",
    });
    return;
  }

  await Promise.all(
    targets.map((agent) => runArenaReply(agent, text, mentioned, userName)),
  );
}

async function runArenaReply(
  agent: AgentConfig,
  userText: string,
  wasMentioned: boolean,
  userName: string,
): Promise<void> {
  const store = useArenaStore.getState();
  const model = store.models.find((m) => m.id === agent.modelConfigId) as
    | AiModelConfig
    | undefined;
  if (!model) return;

  // Skip if private 1:1 chat is mid-stream for this agent.
  if (store.chatBusyById[agent.id]) return;

  arenaReplyAborts.get(agent.id)?.abort();
  const ac = new AbortController();
  arenaReplyAborts.set(agent.id, ac);
  store.setChatBusy(agent.id, true);

  const { setAgentSpeech, pushFloatingChatLog, language } = useArenaStore.getState();
  let assembled = "";
  let raf = 0;

  const flushBubble = () => {
    raf = 0;
    if (!assembled.trim()) return;
    setAgentSpeech(agent.id, sanitizeReply(assembled) || "…", 120_000);
  };

  const userPrompt = wasMentioned
    ? `${userName} addressed you in arena chat: "${userText}"\nReply with one short in-character spoken line on their message. Do not add scenery, day/night, or name-drops unless needed. Output only that line.`
    : `${userName} said in arena chat: "${userText}"\nIf it fits, chime in with one short in-character line on their topic. Skip place/time/peer mentions unless they clearly help. Output only that line.`;

  try {
    const reply = await chatCompletion({
      model,
      signal: ac.signal,
      thinkingEnabled: false,
      messages: [
        {
          role: "system",
          content: buildArenaReplySystem(agent, language, userName),
        },
        {
          role: "user",
          content: withSituationUserMessage(agent.id, userPrompt),
        },
      ],
      onToken: (chunk) => {
        assembled += chunk;
        if (!raf) raf = requestAnimationFrame(flushBubble);
      },
    });

    if (raf) cancelAnimationFrame(raf);
    const text = sanitizeReply((reply || assembled).trim());
    if (text) {
      setAgentSpeech(agent.id, text, speechMsForText(text));
      pushFloatingChatLog({
        agentId: agent.id,
        agentName: agent.displayName,
        color: agent.color,
        text,
        kind: "agent",
      });
    } else {
      setAgentSpeech(agent.id, undefined);
    }
  } catch (e) {
    if (raf) cancelAnimationFrame(raf);
    if ((e as Error).name !== "AbortError") {
      setAgentSpeech(agent.id, undefined);
    }
  } finally {
    if (arenaReplyAborts.get(agent.id) === ac) arenaReplyAborts.delete(agent.id);
    useArenaStore.getState().setChatBusy(agent.id, false);
  }
}
