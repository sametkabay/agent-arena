import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatCompletion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/providers", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

import * as arenaChat from "@/lib/ai/arenaChat";
import { blankMap } from "@/lib/maps/schema";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";
import { STORAGE_KEY, loadPersisted } from "@/lib/storage";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import i18n from "@/i18n";
import {
  isArenaChatPersistPending,
  resetPersistToastThrottle,
  useArenaStore,
} from "@/store/arenaStore";
import {
  abortLiveChatterRuntimes,
  createChatterRuntime,
  disposeChatterRuntime,
  tickAgentChatter,
} from "@/lib/ai/chatter";

function seedPlayground() {
  const custom = blankMap({
    id: "custom_reset_store",
    name: "Reset Custom",
    floor: { size: 22, style: "surface", color: "#222", surface: "office" },
  });
  const model = sampleModel({
    id: "model-reset",
    apiKey: "sk-test-FAKE-0001",
  });
  const agent = sampleAgent({
    id: "agent-reset",
    modelConfigId: model.id,
  });

  useArenaStore.setState({
    ...useArenaStore.getState(),
    userName: "Samet",
    language: "tr",
    dayNight: "night",
    chatterMode: "idle",
    onboardingSeen: true,
    controlsHelpSeen: true,
    models: [model],
    agents: [agent],
    customMaps: [custom],
    mapId: custom.id,
    graphics: {
      ...DEFAULT_GRAPHICS,
      castShadows: false,
      shadowQuality: "high",
      maxDpr: 3,
    },
    favoriteAssets: ["desk"],
    chats: {
      "agent-reset": [{ role: "user", content: "hi" }],
    },
    arenaChatHistory: [
      {
        id: "flog_reset",
        agentName: "Explorer",
        color: "#fff",
        text: "yo",
        createdAt: 1,
        kind: "agent",
      },
    ],
    runtimeAgents: [
      {
        id: agent.id,
        displayName: agent.displayName,
        modelConfigId: agent.modelConfigId,
        polyPresetId: agent.polyPresetId,
        characterId: agent.characterId,
        systemPrompt: agent.systemPrompt,
        color: agent.color,
        bio: agent.bio,
        position: [1, 0, 1],
        rotationY: 0,
        homePosition: [1, 0, 1],
        state: "idle",
        thinkingIntensity: 0,
        moveSpeed: 1.2,
      },
    ],
    selectedAgentId: agent.id,
    chatOpen: true,
    chatBusyById: { "agent-reset": true },
    floatingChatLog: [
      {
        id: "float_1",
        agentName: "Explorer",
        color: "#fff",
        text: "bubble",
        createdAt: 2,
        kind: "agent",
      },
    ],
    mapEditorOpen: true,
    mapEditorSourceId: custom.id,
    settingsFocusAgentId: agent.id,
    settingsFocusExport: "agents",
    conversationSeed: { seq: 3, mentionIds: ["agent-reset"] },
    conversationStatus: "running",
    resetSeq: 0,
    toast: null,
  });
  useArenaStore.getState().applyMapAndAgents();
  useArenaStore.getState().persist();
  return { custom, model, agent };
}

beforeEach(async () => {
  localStorage.clear();
  resetPersistToastThrottle();
  chatCompletion.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  await i18n.changeLanguage("en");
  seedPlayground();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
  vi.restoreAllMocks();
  resetPersistToastThrottle();
});

