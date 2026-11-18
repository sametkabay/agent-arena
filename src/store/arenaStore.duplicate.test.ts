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

describe("arenaStore duplicateAgent", () => {
  it("appends after the original and persists", () => {
    const model = sampleModel();
    const source = sampleAgent({ modelConfigId: model.id });
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(source);

    const copy = useArenaStore.getState().duplicateAgent(source.id, "copy");
    expect(copy).not.toBeNull();
    expect(copy!.displayName).toBe("Explorer (copy)");

    const agents = useArenaStore.getState().agents;
    expect(agents.map((a) => a.id)).toEqual([source.id, copy!.id]);
    expect(loadPersisted().agents.map((a) => a.id)).toEqual([
      source.id,
      copy!.id,
    ]);
  });

  it("returns null for an unknown id with no change", () => {
    useArenaStore.getState().upsertAgent(sampleAgent());
    const before = useArenaStore.getState().agents;
    expect(useArenaStore.getState().duplicateAgent("missing", "copy")).toBeNull();
    expect(useArenaStore.getState().agents).toEqual(before);
  });

  it("does not copy chats and leaves models / API key untouched", () => {
    const model = sampleModel({ apiKey: "sk-test" });
    const source = sampleAgent({ modelConfigId: model.id });
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(source);
    useArenaStore.setState({
      chats: { [source.id]: [{ role: "user", content: "hi" }] },
    });

    const copy = useArenaStore.getState().duplicateAgent(source.id, "copy")!;
    expect(useArenaStore.getState().chats[copy.id]).toBeUndefined();
    expect(useArenaStore.getState().models).toHaveLength(1);
    expect(useArenaStore.getState().models[0]?.apiKey).toBe("sk-test");

    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw.split("sk-test")).toHaveLength(2);
  });

  it("leaves selection and chatOpen unchanged", () => {
    const model = sampleModel();
    const source = sampleAgent({ modelConfigId: model.id });
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(source);
    useArenaStore.setState({ selectedAgentId: source.id, chatOpen: true });

    useArenaStore.getState().duplicateAgent(source.id, "copy");
    expect(useArenaStore.getState().selectedAgentId).toBe(source.id);
    expect(useArenaStore.getState().chatOpen).toBe(true);
  });

  it("keeps a disabled copy off the map and onboardingSeen false", () => {
    const source = sampleAgent({
      enabled: false,
      modelConfigId: "",
    });
    useArenaStore.getState().upsertAgent(source);
    expect(useArenaStore.getState().onboardingSeen).toBe(false);

    const copy = useArenaStore.getState().duplicateAgent(source.id, "copy")!;
    expect(copy.enabled).toBe(false);
    expect(useArenaStore.getState().runtimeAgents).toHaveLength(0);
    expect(useArenaStore.getState().onboardingSeen).toBe(false);
  });

  it("marks onboarding seen when duplicating a bound enabled agent", () => {
    const model = sampleModel();
    const source = sampleAgent({ modelConfigId: model.id, enabled: true });
    useArenaStore.getState().upsertModel(model);
    useArenaStore.setState({ onboardingSeen: false, agents: [], models: [model] });
    useArenaStore.getState().upsertAgent(source);
    useArenaStore.setState({ onboardingSeen: false });

    useArenaStore.getState().duplicateAgent(source.id, "copy");
    expect(useArenaStore.getState().onboardingSeen).toBe(true);
  });
});
