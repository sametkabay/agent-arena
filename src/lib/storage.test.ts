import { afterEach, describe, expect, it, vi } from "vitest";
import { appConfig } from "@/lib/config";
import { blankMap } from "@/lib/maps/schema";
import {
  STORAGE_KEY,
  PersistFailedError,
  clampChattiness,
  clampTemperament,
  classifyStorageError,
  defaultPersisted,
  isPersistFailedError,
  loadPersisted,
  normalizeExtraHeaders,
  normalizePersistedModel,
  safeSetItem,
  savePersisted,
  sanitizeArenaChatHistory,
  sanitizeChats,
  storageFailureMessageKey,
  uid,
} from "@/lib/storage";
import { getPolyPreset } from "@/lib/poly/presets";
import { sampleAgent, sampleModel } from "@/test/fixtures";

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

describe("clampTemperament", () => {
  it("defaults missing/null/empty/NaN to 5 and clamps 1–10", () => {
    expect(clampTemperament(undefined)).toBe(5);
    expect(clampTemperament(null)).toBe(5);
    expect(clampTemperament("")).toBe(5);
    expect(clampTemperament("abc")).toBe(5);
    expect(clampTemperament(0)).toBe(1);
    expect(clampTemperament(11)).toBe(10);
    expect(clampTemperament(7.6)).toBe(8);
    expect(clampTemperament("3")).toBe(3);
    expect(clampTemperament(" 7 ")).toBe(7);
  });

  it("rejects blank strings, booleans, arrays, objects, Infinity, and NaN", () => {
    expect(clampTemperament("   ")).toBe(5);
    expect(clampTemperament("\t")).toBe(5);
    expect(clampTemperament(true)).toBe(5);
    expect(clampTemperament(false)).toBe(5);
    expect(clampTemperament([])).toBe(5);
    expect(clampTemperament([7])).toBe(5);
    expect(clampTemperament({})).toBe(5);
    expect(clampTemperament({ n: 7 })).toBe(5);
    expect(clampTemperament(Infinity)).toBe(5);
    expect(clampTemperament(-Infinity)).toBe(5);
    expect(clampTemperament(NaN)).toBe(5);
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

describe("normalizeExtraHeaders / normalizePersistedModel", () => {
  it("defaults missing, null, and non-array values to []", () => {
    expect(normalizeExtraHeaders(undefined)).toEqual([]);
    expect(normalizeExtraHeaders(null)).toEqual([]);
    expect(normalizeExtraHeaders("X-Org")).toEqual([]);
    expect(normalizeExtraHeaders(42)).toEqual([]);
  });

  it("drops malformed entries and coerces non-string values to empty string", () => {
    expect(
      normalizeExtraHeaders([
        { key: "X-Ok", value: "yes" },
        null,
        "skip",
        { key: 1, value: "nope" },
        { key: "X-Num", value: 7 },
        { key: "X-Null", value: null },
        ["not", "an", "object"],
      ]),
    ).toEqual([
      { key: "X-Ok", value: "yes" },
      { key: "X-Num", value: "" },
      { key: "X-Null", value: "" },
    ]);
  });

  it("preserves valid headers on a persisted model and fills missing extraHeaders", () => {
    expect(normalizePersistedModel(null)).toBeNull();
    expect(
      normalizePersistedModel({
        id: "m1",
        name: "Legacy",
        provider: "openai",
        baseUrl: "https://example.invalid/v1",
        modelId: "x",
      })?.extraHeaders,
    ).toEqual([]);
    expect(
      normalizePersistedModel({
        id: "m1",
        extraHeaders: [{ key: "X-Org", value: "acme" }],
      })?.extraHeaders,
    ).toEqual([{ key: "X-Org", value: "acme" }]);
  });
});

describe("agent name migration (#71)", () => {
  const legacy = (agents: unknown[], extra: Record<string, unknown> = {}) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ agents, ...extra }));
  const names = () => loadPersisted().agents.map((a) => a.displayName);

  it("renames legacy EN / TR / JA role names in order and keeps chat speakers", () => {
    legacy(
      [
        sampleAgent({ id: "a1", displayName: "Explorer" }),
        sampleAgent({ id: "a2", displayName: "Kaşif" }),
        sampleAgent({ id: "a3", displayName: "探検家" }),
        sampleAgent({ id: "a4", displayName: "Mühendis", polyPresetId: "engineer" }),
      ],
      {
        arenaChatHistory: [
          { id: "l1", kind: "agent", agentId: "a1", agentName: "Explorer", text: "hi", createdAt: 1 },
        ],
      },
    );
    const loaded = loadPersisted();
    expect(loaded.agents.map((a) => [a.id, a.displayName])).toEqual([
      ["a1", "Kai"],
      ["a2", "Mira"],
      ["a3", "Theo"],
      ["a4", "Iris"],
    ]);
    expect(loaded.agentNamesMigrated).toBe(true);
    expect(loaded.arenaChatHistory[0]?.agentName).toBe("Explorer");
  });

  it("leaves user-chosen names untouched", () => {
    legacy([
      sampleAgent({ id: "a1", displayName: "Bob the Explorer" }),
      sampleAgent({ id: "a2", displayName: "Engineer" }), // role name, but not its own role
    ]);
    expect(names()).toEqual(["Bob the Explorer", "Engineer"]);
  });

  it("gives duplicate role names distinct person names and fills empty names", () => {
    legacy([
      sampleAgent({ id: "a1", displayName: "Explorer" }),
      sampleAgent({ id: "a2", displayName: "Explorer" }),
      sampleAgent({ id: "a3", displayName: "  " }),
    ]);
    expect(names()).toEqual(["Kai", "Mira", "Theo"]);
  });

  it("skips pool names already taken by existing agents", () => {
    legacy([
      sampleAgent({ id: "a1", displayName: "Explorer" }),
      sampleAgent({ id: "a2", displayName: "Kai" }),
    ]);
    expect(names()).toEqual(["Mira", "Kai"]);
  });

  it("persists the result and never re-runs once flagged", () => {
    legacy([sampleAgent({ id: "a1", displayName: "Explorer" })]);
    expect(names()).toEqual(["Kai"]);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.agentNamesMigrated).toBe(true);
    expect(stored.agents[0].displayName).toBe("Kai");

    // User later deliberately names an agent after its role.
    stored.agents[0].displayName = "Explorer";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(names()).toEqual(["Explorer"]);
  });

  it("does not run when the flag is already set", () => {
    legacy([sampleAgent({ displayName: "Explorer" })], { agentNamesMigrated: true });
    expect(names()).toEqual(["Explorer"]);
  });

  it("fresh profiles start migrated with no agents", () => {
    expect(defaultPersisted().agentNamesMigrated).toBe(true);
    const loaded = loadPersisted();
    expect(loaded.agents).toEqual([]);
    expect(loaded.agentNamesMigrated).toBe(true);
  });

  it("is idempotent when loadPersisted runs twice at boot", () => {
    legacy([
      sampleAgent({ id: "a1", displayName: "Explorer" }),
      sampleAgent({ id: "a2", displayName: "Kaşif" }),
    ]);
    const first = loadPersisted();
    const second = loadPersisted();
    expect(first.agents.map((a) => a.displayName)).toEqual(["Kai", "Mira"]);
    expect(second.agents.map((a) => a.displayName)).toEqual(["Kai", "Mira"]);
    expect(second.agentNamesMigrated).toBe(true);
  });

  it("still returns migrated agents when the write-back hits a quota error", () => {
    legacy([sampleAgent({ id: "a1", displayName: "Explorer" })]);
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw typeof DOMException === "function"
        ? new DOMException("quota", "QuotaExceededError")
        : Object.assign(new Error("quota"), { name: "QuotaExceededError", code: 22 });
    });
    const loaded = loadPersisted();
    expect(loaded.agents[0]?.displayName).toBe("Kai");
    expect(loaded.agentNamesMigrated).toBe(true);
    // Deterministic on retry while disk is still legacy.
    expect(loadPersisted().agents[0]?.displayName).toBe("Kai");
    setItem.mockRestore();
    // Disk was never updated; a later successful persist must write the flag.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).agentNamesMigrated).not.toBe(true);
    expect(JSON.parse(raw!).agents[0].displayName).toBe("Explorer");
  });

  it("writes migrated agents and agentNamesMigrated after a failed write-back then successful save", () => {
    legacy([sampleAgent({ id: "a1", displayName: "Explorer" })]);
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw typeof DOMException === "function"
        ? new DOMException("quota", "QuotaExceededError")
        : Object.assign(new Error("quota"), { name: "QuotaExceededError", code: 22 });
    });
    const loaded = loadPersisted();
    setItem.mockRestore();
    expect(loaded.agents[0]?.displayName).toBe("Kai");
    expect(savePersisted(loaded)).toEqual({ ok: true });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.agentNamesMigrated).toBe(true);
    expect(stored.agents[0].displayName).toBe("Kai");
  });

  it("migrates legacy stock system prompts on load (Settings textarea)", () => {
    const legacyPrompt =
      "You are Explorer, a curious and adventurous guide in Agent Arena. You love discovering ideas, asking follow-up questions, and explaining things clearly. Keep answers friendly and vivid.";
    legacy([
      sampleAgent({
        id: "a1",
        displayName: "Kai",
        polyPresetId: "explorer",
        systemPrompt: legacyPrompt,
      }),
    ], { agentNamesMigrated: true });
    const loaded = loadPersisted();
    expect(loaded.agents[0]?.systemPrompt).toBe(
      getPolyPreset("explorer").defaultSystemPrompt,
    );
    expect(loaded.agents[0]?.systemPrompt).not.toContain("You are Explorer,");
  });

  it("maps a custom agent’s legacy explorer prompt to current explorer stock (keeps persona)", () => {
    const legacyPrompt =
      "You are Explorer, a curious and adventurous guide in Agent Arena. You love discovering ideas, asking follow-up questions, and explaining things clearly. Keep answers friendly and vivid.";
    legacy(
      [
        sampleAgent({
          id: "a1",
          displayName: "Ada",
          polyPresetId: "custom",
          systemPrompt: legacyPrompt,
        }),
      ],
      { agentNamesMigrated: true },
    );
    const prompt = loadPersisted().agents[0]!.systemPrompt;
    expect(prompt).toBe(getPolyPreset("explorer").defaultSystemPrompt);
    expect(prompt).toContain("curious and adventurous");
    expect(prompt).not.toBe(getPolyPreset("custom").defaultSystemPrompt);
  });

  it("does not rewrite a role agent that carries the unchanged Custom stock prompt", () => {
    const customStock = getPolyPreset("custom").defaultSystemPrompt;
    legacy(
      [
        sampleAgent({
          id: "a1",
          displayName: "Kai",
          polyPresetId: "engineer",
          systemPrompt: customStock,
        }),
      ],
      { agentNamesMigrated: true },
    );
    expect(loadPersisted().agents[0]!.systemPrompt).toBe(customStock);
  });

  it("renames Explorer and defaults polyPresetId when it is omitted or unknown", () => {
    // Rename checks the original (unknown/missing) preset first — all role
    // titles count — then polyPresetId is remapped to defaults.roleId.
    legacy([
      {
        ...sampleAgent({ id: "a1", displayName: "Explorer" }),
        polyPresetId: undefined,
      },
      {
        ...sampleAgent({ id: "a2", displayName: "Kai" }),
        polyPresetId: "not-a-role",
      },
    ]);
    const loaded = loadPersisted();
    expect(loaded.agents[0]?.displayName).not.toBe("Explorer");
    expect(loaded.agents[0]?.polyPresetId).toBe(appConfig.defaults.roleId);
    expect(loaded.agents[1]?.displayName).toBe("Kai");
    expect(loaded.agents[1]?.polyPresetId).toBe(appConfig.defaults.roleId);
  });

  it("renames non-default role titles when polyPresetId is missing or unknown", () => {
    legacy([
      {
        ...sampleAgent({ id: "a1", displayName: "Muse", polyPresetId: "muse" }),
        polyPresetId: undefined,
      },
      {
        ...sampleAgent({ id: "a2", displayName: "Engineer" }),
        polyPresetId: "not-a-role",
      },
      {
        ...sampleAgent({ id: "a3", displayName: "Custom" }),
        polyPresetId: { x: 1 },
      },
      {
        ...sampleAgent({ id: "a4", displayName: "Guardian" }),
        polyPresetId: "nope",
      },
    ]);
    const loaded = loadPersisted();
    expect(loaded.agents.map((a) => a.displayName)).toEqual([
      "Kai",
      "Mira",
      "Theo",
      "Iris",
    ]);
    for (const a of loaded.agents) {
      expect(a.polyPresetId).toBe(appConfig.defaults.roleId);
    }
  });

  it("handles whitespace, non-string names and odd preset ids without throwing", () => {
    legacy([
      { ...sampleAgent({ id: "a" }), displayName: "   " },
      { ...sampleAgent({ id: "b" }), displayName: 42 },
      { ...sampleAgent({ id: "c" }), displayName: null },
      { ...sampleAgent({ id: "d", displayName: "  Explorer  " }) },
      { ...sampleAgent({ id: "e", displayName: "Kai" }), polyPresetId: undefined },
      { ...sampleAgent({ id: "f", displayName: "Custom" }), polyPresetId: { x: 1 } },
    ]);
    const loaded = loadPersisted();
    // e: Kai kept; f: invalid preset → all-titles rename, then defaults.roleId
    expect(loaded.agents.map((a) => a.displayName)).toEqual([
      "Mira",
      "Theo",
      "Iris",
      "Omar",
      "Kai",
      "Lena",
    ]);
    expect(loaded.agents[4]?.polyPresetId).toBe(appConfig.defaults.roleId);
    expect(loaded.agents[5]?.polyPresetId).toBe(appConfig.defaults.roleId);
  });

  it("keeps the profile when one agent has a non-string systemPrompt", () => {
    legacy(
      [
        sampleAgent({ id: "a", displayName: "Ada" }),
        { ...sampleAgent({ id: "b", displayName: "Bo" }), systemPrompt: 42 },
        { ...sampleAgent({ id: "c", displayName: "Cy" }), systemPrompt: { x: 1 } },
      ],
      {
        agentNamesMigrated: true,
        userName: "Sam",
        models: [sampleModel()],
      },
    );
    const loaded = loadPersisted();
    expect(loaded.agents.map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(loaded.agents[1]!.systemPrompt).toBe("");
    expect(loaded.agents[2]!.systemPrompt).toBe("");
    expect(loaded.userName).toBe("Sam");
    expect(loaded.models).toHaveLength(1);
  });
});

