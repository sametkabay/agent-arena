import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { STORAGE_KEY, loadPersisted } from "@/lib/storage";
import type { ImportedAgent } from "@/lib/agentRoster";
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

function imported(partial: Partial<ImportedAgent> = {}): ImportedAgent {
  return {
    displayName: "Ada",
    polyPresetId: "explorer",
    characterId: "generic-female",
    systemPrompt: "You are Ada.",
    color: "#e07070",
    chattiness: 50,
    thinkingEnabled: false,
    enabled: true,
    skills: [],
    ...partial,
  };
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  localStorage.clear();
});

describe("arenaStore importAgents", () => {
  it("appends agents in one write, persists, and marks onboarding complete", () => {
    const model = sampleModel();
    const existing = sampleAgent({
      id: "agent-existing",
      displayName: "Ada",
      modelConfigId: model.id,
    });
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(existing);
    useArenaStore.setState({ onboardingSeen: false });

    const setItem = vi.spyOn(localStorage, "setItem");
    setItem.mockClear();

    const created = useArenaStore.getState().importAgents(
      [
        imported({ displayName: "Ada" }),
        imported({ displayName: "Bo", polyPresetId: "engineer" }),
      ],
      [model.id, "missing-model"],
      "copy",
    );

    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();

    expect(created).toHaveLength(2);
    expect(created[0]!.displayName).toBe("Ada (copy)");
    expect(created[1]!.displayName).toBe("Bo");
    expect(created[0]!.id).not.toBe(existing.id);
    expect(created[0]!.modelConfigId).toBe(model.id);
    expect(created[1]!.modelConfigId).toBe(model.id);

    const agents = useArenaStore.getState().agents;
    expect(agents).toHaveLength(3);
    expect(agents.map((a) => a.id)).toEqual([
      existing.id,
      created[0]!.id,
      created[1]!.id,
    ]);
    expect(useArenaStore.getState().onboardingSeen).toBe(true);
    expect(loadPersisted().agents.map((a) => a.id)).toEqual(
      agents.map((a) => a.id),
    );
  });

  it("returns [] when no models exist", () => {
    const beforeRaw = localStorage.getItem(STORAGE_KEY);
    const created = useArenaStore
      .getState()
      .importAgents([imported()], ["missing"], "copy");
    expect(created).toEqual([]);
    expect(useArenaStore.getState().agents).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeRaw);
  });

  it("returns [] for an empty import without changing storage", () => {
    useArenaStore.getState().upsertAgent(sampleAgent());
    const beforeAgents = useArenaStore.getState().agents;
    const beforeRaw = localStorage.getItem(STORAGE_KEY);
    expect(useArenaStore.getState().importAgents([], [], "copy")).toEqual([]);
    expect(useArenaStore.getState().agents).toEqual(beforeAgents);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeRaw);
  });
});
