import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportedAgent } from "@/lib/agentRoster";
import { blankMap } from "@/lib/maps/schema";
import { STORAGE_KEY, loadPersisted } from "@/lib/storage";
import type { ArenaAgent } from "@/lib/types";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import i18n from "@/i18n";
import {
  resetPersistToastThrottle,
  useArenaStore,
} from "@/store/arenaStore";

function importedAgent(
  partial: Partial<ImportedAgent> = {},
): ImportedAgent {
  return {
    displayName: "Imported",
    polyPresetId: "explorer",
    characterId: "generic-male",
    systemPrompt: "",
    enabled: true,
    thinkingEnabled: false,
    chattiness: 50,
    temperament: 5,
    skills: [],
    color: "#abcabc",
    ...partial,
  };
}

function seedCustomMap() {
  const map = blankMap({
    id: "custom_persist_test",
    name: "Persist Test",
    floor: { size: 18, style: "surface", color: "#ccc", surface: "office" },
  });
  useArenaStore.setState({
    ...useArenaStore.getState(),
    userName: "Samet",
    language: "en",
    mapId: map.id,
    customMaps: [map],
    mapEditorOpen: true,
    mapEditorSourceId: map.id,
    toast: null,
    chats: {},
    arenaChatHistory: [],
    models: [],
    agents: [],
  });
  useArenaStore.getState().persist();
  return map;
}

function throwQuotaOnSetItem() {
  return vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
  });
}

beforeEach(async () => {
  localStorage.clear();
  resetPersistToastThrottle();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  await i18n.changeLanguage("en");
  seedCustomMap();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
  vi.restoreAllMocks();
  resetPersistToastThrottle();
});

