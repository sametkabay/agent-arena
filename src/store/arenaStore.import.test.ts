import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { STORAGE_KEY, loadPersisted } from "@/lib/storage";
import {
  ROSTER_FORMAT,
  parseRosterImport,
  type ImportedAgent,
} from "@/lib/agentRoster";
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
    temperament: 5,
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

    const { agents: created, result } = useArenaStore.getState().importAgents(
      [
        imported({ displayName: "Ada" }),
        imported({ displayName: "Bo", polyPresetId: "engineer" }),
      ],
      [model.id, "missing-model"],
      "copy",
    );

    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();

    expect(result).toEqual({ ok: true });
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

  it("returns empty agents when no models exist", () => {
    const beforeRaw = localStorage.getItem(STORAGE_KEY);
    const { agents: created, result } = useArenaStore
      .getState()
      .importAgents([imported()], ["missing"], "copy");
    expect(created).toEqual([]);
    expect(result).toEqual({ ok: true });
    expect(useArenaStore.getState().agents).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeRaw);
  });

  it("returns empty agents for an empty import without changing storage", () => {
    useArenaStore.getState().upsertAgent(sampleAgent());
    const beforeAgents = useArenaStore.getState().agents;
    const beforeRaw = localStorage.getItem(STORAGE_KEY);
    expect(useArenaStore.getState().importAgents([], [], "copy")).toEqual({
      agents: [],
      result: { ok: true },
    });
    expect(useArenaStore.getState().agents).toEqual(beforeAgents);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeRaw);
  });

  it("gives an imported role-titled agent the next free pool name when roster has Kai", () => {
    const model = sampleModel();
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(
      sampleAgent({ id: "a-kai", displayName: "Kai", modelConfigId: model.id }),
    );

    const { agents: created } = useArenaStore.getState().importAgents(
      [imported({ displayName: "Explorer", polyPresetId: "explorer", systemPrompt: "x" })],
      [model.id],
      "copy",
    );
    expect(created[0]!.displayName).toBe("Mira");
    expect(created[0]!.displayName).not.toMatch(/\(copy\)/i);
  });

  it("keeps a later row’s Kai and assigns Mira to a preceding Explorer row", () => {
    const model = sampleModel();
    useArenaStore.getState().upsertModel(model);
    const { agents: created } = useArenaStore.getState().importAgents(
      [
        imported({ displayName: "Explorer", polyPresetId: "explorer", systemPrompt: "x" }),
        imported({ displayName: "Kai", polyPresetId: "engineer", systemPrompt: "y" }),
      ],
      [model.id, model.id],
      "copy",
    );
    expect(created.map((a) => a.displayName)).toEqual(["Mira", "Kai"]);
    expect(created[1]!.polyPresetId).toBe("engineer");
  });

  it("parse with existingNames then importAgents stays on the previewed pool name", () => {
    const model = sampleModel();
    useArenaStore.setState({
      ...useArenaStore.getState(),
      models: [model],
      agents: [
        sampleAgent({
          id: "live-kai",
          displayName: "Kai",
          modelConfigId: model.id,
        }),
      ],
    });

    const parsed = parseRosterImport(
      JSON.stringify({
        format: ROSTER_FORMAT,
        version: 1,
        agents: [
          {
            displayName: "Explorer",
            polyPresetId: "explorer",
            systemPrompt: "Hi",
          },
        ],
      }),
      { existingCount: 1, existingNames: ["Kai"] },
    );
    expect(parsed.agents[0]!.displayName).toBe("Mira");

    const { agents: created } = useArenaStore
      .getState()
      .importAgents(parsed.agents, [model.id], "copy");
    expect(created[0]!.displayName).toBe("Mira");
  });
});
