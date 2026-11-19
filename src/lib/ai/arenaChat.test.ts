import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abortArenaReplies,
  clearPendingArenaReplies,
  drainPendingArenaReplies,
  extractMentions,
  resolveArenaTargets,
  stripMentionPossessive,
  trimMentionPunctuation,
  sendArenaChatMessage,
} from "@/lib/ai/arenaChat";
import { resetAiErrorNoticeThrottleForTests } from "@/lib/ai/aiErrorNotice";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

const chatCompletion = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

describe("trimMentionPunctuation", () => {
  it("strips trailing punctuation and keeps internal name chars", () => {
    expect(trimMentionPunctuation("Muse,")).toBe("Muse");
    expect(trimMentionPunctuation("Muse?")).toBe("Muse");
    expect(trimMentionPunctuation("Dr.Who.")).toBe("Dr.Who");
    expect(trimMentionPunctuation("Explorer(copy)")).toBe("Explorer(copy)");
    expect(trimMentionPunctuation("Explorer(copy))")).toBe("Explorer(copy)");
    expect(trimMentionPunctuation("!!")).toBe("");
  });
});

describe("stripMentionPossessive", () => {
  it("strips possessive / case suffixes after an apostrophe", () => {
    expect(stripMentionPossessive("Muse'un")).toBe("Muse");
    expect(stripMentionPossessive("Muse's")).toBe("Muse");
    expect(stripMentionPossessive("Muse’nin")).toBe("Muse");
    expect(stripMentionPossessive("Muse’ın")).toBe("Muse");
    expect(stripMentionPossessive("Explorer'a")).toBe("Explorer");
    expect(stripMentionPossessive("Gülşah'ın")).toBe("Gülşah");
    expect(stripMentionPossessive("İpek'e")).toBe("İpek");
    expect(stripMentionPossessive("O'Brien")).toBe("O");
    expect(stripMentionPossessive("Muse")).toBe("Muse");
    expect(stripMentionPossessive("'s")).toBe("'s");
  });
});

