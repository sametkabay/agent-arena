import { chatCompletion } from "@/lib/ai/providers";
import {
  buildAgentSystemPrompt,
  getArenaWorldContext,
  withSituationUserMessage,
} from "@/lib/ai/arenaContext";
import type { AgentConfig, AiModelConfig } from "@/lib/types";
import i18n from "@/i18n";
import { useArenaStore } from "@/store/arenaStore";
import { appConfig, fillPrompt, prompts, speechMsForText } from "@/lib/config";

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
  mentioned: boolean,
): string {
  return buildAgentSystemPrompt({
    agentPrompt: agent.systemPrompt,
    agentName: agent.displayName,
    skills: agent.skills ?? [],
    world: getArenaWorldContext(agent.id),
    mode: mentioned ? "arena_mention" : "arena_broadcast",
  });
}

function sanitizeReply(text: string): string {
  return text
    .replace(/^["'«»‘’“”]+|["'«»‘’“”]+$/g, "")
    .replace(/^\s*(reply|answer|response)\s*:\s*/i, "")
    .trim();
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
  const userName = store.userName.trim() || appConfig.defaults.unknownUser;
  const { targets, mentioned, unmatched } = resolveArenaTargets(text, store.agents);

  store.pushFloatingChatLog({
    agentName: userName,
    color: appConfig.chat.userColor,
    text,
    kind: "user",
  });

  if (mentioned && targets.length === 0) {
    store.pushFloatingChatLog({
      agentName: appConfig.chat.systemName,
      color: appConfig.chat.systemColor,
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
      agentName: appConfig.chat.systemName,
      color: appConfig.chat.systemColor,
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

  const { setAgentSpeech, pushFloatingChatLog } = useArenaStore.getState();
  let assembled = "";
  let raf = 0;

  const flushBubble = () => {
    raf = 0;
    if (!assembled.trim()) return;
    setAgentSpeech(agent.id, sanitizeReply(assembled) || "…", appConfig.speech.streamingHoldMs);
  };

  const channel = wasMentioned ? "arena_mention" : "arena_broadcast";
  const userPrompt = fillPrompt(
    wasMentioned ? prompts.user.arenaMention : prompts.user.arenaBroadcast,
    { userName, userText },
  ).trim();

  try {
    const reply = await chatCompletion({
      model,
      signal: ac.signal,
      thinkingEnabled: false,
      messages: [
        {
          role: "system",
          content: buildArenaReplySystem(agent, wasMentioned),
        },
        {
          role: "user",
          content: withSituationUserMessage(agent.id, userPrompt, channel),
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
