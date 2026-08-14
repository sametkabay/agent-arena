import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abortArenaReplies,
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

  it("skips a busy private chat and handles empty or failed replies", async () => {
    const push = vi.fn();
    const setAgentSpeech = vi.fn();
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: "office",
      customMaps: [],
      activeMap: null,
      agents: [sampleAgent({ displayName: "Explorer", modelConfigId: "model-1" })],
      models: [sampleModel()],
      chatBusyById: { "agent-1": true },
      pushFloatingChatLog: push,
      setAgentSpeech,
      setChatBusy: vi.fn(),
    } as never);
    await sendArenaChatMessage("hello");
    expect(chatCompletion).not.toHaveBeenCalled();

    useArenaStore.setState({ chatBusyById: {} } as never);
    chatCompletion.mockResolvedValue("   ");
    await sendArenaChatMessage("@Explorer hi");
    expect(setAgentSpeech).toHaveBeenCalled();

    chatCompletion.mockImplementation(async (req: { onToken?: (c: string) => void }) => {
      req.onToken?.("Hey");
      return "Hey";
    });
    await sendArenaChatMessage("hello");

    chatCompletion.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await sendArenaChatMessage("hello");
    chatCompletion.mockRejectedValue(new Error("down"));
    await sendArenaChatMessage("hello");
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
