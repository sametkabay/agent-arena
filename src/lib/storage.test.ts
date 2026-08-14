import { afterEach, describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";
import { blankMap } from "@/lib/maps/schema";
import {
  STORAGE_KEY,
  clampChattiness,
  defaultPersisted,
  loadPersisted,
  savePersisted,
  sanitizeArenaChatHistory,
  sanitizeChats,
  uid,
} from "@/lib/storage";
import { sampleAgent } from "@/test/fixtures";

const FLOOR_STYLE_MIGRATE_KEY = appConfig.storage.floorStyleMigrateKey;

afterEach(() => {
  localStorage.clear();
});

describe("clampChattiness", () => {
  it("clamps, rounds, and treats non-numbers as 0", () => {
    expect(clampChattiness(-10)).toBe(0);
    expect(clampChattiness(150)).toBe(100);
    expect(clampChattiness(33.4)).toBe(33);
    expect(clampChattiness("40")).toBe(40);
    expect(clampChattiness("nope")).toBe(0);
    expect(clampChattiness(undefined)).toBe(0);
  });
});

describe("sanitizeChats", () => {
  it("drops invalid entries and empty assistant messages", () => {
    expect(sanitizeChats(null)).toEqual({});
    expect(sanitizeChats("x")).toEqual({});
    const out = sanitizeChats({
      a1: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "   " },
        { role: "system", content: "sys" },
        { role: "tool", content: "nope" },
        "skip",
        { role: "assistant", content: "ok" },
      ],
      "": [{ role: "user", content: "x" }],
      bad: "not-an-array",
    });
    expect(out.a1).toEqual([
      { role: "user", content: "hi" },
      { role: "system", content: "sys" },
      { role: "assistant", content: "ok" },
    ]);
    expect(out[""]).toBeUndefined();
    expect(out.bad).toBeUndefined();
  });
});

describe("sanitizeArenaChatHistory", () => {
  it("keeps valid lines and fills missing fields", () => {
    expect(sanitizeArenaChatHistory(null)).toEqual([]);
    const lines = sanitizeArenaChatHistory([
      { kind: "user", text: "hello", agentName: "Samet" },
      { kind: "agent", text: "  ", agentName: "Bot" },
      { kind: "system", text: "note", id: "x", color: "#fff", createdAt: 9 },
      { kind: "other", text: "nope" },
      "skip",
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.text).toBe("hello");
    expect(lines[0]?.id).toMatch(/^flog_/);
    expect(lines[0]?.color).toBe(appConfig.defaults.fallbackAgentColor);
    expect(lines[1]).toMatchObject({
      id: "x",
      kind: "system",
      text: "note",
      color: "#fff",
      createdAt: 9,
    });
  });
});

describe("loadPersisted / savePersisted", () => {
  it("returns defaults when empty or invalid JSON", () => {
    expect(loadPersisted()).toEqual(defaultPersisted());
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadPersisted()).toEqual(defaultPersisted());
  });

  it("round-trips sanitized persisted state", () => {
    const data = defaultPersisted();
    data.userName = "Samet";
    data.language = "tr";
    data.dayNight = "night";
    data.favoriteAssets = ["mars_boulder", "desk"];
    data.agents = [
      sampleAgent({
        chattiness: 200,
        enabled: undefined as unknown as boolean,
        characterId: "not-a-character",
        skills: [{ id: "", name: "Scout", content: "Look around" }] as never,
      }),
    ];
    data.chats = { a1: [{ role: "user", content: "hi" }] };
    data.graphics = {
      ...data.graphics,
      shadowQuality: "high",
      maxDpr: 4,
      antialias: false,
    };
    savePersisted(data);

    const loaded = loadPersisted();
    expect(loaded.userName).toBe("Samet");
    expect(loaded.language).toBe("tr");
    expect(loaded.dayNight).toBe("night");
    expect(loaded.favoriteAssets).toContain("space_boulder");
    expect(loaded.agents[0]?.chattiness).toBe(100);
    expect(loaded.agents[0]?.enabled).toBe(true);
    expect(loaded.agents[0]?.characterId).toBeTruthy();
    expect(loaded.agents[0]?.skills[0]?.id).toMatch(/^skill_/);
    expect(loaded.chats.a1?.[0]?.content).toBe("hi");
    expect(loaded.graphics.maxDpr).toBe(3);
    expect(loaded.graphics.antialias).toBe(false);
  });

  it("migrates legacy map ids and checker floors once", () => {
    const checkerMap = blankMap({
      id: "custom_old",
      name: "Old",
      floor: { size: 20, style: "checker", color: "#ccc", surface: "office" },
    });
    localStorage.removeItem(FLOOR_STYLE_MIGRATE_KEY);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mapId: "mars",
        customMaps: [checkerMap],
        language: "not-a-lang",
        dayNight: "dusk",
        graphics: { shadowQuality: "ultra", maxDpr: "bad" },
      }),
    );

    const loaded = loadPersisted();
    expect(loaded.mapId).toBe("space");
    expect(loaded.language).toBe(appConfig.defaults.language);
    expect(loaded.dayNight).toBe(appConfig.defaults.dayNight);
    expect(loaded.customMaps[0]?.floor.style).toBe("surface");
    expect(localStorage.getItem(FLOOR_STYLE_MIGRATE_KEY)).toBe("1");

    const again = blankMap({
      id: "custom_new",
      name: "New",
      floor: { size: 16, style: "checker", color: "#ddd", surface: "office" },
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mapId: "custom_new", customMaps: [again] }),
    );
    const second = loadPersisted();
    expect(second.customMaps[0]?.floor.style).toBe("checker");
  });

  it("falls back to default map when custom id is missing", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mapId: "custom_gone" }));
    expect(loadPersisted().mapId).toBe(appConfig.defaults.mapId);
  });
});

describe("uid", () => {
  it("prefixes a unique id", () => {
    const a = uid("agent");
    const b = uid();
    expect(a.startsWith("agent_")).toBe(true);
    expect(b.startsWith("id_")).toBe(true);
    expect(a).not.toBe(uid("agent"));
  });
});
