import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { STORAGE_KEY } from "@/lib/storage";
import { sampleAgent } from "@/test/fixtures";
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

function seedExisting() {
  const map = blankMap({
    id: "custom_clash",
    name: "Original",
    description: "keep-me",
    floor: { size: 16, style: "surface", color: "#aaa", surface: "office" },
  });
  useArenaStore.setState({
    ...useArenaStore.getState(),
    userName: "Samet",
    language: "en",
    mapId: "office",
    customMaps: [map],
    mapEditorOpen: false,
    mapEditorSourceId: null,
    toast: null,
    chats: {},
    arenaChatHistory: [],
    models: [],
    agents: [],
  });
  useArenaStore.getState().persist();
  return map;
}

describe("arenaStore map import (#41)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPersistToastThrottle();
    useArenaStore.getState().hydrate();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("imports with no collision (unchanged behavior)", () => {
    seedExisting();
    const raw = JSON.stringify(
      blankMap({ id: "custom_free", name: "Brand New" }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    expect(prepared.collision).toBeNull();
    const id = useArenaStore
      .getState()
      .commitMapImport(prepared, "overwrite", "copy");
    expect(id).toBe("custom_free");
    const s = useArenaStore.getState();
    expect(s.mapId).toBe("custom_free");
    expect(s.customMaps).toHaveLength(2);
    expect(s.customMaps.find((m) => m.id === "custom_clash")?.name).toBe(
      "Original",
    );
  });

  it("collision + overwrite replaces the existing map", () => {
    seedExisting();
    const raw = JSON.stringify(
      blankMap({
        id: "custom_clash",
        name: "Replaced",
        description: "new-desc",
      }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    expect(prepared.collision?.id).toBe("custom_clash");
    useArenaStore.getState().commitMapImport(prepared, "overwrite", "copy");
    const s = useArenaStore.getState();
    expect(s.customMaps).toHaveLength(1);
    expect(s.customMaps[0]?.name).toBe("Replaced");
    expect(s.customMaps[0]?.description).toBe("new-desc");
    expect(s.mapId).toBe("custom_clash");
  });

  it("collision + copy inserts a fresh id with copy suffix", () => {
    seedExisting();
    const raw = JSON.stringify(
      blankMap({ id: "custom_clash", name: "Original" }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    const id = useArenaStore
      .getState()
      .commitMapImport(prepared, "copy", "copy");
    const s = useArenaStore.getState();
    expect(id.startsWith("custom_")).toBe(true);
    expect(id).not.toBe("custom_clash");
    expect(s.customMaps).toHaveLength(2);
    const original = s.customMaps.find((m) => m.id === "custom_clash");
    const copy = s.customMaps.find((m) => m.id === id);
    expect(original?.name).toBe("Original");
    expect(original?.description).toBe("keep-me");
    expect(copy?.name).toBe("Original (copy)");
    expect(s.mapId).toBe(id);
  });

  it("parse alone does not mutate store or storage (cancel path)", () => {
    const before = seedExisting();
    const beforeStorage = localStorage.getItem(STORAGE_KEY);
    const raw = JSON.stringify(
      blankMap({ id: "custom_clash", name: "Should Not Stick" }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    expect(prepared.collision?.id).toBe("custom_clash");
    expect(prepared.def.name).toBe("Should Not Stick");

    const s = useArenaStore.getState();
    expect(s.customMaps).toEqual([before]);
    expect(s.mapId).toBe("office");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeStorage);

    // Contrast: committing would change state — cancel deliberately skips it.
    useArenaStore.getState().commitMapImport(prepared, "overwrite", "copy");
    expect(useArenaStore.getState().customMaps[0]?.name).toBe("Should Not Stick");
  });

  it("overwrite persist failure rolls back and leaves original untouched", () => {
    seedExisting();
    const before = structuredClone(useArenaStore.getState().customMaps);
    const beforeId = useArenaStore.getState().mapId;
    const raw = JSON.stringify(
      blankMap({
        id: "custom_clash",
        name: "Should Not Stick",
        description: "fail",
      }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    const spy = throwQuotaOnSetItem();
    expect(() =>
      useArenaStore.getState().commitMapImport(prepared, "overwrite", "copy"),
    ).toThrow(/persist_failed/);
    spy.mockRestore();
    const s = useArenaStore.getState();
    expect(s.customMaps).toEqual(before);
    expect(s.customMaps[0]?.name).toBe("Original");
    expect(s.mapId).toBe(beforeId);
  });

  it("copy persist failure rolls back and does not add the copy", () => {
    seedExisting();
    const before = structuredClone(useArenaStore.getState().customMaps);
    const raw = JSON.stringify(
      blankMap({ id: "custom_clash", name: "Original" }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    const spy = throwQuotaOnSetItem();
    expect(() =>
      useArenaStore.getState().commitMapImport(prepared, "copy", "copy"),
    ).toThrow(/persist_failed/);
    spy.mockRestore();
    expect(useArenaStore.getState().customMaps).toEqual(before);
    expect(useArenaStore.getState().customMaps).toHaveLength(1);
  });

  it("sets mapEditorSourceId when the editor is open", () => {
    seedExisting();
    useArenaStore.setState({
      mapEditorOpen: true,
      mapEditorSourceId: "office",
    });
    const raw = JSON.stringify(
      blankMap({ id: "custom_editor_import", name: "Editor In" }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    const id = useArenaStore
      .getState()
      .commitMapImport(prepared, "overwrite", "copy");
    expect(useArenaStore.getState().mapEditorSourceId).toBe(id);
  });

  it("rewrites builtin ids on parse so they do not collide", () => {
    seedExisting();
    const raw = JSON.stringify(
      blankMap({ id: "office", name: "From Builtin", builtin: true }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    expect(prepared.def.id.startsWith("custom_")).toBe(true);
    expect(prepared.collision).toBeNull();
  });

  it("overwriting the active map rebuilds runtimeAgents", () => {
    seedExisting();
    useArenaStore.setState({
      agents: [sampleAgent({ id: "agent_a" })],
    });
    useArenaStore.getState().setMapId("custom_clash");
    const beforeAgents = useArenaStore.getState().runtimeAgents;
    expect(beforeAgents.length).toBeGreaterThan(0);
    const beforePos = beforeAgents.map((a) => [...a.position]);

    const raw = JSON.stringify(
      blankMap({
        id: "custom_clash",
        name: "Replaced Active",
        floor: { size: 24, style: "surface", color: "#bbb", surface: "office" },
        spawnPoints: [
          { id: "spawn_0", position: [5, 0, 5], rotationY: 0 },
        ],
      }),
    );
    const prepared = useArenaStore.getState().parseMapImport(raw);
    useArenaStore.getState().commitMapImport(prepared, "overwrite", "copy");

    const after = useArenaStore.getState();
    expect(after.mapId).toBe("custom_clash");
    expect(after.activeMap?.name).toBe("Replaced Active");
    expect(after.floorSize).toBe(24);
    expect(after.runtimeAgents).toHaveLength(beforeAgents.length);
    // Positions re-placed onto the new spawn layout (not left stale).
    const afterPos = after.runtimeAgents.map((a) => [...a.position]);
    expect(afterPos).not.toEqual(beforePos);
  });
});