describe("extractMentions", () => {
  it("collects @names", () => {
    expect(extractMentions("hi @Scout and @map-bot")).toEqual(["Scout", "map-bot"]);
    expect(extractMentions("nobody")).toEqual([]);
  });

  it("strips trailing punctuation from mention tokens", () => {
    expect(extractMentions("@Muse,")).toEqual(["Muse"]);
    expect(extractMentions("@Muse?")).toEqual(["Muse"]);
    expect(extractMentions("@Muse.")).toEqual(["Muse"]);
    expect(extractMentions("@Muse!")).toEqual(["Muse"]);
    expect(extractMentions("@Muse:")).toEqual(["Muse"]);
    expect(extractMentions("@Muse;")).toEqual(["Muse"]);
    expect(extractMentions("(@Muse)")).toEqual(["Muse"]);
    expect(extractMentions('"@Muse"')).toEqual(["Muse"]);
    expect(extractMentions("@Muse…")).toEqual(["Muse"]);
    expect(extractMentions("@Muse?!")).toEqual(["Muse"]);
    expect(extractMentions("@Muse。")).toEqual(["Muse"]);
    expect(extractMentions("@Muse，")).toEqual(["Muse"]);
    expect(extractMentions("@Gülşah,")).toEqual(["Gülşah"]);
    expect(extractMentions("@İpek?")).toEqual(["İpek"]);
    expect(extractMentions("@Çağrı.")).toEqual(["Çağrı"]);
    expect(extractMentions("@R2-D2.")).toEqual(["R2-D2"]);
    expect(extractMentions("@Dr.Who.")).toEqual(["Dr.Who"]);
    expect(extractMentions("@map-bot,")).toEqual(["map-bot"]);
    expect(extractMentions("@Explorer(copy2),")).toEqual(["Explorer(copy2)"]);
    expect(extractMentions("@Explorer(copy)")).toEqual(["Explorer(copy)"]);
    expect(extractMentions("@!!")).toEqual([]);
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

  it("matches mentions despite trailing punctuation", () => {
    const roster = [
      sampleAgent({ id: "sch", displayName: "Scholar", modelConfigId: "m1" }),
      sampleAgent({ id: "exp", displayName: "Explorer", modelConfigId: "m1" }),
      sampleAgent({ id: "wow", displayName: "Wow!", modelConfigId: "m1" }),
      sampleAgent({ id: "gul", displayName: "Gülşah", modelConfigId: "m1" }),
      sampleAgent({ id: "ada", displayName: "Ada", modelConfigId: "m1" }),
      sampleAgent({ id: "bo", displayName: "Bo", modelConfigId: "m1" }),
    ];

    const scholar = resolveArenaTargets("Right @Scholar?", roster);
    expect(scholar.mentioned).toBe(true);
    expect(scholar.targets.map((t) => t.id)).toEqual(["sch"]);

    const explorer = resolveArenaTargets("Lead on @Explorer.", roster);
    expect(explorer.mentioned).toBe(true);
    expect(explorer.targets.map((t) => t.id)).toEqual(["exp"]);

    const wow = resolveArenaTargets("@Wow!", roster);
    expect(wow.mentioned).toBe(true);
    expect(wow.targets.map((t) => t.id)).toEqual(["wow"]);

    const turkish = resolveArenaTargets("selam @Gülşah,", roster);
    expect(turkish.mentioned).toBe(true);
    expect(turkish.targets.map((t) => t.id)).toEqual(["gul"]);

    const selfPunct = resolveArenaTargets("@Ada, hi @Bo.", roster, { selfId: "ada" });
    expect(selfPunct.targets.map((t) => t.id)).toEqual(["bo"]);
  });

  it("resolves possessive / case suffixes with exact-name precedence", () => {
    const roster = [
      sampleAgent({ id: "muse", displayName: "Muse", modelConfigId: "m1" }),
      sampleAgent({ id: "exp", displayName: "Explorer", modelConfigId: "m1" }),
      sampleAgent({ id: "gul", displayName: "Gülşah", modelConfigId: "m1" }),
      sampleAgent({ id: "ob", displayName: "O'Brien", modelConfigId: "m1" }),
      sampleAgent({ id: "sch", displayName: "Scholar", modelConfigId: "m1" }),
    ];

    expect(
      resolveArenaTargets("@Muse'un fikri ne?", roster).targets.map((t) => t.id),
    ).toEqual(["muse"]);
    expect(
      resolveArenaTargets("@Muse's idea?", roster).targets.map((t) => t.id),
    ).toEqual(["muse"]);
    expect(
      resolveArenaTargets("@Muse’nin", roster).targets.map((t) => t.id),
    ).toEqual(["muse"]);
    expect(
      resolveArenaTargets("@Explorer'a sor", roster).targets.map((t) => t.id),
    ).toEqual(["exp"]);
    expect(
      resolveArenaTargets("@Gülşah'ın.", roster).targets.map((t) => t.id),
    ).toEqual(["gul"]);
    expect(
      resolveArenaTargets("@Muse'un,", roster).targets.map((t) => t.id),
    ).toEqual(["muse"]);
    expect(
      resolveArenaTargets("@Muse's?", roster).targets.map((t) => t.id),
    ).toEqual(["muse"]);
    expect(
      resolveArenaTargets("(@Explorer'a)", roster).targets.map((t) => t.id),
    ).toEqual(["exp"]);
    expect(
      resolveArenaTargets("@O'Brien,", roster).targets.map((t) => t.id),
    ).toEqual(["ob"]);
    expect(
      resolveArenaTargets("@O'Brien'ın", roster).targets.map((t) => t.id),
    ).toEqual(["ob"]);

    const withMuses = [
      sampleAgent({ id: "muse", displayName: "Muse", modelConfigId: "m1" }),
      sampleAgent({ id: "muses", displayName: "Muse's", modelConfigId: "m1" }),
    ];
    expect(
      resolveArenaTargets("@Muse's", withMuses).targets.map((t) => t.id),
    ).toEqual(["muses"]);
    expect(
      resolveArenaTargets("@Muse'un", withMuses).targets.map((t) => t.id),
    ).toEqual(["muse"]);

    const both = resolveArenaTargets("@Scholar'ın, @Muse'a", roster);
    expect(both.targets.map((t) => t.id).sort()).toEqual(["muse", "sch"]);

    const selfPoss = resolveArenaTargets("@Muse'un hi @Explorer'a", roster, {
      selfId: "muse",
    });
    expect(selfPoss.targets.map((t) => t.id)).toEqual(["exp"]);

    const miss = resolveArenaTargets("@Nobody'nin", roster);
    expect(miss.targets).toHaveLength(0);
    expect(miss.unmatched).toEqual(["Nobody'nin"]);
  });

  it("routes by the user-given name only, never by role/class (#71)", () => {
    const roster = [
      sampleAgent({
        id: "ada",
        displayName: "Ada",
        polyPresetId: "explorer",
        modelConfigId: "m1",
      }),
      sampleAgent({
        id: "bo",
        displayName: "Bo",
        polyPresetId: "engineer",
        modelConfigId: "m1",
      }),
    ];
    const byClass = resolveArenaTargets("@Explorer what do you think?", roster);
    expect(byClass.mentioned).toBe(true);
    expect(byClass.targets).toHaveLength(0);
    expect(byClass.unmatched).toEqual(["Explorer"]);
    expect(resolveArenaTargets("@Engineer, hi", roster).targets).toHaveLength(0);

    for (const text of ["@Ada hi", "@Ada, hi", "@Ada'nın fikri?", "@ada."]) {
      expect(resolveArenaTargets(text, roster).targets.map((t) => t.id)).toEqual([
        "ada",
      ]);
    }
  });
});

describe("sendArenaChatMessage", () => {
  afterEach(() => {
    abortArenaReplies();
    chatCompletion.mockReset();
    resetAiErrorNoticeThrottleForTests();
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

  it("includes temperament in arena broadcast and mention system prompts", async () => {
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      mapId: "office",
      customMaps: [],
      activeMap: null,
      chatterMode: "idle",
      agents: [
        sampleAgent({
          displayName: "Explorer",
          modelConfigId: "model-1",
          temperament: 9,
        }),
      ],
      models: [sampleModel()],
      chatBusyById: {},
      pushFloatingChatLog: vi.fn(),
      setAgentSpeech: vi.fn(),
      setChatBusy: (agentId: string, busy: boolean) => {
        useArenaStore.setState((s) => ({
          chatBusyById: { ...s.chatBusyById, [agentId]: busy },
        }));
      },
    } as never);
    const level9 =
      "Temperament: 9/10 (very combative). Contradict freely, press weak points hard, and rarely back down.";
    chatCompletion.mockResolvedValue("ok");
    await sendArenaChatMessage("hello all");
    await vi.waitFor(() => expect(chatCompletion).toHaveBeenCalled());
    const broadcast = chatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const broadcastSystem =
      broadcast.messages.find((m) => m.role === "system")?.content ?? "";
    expect(broadcastSystem).toContain(level9);
    expect(broadcastSystem).toContain("Even when blunt, stay civil");

    chatCompletion.mockClear();
    chatCompletion.mockResolvedValue("ok");
    await sendArenaChatMessage("@Explorer ping");
    await vi.waitFor(() => expect(chatCompletion).toHaveBeenCalled());
    const mention = chatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const mentionSystem =
      mention.messages.find((m) => m.role === "system")?.content ?? "";
    expect(mentionSystem).toContain(level9);
    expect(mentionSystem).toContain("Even when blunt, stay civil");
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

  it("shows a toast once when chatCompletion rejects", async () => {
    resetAiErrorNoticeThrottleForTests();
    chatCompletion.mockRejectedValue(new Error("TypeError: e is not iterable"));
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = () => {};
    const showToast = vi.fn();
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
      pushFloatingChatLog: vi.fn(),
      setAgentSpeech,
      setChatBusy,
      showToast,
    } as never);
    await sendArenaChatMessage("hello");
    await vi.waitFor(() => expect(showToast).toHaveBeenCalledOnce());
    expect(String(showToast.mock.calls[0]![0])).toContain("Explorer");
    expect(String(showToast.mock.calls[0]![0])).toContain("e is not iterable");
  });
});