describe("arenaStore.resetPlayground", () => {
  it("clears playground state and storage on success", () => {
    const abortSpy = vi.spyOn(arenaChat, "abortArenaReplies");
    const clearSpy = vi.spyOn(arenaChat, "clearPendingArenaReplies");
    const beforeSeq = useArenaStore.getState().resetSeq;

    const result = useArenaStore.getState().resetPlayground({ keepModels: false });
    expect(result).toEqual({ ok: true });

    const s = useArenaStore.getState();
    expect(s.userName).toBe("Samet");
    expect(s.language).toBe("tr");
    expect(s.dayNight).toBe("night");
    expect(s.chatterMode).toBe("idle");
    expect(s.onboardingSeen).toBe(true);
    expect(s.controlsHelpSeen).toBe(true);
    expect(s.models).toEqual([]);
    expect(s.agents).toEqual([]);
    expect(s.customMaps).toEqual([]);
    expect(s.mapId).toBe(appConfig.defaults.mapId);
    expect(s.graphics).toEqual({ ...DEFAULT_GRAPHICS });
    expect(s.favoriteAssets).toEqual([]);
    expect(s.chats).toEqual({});
    expect(s.arenaChatHistory).toEqual([]);
    expect(s.runtimeAgents).toEqual([]);
    expect(s.selectedAgentId).toBeNull();
    expect(s.chatOpen).toBe(false);
    expect(s.chatBusyById).toEqual({});
    expect(s.floatingChatLog).toEqual([]);
    expect(s.mapEditorOpen).toBe(false);
    expect(s.mapEditorSourceId).toBeNull();
    expect(s.settingsFocusAgentId).toBeNull();
    expect(s.settingsFocusExport).toBeNull();
    expect(s.conversationSeed).toEqual({ seq: 0, mentionIds: [] });
    expect(s.conversationStatus).toBe("inactive");
    expect(s.resetSeq).toBe(beforeSeq + 1);
    expect(abortSpy).toHaveBeenCalledOnce();
    expect(clearSpy).toHaveBeenCalledOnce();

    const persisted = loadPersisted();
    expect(persisted.models).toEqual([]);
    expect(persisted.agents).toEqual([]);
    expect(persisted.customMaps).toEqual([]);
    expect(persisted.mapId).toBe(appConfig.defaults.mapId);
    expect(persisted.userName).toBe("Samet");
    expect(persisted.language).toBe("tr");
    expect(persisted.dayNight).toBe("night");
  });

  it("keeps models and api keys when keepModels is on", () => {
    const result = useArenaStore.getState().resetPlayground({ keepModels: true });
    expect(result.ok).toBe(true);
    const s = useArenaStore.getState();
    expect(s.models).toHaveLength(1);
    expect(s.models[0]?.apiKey).toBe("sk-test-FAKE-0001");
    expect(s.agents).toEqual([]);
    expect(s.customMaps).toEqual([]);
    expect(s.chats).toEqual({});
    expect(loadPersisted().models[0]?.apiKey).toBe("sk-test-FAKE-0001");
  });

  it("rolls back state and storage on quota failure", () => {
    const s0 = useArenaStore.getState();
    const beforeState = {
      agents: structuredClone(s0.agents),
      models: structuredClone(s0.models),
      customMaps: structuredClone(s0.customMaps),
      mapId: s0.mapId,
      runtimeAgents: structuredClone(s0.runtimeAgents),
      selectedAgentId: s0.selectedAgentId,
      chatOpen: s0.chatOpen,
      chatBusyById: structuredClone(s0.chatBusyById),
      floatingChatLog: structuredClone(s0.floatingChatLog),
      mapEditorOpen: s0.mapEditorOpen,
      conversationSeed: structuredClone(s0.conversationSeed),
      chats: structuredClone(s0.chats),
      arenaChatHistory: structuredClone(s0.arenaChatHistory),
    };
    const beforeStorage = localStorage.getItem(STORAGE_KEY);
    const beforeSeq = s0.resetSeq;

    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError",
      );
    });
    const abortSpy = vi.spyOn(arenaChat, "abortArenaReplies");

    const result = useArenaStore.getState().resetPlayground({ keepModels: false });
    spy.mockRestore();

    expect(result).toEqual({ ok: false, reason: "quota" });
    expect(abortSpy).not.toHaveBeenCalled();
    expect(useArenaStore.getState().resetSeq).toBe(beforeSeq);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeStorage);

    const after = useArenaStore.getState();
    expect(after.agents).toEqual(beforeState.agents);
    expect(after.models).toEqual(beforeState.models);
    expect(after.customMaps).toEqual(beforeState.customMaps);
    expect(after.mapId).toBe(beforeState.mapId);
    expect(after.runtimeAgents).toEqual(beforeState.runtimeAgents);
    expect(after.selectedAgentId).toBe(beforeState.selectedAgentId);
    expect(after.chatOpen).toBe(beforeState.chatOpen);
    expect(after.chatBusyById).toEqual(beforeState.chatBusyById);
    expect(after.floatingChatLog).toEqual(beforeState.floatingChatLog);
    expect(after.mapEditorOpen).toBe(beforeState.mapEditorOpen);
    expect(after.conversationSeed).toEqual(beforeState.conversationSeed);
    expect(after.chats).toEqual(beforeState.chats);
    expect(after.arenaChatHistory).toEqual(beforeState.arenaChatHistory);
    expect(after.toast).toBe(i18n.t("storage.quotaExceeded"));
  });

  it("ignores late chat writes for removed agents", () => {
    useArenaStore.getState().resetPlayground({ keepModels: false });
    useArenaStore.getState().replaceLastAssistant("agent-reset", "late");
    useArenaStore.getState().setChatBusy("agent-reset", true);
    useArenaStore.getState().appendChat("agent-reset", {
      role: "assistant",
      content: "nope",
    });
    useArenaStore.getState().setAgentSpeech("agent-reset", "hi");
    useArenaStore.getState().setAgentState("agent-reset", { state: "talking" });

    const s = useArenaStore.getState();
    expect(s.chats).toEqual({});
    expect(s.chatBusyById).toEqual({});
    expect(s.runtimeAgents).toEqual([]);
  });

  it("ignores pushFloatingChatLog for removed agents and does not arm persist", () => {
    useArenaStore.getState().resetPlayground({ keepModels: false });
    expect(isArenaChatPersistPending()).toBe(false);

    useArenaStore.getState().pushFloatingChatLog({
      agentId: "agent-reset",
      agentName: "Resetter",
      color: "#e07070",
      text: "should not resurrect",
      kind: "agent",
    });

    const s = useArenaStore.getState();
    expect(s.floatingChatLog).toEqual([]);
    expect(s.arenaChatHistory).toEqual([]);
    expect(isArenaChatPersistPending()).toBe(false);
  });

  it("clears arenaChatPersistTimer on reset", () => {
    useArenaStore.getState().pushFloatingChatLog({
      agentId: "agent-reset",
      agentName: "Resetter",
      color: "#e07070",
      text: "pending persist",
      kind: "agent",
    });
    expect(isArenaChatPersistPending()).toBe(true);

    useArenaStore.getState().resetPlayground({ keepModels: false });
    expect(isArenaChatPersistPending()).toBe(false);
    expect(useArenaStore.getState().arenaChatHistory).toEqual([]);
  });

  it("closes controls help on reset and does not set success toast on failure", () => {
    useArenaStore.setState({ controlsHelpOpen: true, toast: null });
    useArenaStore.getState().resetPlayground({ keepModels: false });
    expect(useArenaStore.getState().controlsHelpOpen).toBe(false);

    seedPlayground();
    useArenaStore.setState({ controlsHelpOpen: true, toast: null });
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError",
      );
    });
    const result = useArenaStore.getState().resetPlayground({ keepModels: false });
    spy.mockRestore();
    expect(result.ok).toBe(false);
    expect(useArenaStore.getState().toast).toBe(i18n.t("storage.quotaExceeded"));
    expect(useArenaStore.getState().toast).not.toBe(
      i18n.t("settings.general.reset.done"),
    );
  });
});

describe("late chatter after reset", () => {
  it("writes nothing when a mutter completes after reset abort", async () => {
    let resolveReply!: (value: string) => void;
    chatCompletion.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveReply = resolve;
        }),
    );

    const rt = createChatterRuntime();
    useArenaStore.setState({
      ...useArenaStore.getState(),
      mapEditorOpen: false,
      settingsOpen: false,
      chatterMode: "idle",
      chatBusyById: {},
      agents: useArenaStore.getState().agents.map((a) => ({
        ...a,
        enabled: true,
        chattiness: 80,
      })),
    });
    rt.nextAt.set("agent-reset", 0);
    tickAgentChatter(rt);
    expect(chatCompletion).toHaveBeenCalled();

    abortLiveChatterRuntimes();
    useArenaStore.getState().resetPlayground({ keepModels: false });

    resolveReply("late mutter after reset");
    await vi.runAllTimersAsync();

    expect(useArenaStore.getState().arenaChatHistory).toEqual([]);
    expect(useArenaStore.getState().floatingChatLog).toEqual([]);
    disposeChatterRuntime(rt);
  });
});
