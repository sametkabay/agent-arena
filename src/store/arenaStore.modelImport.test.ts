import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { STORAGE_KEY, loadPersisted } from "@/lib/storage";
import type { ImportedModel } from "@/lib/modelConfigIO";
import {
  resetPersistToastThrottle,
  useArenaStore,
} from "@/store/arenaStore";

function throwQuotaOnSetItem() {
  return vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
  });
}

function imported(partial: Partial<ImportedModel> = {}): ImportedModel {
  return {
    name: "Imported",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
    apiKey: "sk-test-FAKE-0000",
    extraHeaders: [{ key: "X-Org", value: "org-secret-FAKE" }],
    ...partial,
  };
}

function resetStore() {
  localStorage.clear();
  resetPersistToastThrottle();
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
    toast: null,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("arenaStore importModels", () => {
  it("appends models with fresh ids, persists, and leaves agents untouched", () => {
    const existing = sampleModel({
      id: "model-existing",
      modelId: "existing-id",
      baseUrl: "https://other.example.com/v1",
    });
    const agent = sampleAgent({
      id: "agent-1",
      modelConfigId: existing.id,
      displayName: "Ada",
    });
    useArenaStore.getState().upsertModel(existing);
    useArenaStore.getState().upsertAgent(agent);
    useArenaStore.setState({ onboardingSeen: false });

    const agentsBefore = structuredClone(useArenaStore.getState().agents);

    const { models: created, result } = useArenaStore
      .getState()
      .importModels([
        imported({ name: "A", modelId: "new-a" }),
        imported({
          name: "B",
          modelId: "new-b",
          baseUrl: "https://api.openai.com/v1/",
        }),
      ]);

    expect(result).toEqual({ ok: true });
    expect(created).toHaveLength(2);
    expect(created[0]!.id).not.toBe(existing.id);
    expect(created[0]!.id.startsWith("model")).toBe(true);
    expect(created[0]!.createdAt).toBeTypeOf("number");

    const s = useArenaStore.getState();
    expect(s.models).toHaveLength(3);
    expect(s.agents).toEqual(agentsBefore);
    expect(s.onboardingSeen).toBe(true);
    expect(loadPersisted().models.map((m) => m.id)).toEqual(
      s.models.map((m) => m.id),
    );
    expect(loadPersisted().agents.map((a) => a.id)).toEqual(
      agentsBefore.map((a) => a.id),
    );
  });

  it("re-dedupes against existing models inside the store action", () => {
    useArenaStore.getState().upsertModel(sampleModel());
    const { models: created, result } = useArenaStore
      .getState()
      .importModels([
        imported({
          baseUrl: "HTTPS://API.OpenAI.com/v1/",
          modelId: "gpt-4o-mini",
        }),
        imported({ modelId: "fresh" }),
      ]);
    expect(result.ok).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0]!.modelId).toBe("fresh");
    expect(useArenaStore.getState().models).toHaveLength(2);
  });

  it("rolls back models on QuotaExceededError and does not touch agents", () => {
    const existing = sampleModel({ id: "model-keep" });
    const agent = sampleAgent({
      id: "agent-keep",
      modelConfigId: existing.id,
    });
    useArenaStore.getState().upsertModel(existing);
    useArenaStore.getState().upsertAgent(agent);
    const beforeModels = structuredClone(useArenaStore.getState().models);
    const beforeAgents = structuredClone(useArenaStore.getState().agents);
    const beforeRaw = localStorage.getItem(STORAGE_KEY);

    throwQuotaOnSetItem();

    const { models: created, result } = useArenaStore
      .getState()
      .importModels([imported({ modelId: "should-not-stick" })]);

    expect(result.ok).toBe(false);
    expect(created).toHaveLength(0);
    expect(useArenaStore.getState().models).toEqual(beforeModels);
    expect(useArenaStore.getState().agents).toEqual(beforeAgents);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeRaw);
  });

  it("shows an unthrottled failure toast for import after a background persist failure", async () => {
    const { default: i18n } = await import("@/i18n");
    vi.useFakeTimers();
    vi.setSystemTime(3_000_000);
    throwQuotaOnSetItem();

    // Background write consumes the 10s storage toast window.
    useArenaStore.getState().persist();
    expect(useArenaStore.getState().toast).toBe(i18n.t("storage.quotaExceeded"));

    useArenaStore.setState({ toast: null });
    vi.setSystemTime(3_000_000 + 2_000);

    const before = structuredClone(useArenaStore.getState().models);
    const { models: created, result } = useArenaStore
      .getState()
      .importModels([imported({ modelId: "import-after-throttle" })]);

    expect(result.ok).toBe(false);
    expect(created).toHaveLength(0);
    expect(useArenaStore.getState().models).toEqual(before);
    expect(useArenaStore.getState().toast).toBe(i18n.t("storage.quotaExceeded"));
    expect(useArenaStore.getState().toast).not.toMatch(/Imported/i);

    vi.useRealTimers();
  });
});
