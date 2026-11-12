import { afterEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "@/lib/config";
import { blankMap } from "@/lib/maps/schema";
import {
  STORAGE_KEY,
  PersistFailedError,
  clampChattiness,
  classifyStorageError,
  defaultPersisted,
  isPersistFailedError,
  loadPersisted,
  safeSetItem,
  savePersisted,
  sanitizeArenaChatHistory,
  sanitizeChats,
  storageFailureMessageKey,
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

describe("classifyStorageError", () => {
  it("detects quota across browsers", () => {
    expect(
      classifyStorageError(
        Object.assign(new Error("full"), { name: "QuotaExceededError", code: 22 }),
      ),
    ).toBe("quota");
    expect(
      classifyStorageError(
        Object.assign(new Error("full"), {
          name: "NS_ERROR_DOM_QUOTA_REACHED",
          code: 1014,
        }),
      ),
    ).toBe("quota");
    expect(classifyStorageError({ name: "Error", code: 22 })).toBe("quota");
    expect(classifyStorageError({ name: "Error", code: 1014 })).toBe("quota");
  });

  it("detects unavailable / SecurityError", () => {
    expect(
      classifyStorageError(
        Object.assign(new Error("denied"), { name: "SecurityError", code: 18 }),
      ),
    ).toBe("unavailable");
    expect(classifyStorageError({ name: "SecurityError" })).toBe("unavailable");
  });

  it("returns unknown for other errors", () => {
    expect(classifyStorageError(null)).toBe("unknown");
    expect(classifyStorageError(new Error("boom"))).toBe("unknown");
    expect(classifyStorageError({ name: "TypeError", code: 0 })).toBe("unknown");
  });
});

describe("loadPersisted / savePersisted", () => {
  it("returns defaults when empty or invalid JSON", () => {
    expect(loadPersisted()).toEqual(defaultPersisted());
    expect(loadPersisted().chatterMode).toBe("off");
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadPersisted()).toEqual(defaultPersisted());
  });

  it("migrates chatterMode from legacy idleChatterEnabled", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userName: "Samet" }));
    expect(loadPersisted().chatterMode).toBe("off");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ idleChatterEnabled: true }),
    );
    expect(loadPersisted().chatterMode).toBe("idle");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ idleChatterEnabled: false }),
    );
    expect(loadPersisted().chatterMode).toBe("off");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chatterMode: "conversation", idleChatterEnabled: true }),
    );
    expect(loadPersisted().chatterMode).toBe("conversation");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chatterMode: "loud", idleChatterEnabled: true }),
    );
    expect(loadPersisted().chatterMode).toBe("idle");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chatterMode: "nope" }),
    );
    expect(loadPersisted().chatterMode).toBe("off");
  });

  it("round-trips chatterMode without the legacy field", () => {
    const data = defaultPersisted();
    data.chatterMode = "conversation";
    expect(savePersisted(data)).toEqual({ ok: true });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.chatterMode).toBe("conversation");
    expect(raw.idleChatterEnabled).toBeUndefined();
    expect(loadPersisted().chatterMode).toBe("conversation");
  });

  it("returns quota when setItem throws QuotaExceededError", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      const err =
        typeof DOMException === "function"
          ? new DOMException("The quota has been exceeded.", "QuotaExceededError")
          : Object.assign(new Error("The quota has been exceeded."), {
              name: "QuotaExceededError",
              code: 22,
            });
      throw err;
    });
    expect(savePersisted(defaultPersisted())).toEqual({
      ok: false,
      reason: "quota",
    });
    spy.mockRestore();
  });

  it("returns unavailable when setItem throws SecurityError", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw Object.assign(new Error("denied"), {
        name: "SecurityError",
        code: 18,
      });
    });
    expect(savePersisted(defaultPersisted())).toEqual({
      ok: false,
      reason: "unavailable",
    });
    spy.mockRestore();
  });

  it("returns unknown for other setItem failures", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new TypeError("nope");
    });
    expect(savePersisted(defaultPersisted())).toEqual({
      ok: false,
      reason: "unknown",
    });
    spy.mockRestore();
  });

  it("safeSetItem never throws and classifies quota", () => {
    expect(safeSetItem("aa-safe", "ok")).toEqual({ ok: true });
    expect(localStorage.getItem("aa-safe")).toBe("ok");

    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError",
      );
    });
    expect(safeSetItem("aa-safe", "nope")).toEqual({
      ok: false,
      reason: "quota",
    });
    spy.mockRestore();
  });

  it("isPersistFailedError recognizes PersistFailedError and code shape", () => {
    expect(isPersistFailedError(new PersistFailedError())).toBe(true);
    expect(
      isPersistFailedError(
        Object.assign(new Error("persist_failed"), { code: "persist_failed" }),
      ),
    ).toBe(true);
    expect(isPersistFailedError(new Error("other"))).toBe(false);
    expect(isPersistFailedError(null)).toBe(false);
  });

  it("storageFailureMessageKey picks quota / unavailable / unknown copy", () => {
    expect(storageFailureMessageKey("quota")).toBe("storage.quotaExceeded");
    expect(storageFailureMessageKey("unavailable")).toBe("storage.unavailable");
    expect(storageFailureMessageKey("unknown")).toBe("storage.writeFailed");
    expect(storageFailureMessageKey("quota", "map")).toBe("mapEditor.saveFailed");
    expect(storageFailureMessageKey("unavailable", "map")).toBe(
      "mapEditor.saveFailedUnavailable",
    );
    expect(storageFailureMessageKey("unknown", "map")).toBe(
      "mapEditor.saveFailedUnknown",
    );
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

  it("defaults onboarding flags to false for new users", () => {
    const data = defaultPersisted();
    expect(data.onboardingSeen).toBe(false);
    expect(data.controlsHelpSeen).toBe(false);
  });

  it("round-trips onboardingSeen and controlsHelpSeen", () => {
    const data = defaultPersisted();
    data.onboardingSeen = true;
    data.controlsHelpSeen = true;
    savePersisted(data);
    const loaded = loadPersisted();
    expect(loaded.onboardingSeen).toBe(true);
    expect(loaded.controlsHelpSeen).toBe(true);
  });

  it("infers legacy blob flags from models/agents presence", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ models: [{ id: "m1" }], agents: [] }),
    );
    expect(loadPersisted().onboardingSeen).toBe(true);
    expect(loadPersisted().controlsHelpSeen).toBe(false);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        models: [],
        agents: [sampleAgent()],
      }),
    );
    expect(loadPersisted().onboardingSeen).toBe(false);
    expect(loadPersisted().controlsHelpSeen).toBe(true);
  });

  it("keeps explicit false even when models/agents exist", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        models: [{ id: "m1" }],
        agents: [sampleAgent()],
        onboardingSeen: false,
        controlsHelpSeen: false,
      }),
    );
    const loaded = loadPersisted();
    expect(loaded.onboardingSeen).toBe(false);
    expect(loaded.controlsHelpSeen).toBe(false);
  });

  it("treats non-boolean onboarding flags as missing", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        models: [{ id: "m1" }],
        agents: [sampleAgent()],
        onboardingSeen: "yes",
        controlsHelpSeen: 1,
      }),
    );
    const loaded = loadPersisted();
    expect(loaded.onboardingSeen).toBe(true);
    expect(loaded.controlsHelpSeen).toBe(true);
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
