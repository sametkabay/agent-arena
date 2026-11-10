import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConversationRuntime,
  disposeConversationRuntime,
  tickConversation,
} from "@/lib/ai/conversationLoop";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";
import { appConfig, prompts } from "@/lib/config";

const chatCompletion = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

const START = 20_000;

function seedStore(partial: Record<string, unknown> = {}) {
  useArenaStore.setState({
    mapEditorOpen: false,
    settingsOpen: false,
    chatterMode: "conversation",
    chatBusyById: {},
    conversationSeed: { seq: 0, mentionIds: [] },
    conversationStatus: "inactive",
    arenaChatHistory: [],
    floatingChatLog: [],
    agents: [
      sampleAgent({
        id: "ada",
        displayName: "Ada",
        chattiness: 50,
        modelConfigId: "model-1",
      }),
      sampleAgent({
        id: "bo",
        displayName: "Bo",
        chattiness: 50,
        modelConfigId: "model-1",
      }),
    ],
    models: [sampleModel()],
    activeMap: null,
    customMaps: [],
    mapId: "office",
    userName: "Samet",
    language: "en",
    dayNight: "day",
    setChatBusy: (agentId: string, busy: boolean) => {
      useArenaStore.setState((s) => ({
        chatBusyById: { ...s.chatBusyById, [agentId]: busy },
      }));
    },
    setAgentSpeech: vi.fn(),
    pushFloatingChatLog: (entry: {
      agentId?: string;
      agentName: string;
      color: string;
      text: string;
      kind?: string;
    }) => {
      useArenaStore.setState((s) => {
        const line = {
          id: `flog_${s.arenaChatHistory.length}`,
          agentId: entry.agentId,
          agentName: entry.agentName,
          color: entry.color,
          text: entry.text,
          createdAt: Date.now(),
          kind: (entry.kind ?? "agent") as "user" | "agent" | "system",
        };
        return {
          arenaChatHistory: [...s.arenaChatHistory, line],
          floatingChatLog: [...s.floatingChatLog, line],
        };
      });
    },
    setConversationStatus: (status: string) => {
      useArenaStore.setState({ conversationStatus: status as never });
    },
    seedConversation: (mentionIds: string[]) => {
      useArenaStore.setState((s) => ({
        conversationSeed: {
          seq: s.conversationSeed.seq + 1,
          mentionIds: [...mentionIds],
        },
      }));
    },
    ...partial,
  });
}

