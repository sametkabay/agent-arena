import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBuiltinMap } from "@/lib/maps/runtime";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { createZone, createLight } from "@/lib/maps/mapRegionEdit";
import i18n from "@/i18n";
import {
  resetPersistToastThrottle,
  useArenaStore,
} from "@/store/arenaStore";
import { STORAGE_KEY } from "@/lib/storage";

beforeEach(async () => {
  localStorage.clear();
  resetPersistToastThrottle();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  await i18n.changeLanguage("en");
  useArenaStore.setState({
    ...useArenaStore.getState(),
    userName: "Samet",
    language: "en",
    mapId: "office",
    customMaps: [],
    mapEditorOpen: true,
    mapEditorSourceId: "office",
    settingsOpen: false,
    toast: null,
    chats: {},
    arenaChatHistory: [],
    models: [],
    agents: [],
  });
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  localStorage.clear();
  vi.restoreAllMocks();
  resetPersistToastThrottle();
});

describe("saveMapFromEditor zones/lights from builtin", () => {
  it("copies zones and lights onto a custom map and leaves builtin unchanged", () => {
    const builtin = getBuiltinMap("office");
    expect(builtin).toBeTruthy();
    const office = builtin as ArenaMapDefinition;
    const beforeZones = structuredClone(office.zones);
    const beforeLights = structuredClone(office.lights);

    const draft: ArenaMapDefinition = {
      ...structuredClone(office),
      name: "Office lounge edit",
      zones: [
        ...(office.zones ?? []),
        createZone("zone_extra", [1, 0, 1], office, "Lounge"),
      ],
      lights: [
        ...(office.lights ?? []),
        createLight("light_extra", [2, 0, 2], office),
      ],
    };

    const result = useArenaStore.getState().saveMapFromEditor(draft, true);
    expect(result).toEqual({ ok: true });

    const s = useArenaStore.getState();
    expect(s.mapEditorOpen).toBe(false);
    expect(s.mapId).toMatch(/^custom_/);
    const saved = s.customMaps.find((m) => m.id === s.mapId);
    expect(saved).toBeTruthy();
    expect(saved!.builtin).toBeFalsy();
    expect(saved!.zones?.some((z) => z.name === "Lounge")).toBe(true);
    expect(saved!.lights?.some((L) => L.id === "light_extra")).toBe(true);

    const officeAgain = getBuiltinMap("office");
    expect(officeAgain).toBeTruthy();
    expect(officeAgain!.zones).toEqual(beforeZones);
    expect(officeAgain!.lights).toEqual(beforeLights);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const fromDisk = (persisted.customMaps ?? []).find(
      (m: { id: string }) => m.id === s.mapId,
    );
    expect(fromDisk?.zones?.some((z: { name: string }) => z.name === "Lounge")).toBe(
      true,
    );
    expect(
      fromDisk?.lights?.some((L: { id: string }) => L.id === "light_extra"),
    ).toBe(true);
  });
});
