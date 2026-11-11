import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abortArenaReplies,
  clearPendingArenaReplies,
  drainPendingArenaReplies,
  extractMentions,
  resolveArenaTargets,
  sendArenaChatMessage,
} from "@/lib/ai/arenaChat";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

const chatCompletion = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

describe("extractMentions", () => {
  it("collects @names", () => {
    expect(extractMentions("hi @Scout and @map-bot")).toEqual(["Scout", "map-bot"]);
    expect(extractMentions("nobody")).toEqual([]);
  });
});

describe("resolveArenaTargets", () => {
  const agents = [
    sampleAgent({ id: "a", displayName: "Explorer", modelConfigId: "m1" }),
    sampleAgent({ id: "b", displayName: "Chef", modelConfigId: "m1" }),
    sampleAgent({ id: "c", displayName: "Ghost", modelConfigId: "", enabled: true }),
  ];

  it("broadcasts to agents with models when there is no mention", () => {
    const { targets, mentioned } = resolveArenaTargets("hello all", agents);
    expect(mentioned).toBe(false);
    expect(targets.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("matches mentions and reports unmatched names", () => {
    const hit = resolveArenaTargets("hey @expl", agents);
    expect(hit.mentioned).toBe(true);
    expect(hit.targets[0]?.id).toBe("a");
    const miss = resolveArenaTargets("@Nope", agents);
    expect(miss.targets).toHaveLength(0);
    expect(miss.unmatched).toEqual(["Nope"]);
  });

  it("prefers an exact name even when a copy appears earlier", () => {
    const ordered = [
      sampleAgent({ id: "copy", displayName: "Explorer (copy)", modelConfigId: "m1" }),
      sampleAgent({ id: "orig", displayName: "Explorer", modelConfigId: "m1" }),
    ];
    const hit = resolveArenaTargets("@Explorer", ordered);
    expect(hit.targets.map((t) => t.id)).toEqual(["orig"]);
  });

  it("resolves @Explorer(copy) and @Explorer(copy2) distinctly", () => {
    const ordered = [
      sampleAgent({ id: "orig", displayName: "Explorer", modelConfigId: "m1" }),
      sampleAgent({ id: "c1", displayName: "Explorer (copy)", modelConfigId: "m1" }),
      sampleAgent({ id: "c2", displayName: "Explorer (copy 2)", modelConfigId: "m1" }),
    ];
    expect(resolveArenaTargets("@Explorer(copy)", ordered).targets[0]?.id).toBe("c1");
    expect(resolveArenaTargets("@Explorer(copy2)", ordered).targets[0]?.id).toBe("c2");
  });

  it("excludes selfId including a prefix match on oneself", () => {
    const agents = [
      sampleAgent({ id: "ada", displayName: "Ada", modelConfigId: "m1" }),
      sampleAgent({ id: "bo", displayName: "Bo", modelConfigId: "m1" }),
    ];
    const hit = resolveArenaTargets("@Ada hi @Bo", agents, { selfId: "ada" });
    expect(hit.targets.map((t) => t.id)).toEqual(["bo"]);
    const prefix = resolveArenaTargets("@Ad", agents, { selfId: "ada" });
    expect(prefix.targets).toHaveLength(0);
    expect(prefix.unmatched).toEqual(["Ad"]);
  });
});

describe("sendArenaChatMessage", () => {
  afterEach(() => {
    abortArenaReplies();
    chatCompletion.mockReset();
  });

  it("ignores blank input", async () => {
    await sendArenaChatMessage("   ");
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("posts a system note when a mention matches nobody", async () => {
    const push = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      agents: [sampleAgent({ displayName: "Explorer", modelConfigId: "model-1" })],
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog: push,
    } as never);
    await sendArenaChatMessage("@Nobody hi");
    expect(push).toHaveBeenCalled();
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("posts a system note when nobody has a model", async () => {
    const push = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      agents: [sampleAgent({ modelConfigId: "" })],
      models: [],
      chatBusyById: {},
      pushFloatingChatLog: push,
    } as never);
    await sendArenaChatMessage("hello everyone");
    expect(push).toHaveBeenCalledTimes(2);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("queues a busy agent and drains after setChatBusy(false); latest wins", async () => {
    const push = vi.fn();
    const setAgentSpeech = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: "office",
      customMaps: [],
      activeMap: null,
      chatterMode: "idle",
      agents: [sampleAgent({ displayName: "Explorer", modelConfigId: "model-1" })],
      models: [sampleModel()],
      chatBusyById: { "agent-1": true },
      pushFloatingChatLog: push,
      setAgentSpeech,
      setChatBusy: (agentId: string, busy: boolean) => {
        useArenaStore.setState((s) => ({
          chatBusyById: { ...s.chatBusyById, [agentId]: busy },
        }));
      },
    } as never);
    await sendArenaChatMessage("first");
    await sendArenaChatMessage("second-latest");
    expect(chatCompletion).not.toHaveBeenCalled();

    useArenaStore.setState({ chatBusyById: {} } as never);
    chatCompletion.mockResolvedValue("queued reply");
    drainPendingArenaReplies();
    await vi.waitFor(() => expect(chatCompletion).toHaveBeenCalledTimes(1));
    const req = chatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ content: string }>;
    };
    expect(JSON.stringify(req.messages)).toContain("second-latest");

    chatCompletion.mockResolvedValue("   ");
    await sendArenaChatMessage("@Explorer hi");
    expect(setAgentSpeech).toHaveBeenCalled();

    chatCompletion.mockImplementation(async (req2: { onToken?: (c: string) => void }) => {
      req2.onToken?.("Hey");
      return "Hey";
    });
    await sendArenaChatMessage("hello");

    chatCompletion.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await sendArenaChatMessage("hello");
    chatCompletion.mockRejectedValue(new Error("down"));
    await sendArenaChatMessage("hello");
  });

  it("clears queued arena replies while conversation mode is on", async () => {
    const push = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: "office",
      customMaps: [],
      activeMap: null,
      chatterMode: "idle",
      agents: [sampleAgent({ displayName: "Explorer", modelConfigId: "model-1" })],
      models: [sampleModel()],
      chatBusyById: { "agent-1": true },
      pushFloatingChatLog: push,
      setAgentSpeech: vi.fn(),
      setChatBusy: vi.fn(),
    } as never);
    await sendArenaChatMessage("queued while idle");
    expect(chatCompletion).not.toHaveBeenCalled();

    useArenaStore.setState({ chatterMode: "conversation", chatBusyById: {} } as never);
    drainPendingArenaReplies();
    expect(chatCompletion).not.toHaveBeenCalled();

    // Explicit clear is a no-op once drained/cleared.
    clearPendingArenaReplies();
    useArenaStore.setState({ chatterMode: "idle" } as never);
    drainPendingArenaReplies();
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("seeds conversation mode without parallel calls", async () => {
    const push = vi.fn();
    const seedConversation = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      chatterMode: "conversation",
      agents: [
        sampleAgent({ id: "ada", displayName: "Ada", modelConfigId: "model-1" }),
        sampleAgent({ id: "bo", displayName: "Bo", modelConfigId: "model-1" }),
      ],
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog: push,
      seedConversation,
    } as never);
    await sendArenaChatMessage("@Bo hi");
    expect(seedConversation).toHaveBeenCalledWith(["bo"]);
    expect(chatCompletion).not.toHaveBeenCalled();

    seedConversation.mockClear();
    await sendArenaChatMessage("hello everyone");
    expect(seedConversation).toHaveBeenCalledWith([]);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("asks matching agents for a reply", async () => {
    chatCompletion.mockResolvedValue("Hello back");
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = () => {};
    const push = vi.fn();
    const setAgentSpeech = vi.fn();
    const setChatBusy = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: "office",
      customMaps: [],
      activeMap: null,
      chatterMode: "off",
      agents: [sampleAgent({ displayName: "Explorer", modelConfigId: "model-1" })],
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog: push,
      setAgentSpeech,
      setChatBusy,
    } as never);
    await sendArenaChatMessage("hello");
    expect(chatCompletion).toHaveBeenCalled();
    expect(setAgentSpeech).toHaveBeenCalled();
  });
});