describe("loadPersisted / savePersisted", () => {
  it("returns defaults when empty or invalid JSON", () => {
    expect(loadPersisted()).toEqual(defaultPersisted());
    expect(loadPersisted().chatterMode).toBe("off");
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadPersisted()).toEqual(defaultPersisted());
  });

  it("normalizes models without extraHeaders and malformed header entries", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        models: [
          {
            id: "m-missing",
            name: "Legacy",
            provider: "openai",
            baseUrl: "https://example.invalid/v1",
            modelId: "x",
            apiKey: "sk-test-FAKE-x",
            createdAt: 1,
          },
          {
            id: "m-null",
            name: "NullHeaders",
            provider: "openai",
            baseUrl: "https://example.invalid/v1",
            modelId: "y",
            extraHeaders: null,
            createdAt: 1,
          },
          {
            id: "m-string",
            name: "StringHeaders",
            provider: "openai",
            baseUrl: "https://example.invalid/v1",
            modelId: "z",
            extraHeaders: "nope",
            createdAt: 1,
          },
          {
            id: "m-malformed",
            name: "Mixed",
            provider: "openai",
            baseUrl: "https://example.invalid/v1",
            modelId: "w",
            extraHeaders: [
              { key: "X-Ok", value: "1" },
              { key: 9, value: "drop" },
              { key: "X-Bad", value: 3 },
              null,
            ],
            createdAt: 1,
          },
        ],
      }),
    );
    const loaded = loadPersisted();
    expect(loaded.models).toHaveLength(4);
    expect(loaded.models[0]?.extraHeaders).toEqual([]);
    expect(loaded.models[1]?.extraHeaders).toEqual([]);
    expect(loaded.models[2]?.extraHeaders).toEqual([]);
    expect(loaded.models[3]?.extraHeaders).toEqual([
      { key: "X-Ok", value: "1" },
      { key: "X-Bad", value: "" },
    ]);
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

  it("keeps unknown user: placeable ids and favorites on hydrate", () => {
    const data = defaultPersisted();
    const custom = blankMap({
      id: "custom_user_assets",
      name: "With user asset",
      floor: { size: 18, style: "surface", color: "#ccc", surface: "office" },
    });
    custom.placeables = [
      {
        id: "p1",
        placeableId: "user:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        position: [0, 0, 0],
        rotationY: 0,
      },
    ];
    data.customMaps = [custom];
    data.favoriteAssets = [
      "user:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "mars_boulder",
    ];
    savePersisted(data);
    const loaded = loadPersisted();
    expect(loaded.customMaps[0]?.placeables[0]?.placeableId).toBe(
      "user:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(loaded.favoriteAssets).toContain(
      "user:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(loaded.favoriteAssets).toContain("space_boulder");
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
        temperament: 99 as never,
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
    expect(loaded.agents[0]?.temperament).toBe(10);
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