/** Init runtime then advance past firstTurnDelay so a turn can start. */
function armReady(rt: ReturnType<typeof createConversationRuntime>): void {
  tickConversation(rt);
  vi.setSystemTime(Date.now() + appConfig.conversation.firstTurnDelayMs);
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** After a human seed apply, wait the reply delay and tick again. */
function afterHumanSeed(): void {
  vi.setSystemTime(Date.now() + appConfig.conversation.humanReplyDelayMs);
  // The apply already happened; advance so the gap clears, then tick.
}

describe("tickConversation", () => {
  beforeEach(() => {
    chatCompletion.mockReset();
    chatCompletion.mockResolvedValue("Hello there");
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = () => {};
    vi.useFakeTimers();
    vi.setSystemTime(START);
    seedStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps only one completion in flight across ticks", async () => {
    let resolveFirst!: (v: string) => void;
    chatCompletion.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const rt = createConversationRuntime();
    armReady(rt);
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    tickConversation(rt);
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    resolveFirst("first");
    await Promise.resolve();
    disposeConversationRuntime(rt);
  });

  it("pauses on settings / map editor / hidden and aborts inflight", async () => {
    const makeHanging = () => {
      let signal: AbortSignal | undefined;
      chatCompletion.mockImplementation(
        (req: { signal?: AbortSignal }) =>
          new Promise<string>((_resolve, reject) => {
            signal = req.signal;
            req.signal?.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      );
      return () => signal;
    };

    const rt = createConversationRuntime();

    // Settings pause aborts the in-flight request.
    let getSignal = makeHanging();
    armReady(rt);
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    useArenaStore.setState({ settingsOpen: true });
    tickConversation(rt);
    expect(getSignal()?.aborted).toBe(true);
    expect(useArenaStore.getState().conversationStatus).toBe("paused");
    await flushMicrotasks();

    // Map editor: reset to running, start a new turn, then pause+abort.
    useArenaStore.setState({ settingsOpen: false, mapEditorOpen: false });
    vi.setSystemTime(Date.now() + appConfig.conversation.minGapMs);
    getSignal = makeHanging();
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    useArenaStore.setState({ mapEditorOpen: true });
    tickConversation(rt);
    expect(getSignal()?.aborted).toBe(true);
    expect(useArenaStore.getState().conversationStatus).toBe("paused");
    await flushMicrotasks();

    // Hidden tab: same pattern.
    useArenaStore.setState({ mapEditorOpen: false });
    vi.setSystemTime(Date.now() + appConfig.conversation.minGapMs);
    getSignal = makeHanging();
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(3);
    const previous = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { visibilityState: "hidden" },
    });
    tickConversation(rt);
    expect(getSignal()?.aborted).toBe(true);
    expect(useArenaStore.getState().conversationStatus).toBe("paused");
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previous,
    });
    disposeConversationRuntime(rt);
  });

  it("aborts and resets when leaving conversation mode", async () => {
    let signal: AbortSignal | undefined;
    chatCompletion.mockImplementation(
      (req: { signal?: AbortSignal }) =>
        new Promise<string>((_resolve, reject) => {
          signal = req.signal;
          req.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );
    const rt = createConversationRuntime();
    armReady(rt);
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    useArenaStore.setState({ chatterMode: "off" });
    tickConversation(rt);
    expect(signal?.aborted).toBe(true);
    expect(useArenaStore.getState().conversationStatus).toBe("inactive");
    expect(rt.state).toBeNull();
    disposeConversationRuntime(rt);
  });

  it("lets a new seed abort the agent turn and re-plan", async () => {
    let signal: AbortSignal | undefined;
    chatCompletion
      .mockImplementationOnce(
        (req: { signal?: AbortSignal }) =>
          new Promise<string>((_resolve, reject) => {
            signal = req.signal;
            req.signal?.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      )
      .mockResolvedValueOnce("Bo here");
    const rt = createConversationRuntime();
    armReady(rt);
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    useArenaStore.getState().seedConversation(["bo"]);
    // Apply seed (abort + replan delay).
    tickConversation(rt);
    expect(signal?.aborted).toBe(true);
    await flushMicrotasks();
    afterHumanSeed();
    tickConversation(rt);
    await flushMicrotasks();
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    const second = chatCompletion.mock.calls[1]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const system = second.messages.find((m) => m.role === "system")?.content ?? "";
    expect(system).toContain("You are Bo");
    disposeConversationRuntime(rt);
  });

  it("routes the next speaker from an @mention and ignores self", async () => {
    chatCompletion
      .mockResolvedValueOnce("Hey @Bo what about you, @Ada?")
      .mockResolvedValueOnce("Bo answers");
    const rt = createConversationRuntime();
    armReady(rt);
    // Force Ada to speak first so her self-@mention is stripped.
    useArenaStore.getState().seedConversation(["ada"]);
    tickConversation(rt);
    afterHumanSeed();
    tickConversation(rt);
    await flushMicrotasks();
    expect(rt.state?.lastSpeakerId).toBe("ada");
    expect(rt.state?.priorityQueue).toEqual(["bo"]);

    vi.setSystemTime(Date.now() + appConfig.conversation.minGapMs);
    tickConversation(rt);
    await flushMicrotasks();
    expect(rt.state?.lastSpeakerId).toBe("bo");
    disposeConversationRuntime(rt);
  });

  it("does not enqueue every agent on a no-mention reply (no starvation)", async () => {
    seedStore({
      agents: [
        sampleAgent({
          id: "ada",
          displayName: "Ada",
          chattiness: 50,
          modelConfigId: "model-1",
        }),
        sampleAgent({
          id: "bo",
          displayName: "Bo",
          chattiness: 50,
          modelConfigId: "model-1",
        }),
        sampleAgent({
          id: "cy",
          displayName: "Cy",
          chattiness: 50,
          modelConfigId: "model-1",
        }),
      ],
    });
    chatCompletion.mockResolvedValue("Just chatting, no mentions");
    const rt = createConversationRuntime();
    armReady(rt);
    useArenaStore.getState().seedConversation(["ada"]);
    tickConversation(rt);
    afterHumanSeed();
    tickConversation(rt);
    await flushMicrotasks();
    expect(rt.state?.lastSpeakerId).toBe("ada");
    expect(rt.state?.priorityQueue).toEqual([]);
    disposeConversationRuntime(rt);
  });

  it("lets a chattiness-0 mentioned agent take the priority turn", async () => {
    seedStore({
      agents: [
        sampleAgent({
          id: "ada",
          displayName: "Ada",
          chattiness: 50,
          modelConfigId: "model-1",
        }),
        sampleAgent({
          id: "zed",
          displayName: "Zed",
          chattiness: 0,
          modelConfigId: "model-1",
          systemPrompt: "You are Zed.",
        }),
      ],
    });
    chatCompletion.mockResolvedValue("Zed here");
    const rt = createConversationRuntime();
    armReady(rt);
    useArenaStore.getState().seedConversation(["zed"]);
    tickConversation(rt);
    afterHumanSeed();
    tickConversation(rt);
    await flushMicrotasks();
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    const req = chatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(req.messages.find((m) => m.role === "system")?.content ?? "").toContain(
      "You are Zed",
    );
    expect(rt.state?.lastSpeakerId).toBe("zed");
    disposeConversationRuntime(rt);
  });

  it("moves status to waitingForHuman after the budget", async () => {
    const rt = createConversationRuntime();
    armReady(rt);
    for (let i = 0; i < appConfig.conversation.maxAgentTurns; i++) {
      chatCompletion.mockResolvedValueOnce(`line ${i}`);
      tickConversation(rt);
      await flushMicrotasks();
      vi.setSystemTime(Date.now() + appConfig.conversation.minGapMs);
    }
    expect(chatCompletion).toHaveBeenCalledTimes(appConfig.conversation.maxAgentTurns);
    tickConversation(rt);
    expect(useArenaStore.getState().conversationStatus).toBe("waitingForHuman");
    // Extra ticks past the gap must not start more calls.
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(Date.now() + appConfig.conversation.minGapMs);
      tickConversation(rt);
      await flushMicrotasks();
    }
    expect(chatCompletion).toHaveBeenCalledTimes(appConfig.conversation.maxAgentTurns);
    disposeConversationRuntime(rt);
  });

  it("clears the speech bubble when a turn resolves after abort", async () => {
    let resolveTurn!: (v: string) => void;
    chatCompletion.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTurn = resolve;
        }),
    );
    const setAgentSpeech = vi.fn();
    seedStore({ setAgentSpeech });
    const rt = createConversationRuntime();
    armReady(rt);
    useArenaStore.getState().seedConversation(["ada"]);
    tickConversation(rt);
    afterHumanSeed();
    tickConversation(rt);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    const speaker = rt.state?.inflightAgentId;
    expect(speaker).toBe("ada");
    rt.abort?.abort();
    rt.abort = null;
    resolveTurn("late reply");
    await flushMicrotasks();
    expect(setAgentSpeech).toHaveBeenCalledWith("ada", undefined);
    expect(useArenaStore.getState().arenaChatHistory.some((l) => l.text === "late reply")).toBe(
      false,
    );
    disposeConversationRuntime(rt);
  });

  it("includes conversation discipline and recent_arena in prompts", async () => {
    chatCompletion.mockResolvedValue("ok");
    useArenaStore.setState({
      arenaChatHistory: [
        {
          id: "1",
          agentName: "Samet",
          color: "#fff",
          text: "hello team",
          createdAt: 1,
          kind: "user" as const,
        },
      ],
    });
    const rt = createConversationRuntime();
    armReady(rt);
    tickConversation(rt);
    await flushMicrotasks();
    expect(chatCompletion).toHaveBeenCalled();
    const req = chatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(system).toContain(
      prompts.session.speechDisciplineConversation.trim().slice(0, 24),
    );
    expect(user).toContain("<recent_arena>");
    disposeConversationRuntime(rt);
  });
});
