import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { STORAGE_KEY, loadPersisted } from "@/lib/storage";
import { useArenaStore } from "@/store/arenaStore";

function resetStore() {
  localStorage.clear();
  useArenaStore.setState({
    ...useArenaStore.getState(),
    userName: "Samet",
    models: [],
    agents: [],
    onboardingSeen: false,
    controlsHelpSeen: false,
    controlsHelpOpen: false,
    controlsHelpAutoDone: false,
    chats: {},
    arenaChatHistory: [],
    runtimeAgents: [],
    selectedAgentId: null,
    chatOpen: false,
    settingsOpen: false,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  localStorage.clear();
});

describe("arenaStore onboarding", () => {
  it("marks onboarding seen when upserting a bound agent and persists it", () => {
    const model = sampleModel();
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(sampleAgent({ modelConfigId: model.id }));

    expect(useArenaStore.getState().onboardingSeen).toBe(true);
    expect(loadPersisted().onboardingSeen).toBe(true);
  });

  it("does not mark onboarding seen for an unbound agent", () => {
    useArenaStore.getState().upsertAgent(sampleAgent({ modelConfigId: "" }));
    expect(useArenaStore.getState().onboardingSeen).toBe(false);
    expect(loadPersisted().onboardingSeen).toBe(false);
  });

  it("keeps onboardingSeen after deleteAgent", () => {
    const model = sampleModel();
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(sampleAgent({ modelConfigId: model.id }));
    useArenaStore.getState().deleteAgent("agent-1");

    expect(useArenaStore.getState().agents).toHaveLength(0);
    expect(useArenaStore.getState().onboardingSeen).toBe(true);
    expect(loadPersisted().onboardingSeen).toBe(true);
  });

  it("persistently dismisses onboarding", () => {
    useArenaStore.getState().dismissOnboarding();
    expect(useArenaStore.getState().onboardingSeen).toBe(true);
    expect(loadPersisted().onboardingSeen).toBe(true);
  });

  it("keeps controlsHelpOpen ephemeral", () => {
    useArenaStore.getState().setControlsHelpOpen(true);
    expect(useArenaStore.getState().controlsHelpOpen).toBe(true);
    useArenaStore.getState().persist();
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    expect(raw).not.toHaveProperty("controlsHelpOpen");
    expect(raw).not.toHaveProperty("controlsHelpAutoDone");
  });

  it("closeControlsHelp(false) only sets autoDone", () => {
    useArenaStore.getState().closeControlsHelp(false);
    expect(useArenaStore.getState().controlsHelpOpen).toBe(false);
    expect(useArenaStore.getState().controlsHelpAutoDone).toBe(true);
    expect(useArenaStore.getState().controlsHelpSeen).toBe(false);
    expect(loadPersisted().controlsHelpSeen).toBe(false);
  });

  it("closeControlsHelp(true) persists seen", () => {
    useArenaStore.getState().closeControlsHelp(true);
    expect(useArenaStore.getState().controlsHelpSeen).toBe(true);
    expect(useArenaStore.getState().controlsHelpAutoDone).toBe(true);
    expect(loadPersisted().controlsHelpSeen).toBe(true);
  });
});