describe("arenaStore persist / map save quota", () => {
  it("keeps map editor open and reverts customMaps when save hits quota", () => {
    const beforeMaps = structuredClone(useArenaStore.getState().customMaps);
    const beforeStorage = localStorage.getItem(STORAGE_KEY);
    const draft = {
      ...useArenaStore.getState().customMaps[0]!,
      name: "Edited After Quota",
      floor: {
        ...useArenaStore.getState().customMaps[0]!.floor,
        size: 24,
      },
    };

    const spy = throwQuotaOnSetItem();
    const result = useArenaStore.getState().saveMapFromEditor(draft, true);
    spy.mockRestore();

    expect(result).toEqual({ ok: false, reason: "quota" });
    const s = useArenaStore.getState();
    expect(s.mapEditorOpen).toBe(true);
    expect(s.mapEditorSourceId).toBe("custom_persist_test");
    expect(s.customMaps).toEqual(beforeMaps);
    expect(s.customMaps[0]?.name).toBe("Persist Test");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeStorage);
    // Editor path uses a sticky inline banner (persist toast silenced).
    expect(s.toast).toBeNull();
  });

  it("closes the editor after a successful map save", () => {
    const draft = {
      ...useArenaStore.getState().customMaps[0]!,
      name: "Saved OK",
    };
    const result = useArenaStore.getState().saveMapFromEditor(draft, true);
    expect(result).toEqual({ ok: true });
    expect(useArenaStore.getState().mapEditorOpen).toBe(false);
    expect(useArenaStore.getState().customMaps[0]?.name).toBe("Saved OK");
    expect(loadPersisted().customMaps[0]?.name).toBe("Saved OK");
  });

  it("throttles repeated background persist failure toasts to once per 10s", () => {
    const spy = throwQuotaOnSetItem();

    vi.setSystemTime(1_000_000);
    useArenaStore.getState().persist();
    expect(useArenaStore.getState().toast).toBe(i18n.t("storage.quotaExceeded"));

    useArenaStore.setState({ toast: null });
    vi.setSystemTime(1_000_000 + 5_000);
    useArenaStore.getState().persist();
    expect(useArenaStore.getState().toast).toBeNull();

    vi.setSystemTime(1_000_000 + 10_000);
    useArenaStore.getState().persist();
    expect(useArenaStore.getState().toast).toBe(i18n.t("storage.quotaExceeded"));

    spy.mockRestore();
  });

  it("still shows a map-action failure toast within the background throttle window", () => {
    const spy = throwQuotaOnSetItem();

    vi.setSystemTime(2_000_000);
    useArenaStore.getState().persist();
    expect(useArenaStore.getState().toast).toBe(i18n.t("storage.quotaExceeded"));

    useArenaStore.setState({ toast: null });
    vi.setSystemTime(2_000_000 + 3_000);
    const result = useArenaStore.getState().upsertCustomMap(
      blankMap({ id: "custom_map_toast", name: "Map Toast" }),
    );
    expect(result.ok).toBe(false);
    expect(useArenaStore.getState().toast).toBe(i18n.t("mapEditor.saveFailed"));

    spy.mockRestore();
  });

  it("reverts upsertCustomMap when persist fails", () => {
    const before = structuredClone(useArenaStore.getState().customMaps);
    const spy = throwQuotaOnSetItem();
    const result = useArenaStore.getState().upsertCustomMap(
      blankMap({
        id: "custom_new_fail",
        name: "Should Not Stick",
      }),
    );
    spy.mockRestore();
    expect(result.ok).toBe(false);
    expect(useArenaStore.getState().customMaps).toEqual(before);
    expect(
      useArenaStore.getState().customMaps.some((m) => m.id === "custom_new_fail"),
    ).toBe(false);
  });

  it("commitMapImport throws persist_failed and does not setMapId", () => {
    const beforeId = useArenaStore.getState().mapId;
    const prepared = useArenaStore.getState().parseMapImport(
      JSON.stringify(
        blankMap({ id: "custom_import_fail", name: "Import Fail" }),
      ),
    );
    const spy = throwQuotaOnSetItem();
    expect(() =>
      useArenaStore.getState().commitMapImport(prepared, "overwrite", "copy"),
    ).toThrow(/persist_failed/);
    spy.mockRestore();
    expect(useArenaStore.getState().mapId).toBe(beforeId);
    expect(
      useArenaStore.getState().customMaps.some((m) => m.id === "custom_import_fail"),
    ).toBe(false);
  });

  it("createNewMap / duplicateActiveMap do not open the editor when persist fails", () => {
    useArenaStore.setState({ mapEditorOpen: false, mapEditorSourceId: null });
    const spy = throwQuotaOnSetItem();

    useArenaStore.getState().createNewMap();
    expect(useArenaStore.getState().mapEditorOpen).toBe(false);
    expect(useArenaStore.getState().mapEditorSourceId).toBeNull();

    useArenaStore.getState().duplicateActiveMap();
    expect(useArenaStore.getState().mapEditorOpen).toBe(false);
    expect(useArenaStore.getState().mapEditorSourceId).toBeNull();

    spy.mockRestore();
  });

  it("builtin-map save failure restores mapId and runtimeAgents", () => {
    const runtime: ArenaAgent = {
      ...sampleAgent({ id: "ra1" }),
      position: [1, 0, 2],
      homePosition: [1, 0, 2],
      rotationY: 0.4,
      state: "idle",
      moveSpeed: 1.2,
      thinkingIntensity: 0,
    };
    useArenaStore.setState({
      mapId: "office",
      customMaps: [],
      mapEditorOpen: true,
      mapEditorSourceId: "office",
      agents: [sampleAgent({ id: "ra1" })],
      runtimeAgents: [runtime],
    });
    useArenaStore.getState().applyMapAndAgents();
    const before = {
      mapId: useArenaStore.getState().mapId,
      runtimeAgents: structuredClone(useArenaStore.getState().runtimeAgents),
      customMaps: structuredClone(useArenaStore.getState().customMaps),
    };

    const office = useArenaStore.getState().activeMap!;
    expect(office.builtin).toBe(true);

    const spy = throwQuotaOnSetItem();
    const result = useArenaStore.getState().saveMapFromEditor(
      { ...office, name: "Office Copy Fail" },
      true,
    );
    spy.mockRestore();

    expect(result.ok).toBe(false);
    expect(useArenaStore.getState().mapId).toBe(before.mapId);
    expect(useArenaStore.getState().customMaps).toEqual(before.customMaps);
    expect(useArenaStore.getState().runtimeAgents).toEqual(before.runtimeAgents);
    expect(useArenaStore.getState().mapEditorOpen).toBe(true);
  });

  it("a successful persist after a failure writes the current in-memory state", () => {
    const spy = throwQuotaOnSetItem();
    useArenaStore.getState().persist();
    spy.mockRestore();

    useArenaStore.setState({
      chats: {
        a1: [{ role: "user", content: "kept after quota" }],
      },
    });
    const result = useArenaStore.getState().persist();
    expect(result).toEqual({ ok: true });
    expect(loadPersisted().chats.a1?.[0]?.content).toBe("kept after quota");
  });

  it("upsertAgent / upsertModel / importAgents expose persist failure without success-path ok", () => {
    const model = sampleModel();
    useArenaStore.getState().upsertModel(model);
    useArenaStore.getState().upsertAgent(
      sampleAgent({ id: "agent_persist", modelConfigId: model.id }),
    );

    const spy = throwQuotaOnSetItem();
    const agentResult = useArenaStore.getState().upsertAgent(
      sampleAgent({
        id: "agent_persist",
        displayName: "Edited",
        modelConfigId: model.id,
      }),
    );
    expect(agentResult).toEqual({ ok: false, reason: "quota" });

    const modelResult = useArenaStore.getState().upsertModel({
      ...model,
      name: "Edited Model",
    });
    expect(modelResult).toEqual({ ok: false, reason: "quota" });

    const imported = useArenaStore.getState().importAgents(
      [importedAgent()],
      [model.id],
      "copy",
    );
    expect(imported.agents).toHaveLength(1);
    expect(imported.result).toEqual({ ok: false, reason: "quota" });
    spy.mockRestore();
  });
});
