import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { createMapFromPreset } from "@/lib/maps/presets";
import i18n from "@/i18n";
import {
  resetPersistToastThrottle,
  useArenaStore,
} from "@/store/arenaStore";

function seedBase() {
  const map = blankMap({
    id: "custom_seed",
    name: "Seed Map",
    floor: { size: 18, style: "surface", color: "#ccc", surface: "office" },
  });
  useArenaStore.setState({
    ...useArenaStore.getState(),
    userName: "Samet",
    language: "en",
    mapId: "office",
    customMaps: [map],
    mapEditorOpen: false,
    mapEditorSourceId: null,
    settingsOpen: true,
    toast: null,
    chats: {},
    arenaChatHistory: [],
    models: [],
    agents: [],
  });
  useArenaStore.getState().persist();
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
  seedBase();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
  vi.restoreAllMocks();
  resetPersistToastThrottle();
});

describe("createMapFromPresetAndEdit", () => {
  it("adds the map and opens the editor with sourceId on success", () => {
    const before = useArenaStore.getState().customMaps.length;
    const result = useArenaStore
      .getState()
      .createMapFromPresetAndEdit("space_outpost", "Space outpost", "copy");
    expect(result.ok).toBe(true);
    const s = useArenaStore.getState();
    expect(s.customMaps.length).toBe(before + 1);
    expect(s.mapEditorOpen).toBe(true);
    expect(s.mapEditorSourceId).toMatch(/^custom_/);
    expect(s.settingsOpen).toBe(false);
    expect(s.mapId).toBe("office"); // inactive, like New map
    const created = s.customMaps.find((m) => m.id === s.mapEditorSourceId);
    expect(created?.name).toBe("Space outpost");
    expect(s.toast).toBeNull();
  });

  it("rolls back on quota failure and keeps Settings open", () => {
    const before = structuredClone(useArenaStore.getState().customMaps);
    const spy = throwQuotaOnSetItem();
    const result = useArenaStore
      .getState()
      .createMapFromPresetAndEdit("starter_camp", "Starter camp", "copy");
    spy.mockRestore();
    expect(result.ok).toBe(false);
    const s = useArenaStore.getState();
    expect(s.customMaps).toEqual(before);
    expect(s.mapEditorOpen).toBe(false);
    expect(s.mapEditorSourceId).toBeNull();
    expect(s.settingsOpen).toBe(true);
    expect(s.toast).toBe(i18n.t("mapEditor.saveFailed"));
  });

  it("falls back to the default map for an unknown preset id", () => {
    const expected = createMapFromPreset("not-a-real-preset", {
      name: "Fallback",
      copyLabel: "copy",
    });
    const result = useArenaStore
      .getState()
      .createMapFromPresetAndEdit("not-a-real-preset", "Fallback", "copy");
    expect(result.ok).toBe(true);
    const s = useArenaStore.getState();
    const created = s.customMaps.find((m) => m.id === s.mapEditorSourceId);
    expect(created).toBeTruthy();
    expect(created!.name).toBe("Fallback");
    // Same shape as a blank/default fallback (no placeables from a known builtin clone)
    expect(created!.placeables.length).toBe(expected.placeables.length);
    expect(s.mapEditorOpen).toBe(true);
  });

  it("appends (copy) when a map with the same name already exists", () => {
    const colliding = blankMap({
      id: "custom_space_dup",
      name: "Space outpost",
      floor: { size: 18, style: "surface", color: "#ccc", surface: "office" },
    });
    useArenaStore.setState({
      ...useArenaStore.getState(),
      customMaps: [...useArenaStore.getState().customMaps, colliding],
    });
    useArenaStore.getState().persist();

    const result = useArenaStore
      .getState()
      .createMapFromPresetAndEdit("space_outpost", "Space outpost", "copy");
    expect(result.ok).toBe(true);
    const s = useArenaStore.getState();
    const created = s.customMaps.find((m) => m.id === s.mapEditorSourceId);
    expect(created?.name).toBe("Space outpost (copy)");
  });
});
