import { chatCompletion } from "@/lib/ai/providers";
import {
  buildAgentSystemPrompt,
  getArenaWorldContext,
  withSituationUserMessage,
} from "@/lib/ai/arenaContext";
import { appConfig, fillPrompt, prompts, speechMsForText } from "@/lib/config";
import type { AgentConfig, AiModelConfig, ArenaAgent } from "@/lib/types";
import { seatedAgentsAtSpot } from "@/lib/maps/interactions";
import { useArenaStore } from "@/store/arenaStore";

type SocialParticipant = {
  config: AgentConfig;
  runtime: ArenaAgent;
  model: AiModelConfig;
};

export function resolveSocialParticipants(
  spotId: string,
  runtimeAgents: ArenaAgent[],
  agents: AgentConfig[],
  models: AiModelConfig[],
): SocialParticipant[] {
  const configs = new Map(agents.map((agent) => [agent.id, agent]));
  const modelById = new Map(models.map((model) => [model.id, model]));
  return seatedAgentsAtSpot(runtimeAgents, spotId).flatMap((runtime) => {
    const config = configs.get(runtime.id);
    const model = config ? modelById.get(config.modelConfigId) : undefined;
    return config && model ? [{ config, runtime, model }] : [];
  });
}

function sanitizeReply(text: string): string {
  return text
    .replace(/^["'«»‘’“”]+|["'«»‘’“”]+$/g, "")
    .replace(/^\s*(reply|answer|response)\s*:\s*/i, "")
    .trim();
}

/** Final guard for smaller models that ignore the short conversational prompt. */
export function compactSocialReply(
  text: string,
  maxWords = appConfig.social.maxReplyWords,
): string {
  const clean = sanitizeReply(text).replace(/\s+/g, " ");
  const words = clean.split(" ").filter(Boolean);
  if (words.length <= maxWords) return clean;
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;.!?]+$/, "")}…`;
}

/** Ask the agents currently seated together to take one conversational turn each. */
export async function sendSocialSpotChatMessage(
  spotId: string,
  rawText: string,
): Promise<void> {
  const text = rawText.trim();
  if (!text) return;
  await runSocialSpotChat(spotId, text, false);
}

/** Start one bounded conversation round when a new group settles together. */
export async function startAutomaticSocialSpotChat(spotId: string): Promise<void> {
  await runSocialSpotChat(spotId, "", true);
}

async function runSocialSpotChat(
  spotId: string,
  text: string,
  automatic: boolean,
): Promise<void> {
  const initial = useArenaStore.getState();
  const spot = initial.activeMap?.interactionSpots?.find((item) => item.id === spotId);
  if (!spot) return;

  const participants = resolveSocialParticipants(
    spotId,
    initial.runtimeAgents,
    initial.agents,
    initial.models,
  ).filter(({ config }) => !initial.chatBusyById[config.id]);
  if (participants.length < 2) return;

  const userName = initial.userName.trim() || appConfig.defaults.unknownUser;
  if (!automatic) {
    initial.pushFloatingChatLog({
      agentName: userName,
      color: appConfig.chat.userColor,
      text,
      kind: "user",
    });
  }

  const names = participants.map(({ config }) => config.displayName).join(", ");
  const priorReplies: string[] = [];

  // Sequential turns let later agents react to what was just said at the table.
  // A small fixed number of rounds keeps the exchange flowing without creating
  // an unbounded background stream of paid model calls.
  const turns = Array.from(
    { length: Math.max(1, appConfig.social.roundsPerConversation) },
    () => participants,
  ).flat();
  for (const { config: agent, model } of turns) {
    const live = useArenaStore.getState();
    const liveAgent = live.runtimeAgents.find((item) => item.id === agent.id);
    if (
      !liveAgent?.seated ||
      liveAgent.interactionSpotId !== spotId ||
      live.chatBusyById[agent.id]
    ) {
      continue;
    }
    live.setChatBusy(agent.id, true);
    live.setAgentSpeech(agent.id, "…", appConfig.speech.streamingHoldMs);

    let assembled = "";
    let raf = 0;
    const flushBubble = () => {
      raf = 0;
      const partial = sanitizeReply(assembled);
      if (partial) {
        useArenaStore
          .getState()
          .setAgentSpeech(agent.id, partial, appConfig.speech.streamingHoldMs);
      }
    };

    try {
      const userPrompt = fillPrompt(
        automatic ? prompts.user.socialAuto : prompts.user.socialGroup,
        {
        activityName: spot.name,
        participantNames: names,
        userName,
        userText: text,
        priorLines:
          priorReplies.length > 0
            ? priorReplies.slice(-10).join("\n")
            : "No one has replied yet.",
        latestLine:
          priorReplies.length > 0
            ? priorReplies[priorReplies.length - 1]
            : automatic
              ? "No one has spoken yet."
              : `${userName}: ${text}`,
        },
      ).trim();
      const reply = await chatCompletion({
        model,
        thinkingEnabled: false,
        messages: [
          {
            role: "system",
            content: buildAgentSystemPrompt({
              agentPrompt: agent.systemPrompt,
              agentName: agent.displayName,
              skills: agent.skills ?? [],
              world: getArenaWorldContext(agent.id),
              mode: "social_group",
            }),
          },
          {
            role: "user",
            content: withSituationUserMessage(agent.id, userPrompt, "social_group"),
          },
        ],
        onToken: (chunk) => {
          assembled += chunk;
          if (!raf) raf = requestAnimationFrame(flushBubble);
        },
      });
      if (raf) cancelAnimationFrame(raf);
      const finalText = compactSocialReply((reply || assembled).trim());
      if (finalText) {
        priorReplies.push(`${agent.displayName}: ${finalText}`);
        const store = useArenaStore.getState();
        store.setAgentSpeech(agent.id, finalText, speechMsForText(finalText));
        store.pushFloatingChatLog({
          agentId: agent.id,
          agentName: agent.displayName,
          color: agent.color,
          text: finalText,
          kind: "agent",
        });
      }
    } catch {
      if (raf) cancelAnimationFrame(raf);
      useArenaStore.getState().setAgentSpeech(agent.id, undefined);
    } finally {
      useArenaStore.getState().setChatBusy(agent.id, false);
    }
  }
}
