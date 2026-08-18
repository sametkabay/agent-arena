import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactSocialReply,
  resolveSocialParticipants,
  sendSocialSpotChatMessage,
  startAutomaticSocialSpotChat,
} from "@/lib/ai/socialChat";
import { placeAgentsOnMap } from "@/lib/maps/runtime";
import { sampleAgent, sampleMap, sampleModel } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

const chatCompletion = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

const interactionSpot = {
  id: "table",
  name: "Table",
  kind: "table_chat" as const,
  position: [0, 0, 0] as [number, number, number],
  seats: [
    { id: "seat_a", position: [-1, 0, 0] as [number, number, number], rotationY: 1 },
    { id: "seat_b", position: [1, 0, 0] as [number, number, number], rotationY: -1 },
  ],
};

function seatedRuntime() {
  const configs = [
    sampleAgent({ id: "a", displayName: "Ada", modelConfigId: "model-1" }),
    sampleAgent({ id: "b", displayName: "Ben", modelConfigId: "model-1" }),
  ];
  const map = sampleMap({ interactionSpots: [interactionSpot] });
  const runtime = placeAgentsOnMap(configs, map).map((agent, index) => ({
    ...agent,
    interactionSpotId: "table",
    interactionSeatId: interactionSpot.seats[index]!.id,
    seated: true,
    state: "sitting" as const,
  }));
  return { configs, map, runtime };
}

describe("social group participants", () => {
  beforeEach(() => {
    chatCompletion.mockReset();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = () => {};
  });

  it("includes only seated agents whose configured model exists", () => {
    const configs = [
      sampleAgent({ id: "a", modelConfigId: "model-1" }),
      sampleAgent({ id: "b", modelConfigId: "missing" }),
      sampleAgent({ id: "c", modelConfigId: "model-1" }),
    ];
    const runtime = placeAgentsOnMap(configs, sampleMap()).map((agent) => ({
      ...agent,
      interactionSpotId: "table",
      interactionSeatId: `seat_${agent.id}`,
      seated: agent.id !== "c",
    }));
    expect(
      resolveSocialParticipants("table", runtime, configs, [sampleModel()]).map(
        ({ config }) => config.id,
      ),
    ).toEqual(["a"]);
  });

  it("keeps group replies brief even when a model ignores the limit", () => {
    expect(compactSocialReply('"Sounds good to me"')).toBe("Sounds good to me");
    expect(
      compactSocialReply(
        "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen",
      ),
    ).toBe(
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen…",
    );
  });

  it("ignores blank, missing, and undersized conversations", async () => {
    const { configs, map, runtime } = seatedRuntime();
    useArenaStore.setState({
      activeMap: map,
      runtimeAgents: runtime,
      agents: configs,
      models: [sampleModel()],
      chatBusyById: {},
    } as never);
    await sendSocialSpotChatMessage("table", "   ");
    await sendSocialSpotChatMessage("missing", "Hello");
    useArenaStore.setState({ runtimeAgents: runtime.slice(0, 1) } as never);
    await sendSocialSpotChatMessage("table", "Hello");
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("runs sequential group turns and publishes the replies", async () => {
    const { configs, map, runtime } = seatedRuntime();
    const pushFloatingChatLog = vi.fn();
    const setAgentSpeech = vi.fn();
    const setChatBusy = vi.fn();
    chatCompletion
      .mockImplementationOnce(async (request: { onToken?: (text: string) => void }) => {
        request.onToken?.("Hello from Ada");
        return '"Hello from Ada"';
      })
      .mockResolvedValue("Reply from the table");
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: map.id,
      customMaps: [],
      activeMap: map,
      runtimeAgents: runtime,
      agents: configs,
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog,
      setAgentSpeech,
      setChatBusy,
    } as never);

    await sendSocialSpotChatMessage("table", "What should we build?");

    expect(chatCompletion).toHaveBeenCalledTimes(4);
    expect(pushFloatingChatLog).toHaveBeenCalledTimes(5);
    expect(setAgentSpeech).toHaveBeenCalled();
    expect(setChatBusy).toHaveBeenCalledWith("a", true);
    expect(setChatBusy).toHaveBeenCalledWith("b", false);
  });

  it("starts a spontaneous round without attributing it to the user", async () => {
    const { configs, map, runtime } = seatedRuntime();
    const pushFloatingChatLog = vi.fn();
    chatCompletion.mockResolvedValue("A casual hello");
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: map.id,
      customMaps: [],
      activeMap: map,
      runtimeAgents: runtime,
      agents: configs,
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog,
      setAgentSpeech: vi.fn(),
      setChatBusy: vi.fn(),
    } as never);

    await startAutomaticSocialSpotChat("table");

    expect(chatCompletion).toHaveBeenCalledTimes(4);
    expect(pushFloatingChatLog).toHaveBeenCalledTimes(4);
    expect(pushFloatingChatLog.mock.calls[0]?.[0]).toMatchObject({ kind: "agent" });
    const firstRequest = chatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ content: string }>;
    };
    expect(firstRequest.messages[1]?.content).toContain(
      "casual face-to-face conversation",
    );
  });

  it("continues the round when one participant fails", async () => {
    const { configs, map, runtime } = seatedRuntime();
    const setAgentSpeech = vi.fn();
    chatCompletion
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("Still here");
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: map.id,
      customMaps: [],
      activeMap: map,
      runtimeAgents: runtime,
      agents: configs,
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog: vi.fn(),
      setAgentSpeech,
      setChatBusy: vi.fn(),
    } as never);

    await sendSocialSpotChatMessage("table", "Hello");

    expect(chatCompletion).toHaveBeenCalledTimes(4);
    expect(setAgentSpeech).toHaveBeenCalledWith("a", undefined);
  });
});
