import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { STORAGE_KEY } from "@/lib/storage";
import type { ArenaAgent } from "@/lib/types";
import { useArenaStore } from "@/store/arenaStore";

beforeEach(() => {
  localStorage.clear();
  const map = blankMap({
    id: "custom_purge",
    name: "Purge Map",
    floor: { size: 18, style: "surface", color: "#ccc", surface: "office" },
  });
  map.placeables = [
    {
      id: "p1",
      placeableId: "user:abc",
      position: [0, 0, 0],
      rotationY: 0,
    },
    {
      id: "p2",
      placeableId: "chair",
      position: [1, 0, 0],
      rotationY: 0,
    },
  ];
  useArenaStore.setState({
    ...useArenaStore.getState(),
    customMaps: [map],
    mapId: map.id,
    favoriteAssets: ["user:abc", "chair"],
    placeables: map.placeables,
  });
  useArenaStore.getState().persist();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("purgePlaceableIds", () => {
  it("strips from maps, favorites, and active slice", () => {
    const result = useArenaStore.getState().purgePlaceableIds(["user:abc"]);
    expect(result.ok).toBe(true);
    const s = useArenaStore.getState();
    expect(s.customMaps[0]!.placeables.map((p) => p.placeableId)).toEqual([
      "chair",
    ]);
    expect(s.favoriteAssets).toEqual(["chair"]);
    expect(s.placeables.every((p) => p.placeableId !== "user:abc")).toBe(true);
  });

  it("rolls back on persist failure", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const before = useArenaStore.getState().customMaps[0]!.placeables.length;
    const result = useArenaStore.getState().purgePlaceableIds(["user:abc"]);
    expect(result.ok).toBe(false);
    expect(useArenaStore.getState().customMaps[0]!.placeables).toHaveLength(
      before,
    );
    expect(useArenaStore.getState().favoriteAssets).toContain("user:abc");
  });
});

describe("reloadPersistedMaps", () => {
  it("reloads customMaps and favorites without wiping runtimeAgents or chats", () => {
    const runtimeAgents: ArenaAgent[] = [
      {
        id: "agent-1",
        displayName: "A",
        modelConfigId: "m1",
        polyPresetId: "explorer",
        characterId: "generic-male",
        systemPrompt: "",
        color: "#fff",
        position: [1, 0, 2],
        rotationY: 0.5,
        homePosition: [1, 0, 2],
        state: "idle",
        thinkingIntensity: 0,
        moveSpeed: 1,
      },
    ];
    const chats = {
      "agent-1": [{ role: "user" as const, content: "hi" }],
    };
    const arenaChatHistory = [
      {
        id: "c1",
        agentId: "agent-1",
        agentName: "A",
        color: "#fff",
        text: "yo",
        createdAt: 1,
        kind: "agent" as const,
      },
    ];
    useArenaStore.setState({
      ...useArenaStore.getState(),
      runtimeAgents,
      chats,
      arenaChatHistory,
    });

    // Simulate another tab purging the user placeable and persisting.
    const purged = structuredClone(useArenaStore.getState().customMaps);
    purged[0]!.placeables = purged[0]!.placeables.filter(
      (p) => p.placeableId !== "user:abc",
    );
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      customMaps?: unknown;
      favoriteAssets?: string[];
    };
    raw.customMaps = purged;
    raw.favoriteAssets = ["chair"];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    // Stale tab still has the old in-memory maps.
    expect(
      useArenaStore
        .getState()
        .customMaps[0]!.placeables.some((p) => p.placeableId === "user:abc"),
    ).toBe(true);

    useArenaStore.getState().reloadPersistedMaps();

    const s = useArenaStore.getState();
    expect(s.customMaps[0]!.placeables.map((p) => p.placeableId)).toEqual([
      "chair",
    ]);
    expect(s.favoriteAssets).toEqual(["chair"]);
    expect(s.runtimeAgents).toEqual(runtimeAgents);
    expect(s.chats).toEqual(chats);
    expect(s.arenaChatHistory).toEqual(arenaChatHistory);
  });
});
