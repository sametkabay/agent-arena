import { describe, expect, it } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";
import { defaultPersisted } from "@/lib/storage";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { resetPersisted } from "@/lib/reset";

function seededPersisted() {
  const custom = blankMap({
    id: "custom_reset",
    name: "Custom",
    floor: { size: 20, style: "surface", color: "#111", surface: "office" },
  });
  return {
    ...defaultPersisted(),
    userName: "Samet",
    language: "tr" as const,
    dayNight: "night" as const,
    chatterMode: "idle" as const,
    onboardingSeen: true,
    controlsHelpSeen: true,
    models: [sampleModel({ apiKey: "sk-test-FAKE-0001" })],
    agents: [sampleAgent()],
    customMaps: [custom],
    mapId: custom.id,
    graphics: {
      ...DEFAULT_GRAPHICS,
      castShadows: false,
      shadowQuality: "high" as const,
      maxDpr: 3,
    },
    favoriteAssets: ["desk"],
    chats: { "agent-1": [{ role: "user" as const, content: "hi" }] },
    arenaChatHistory: [
      {
        id: "flog_1",
        agentName: "Explorer",
        color: "#fff",
        text: "yo",
        createdAt: 1,
        kind: "agent" as const,
      },
    ],
  };
}

describe("resetPersisted", () => {
  it("clears models when keepModels is off", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: false });
    expect(next.models).toEqual([]);
  });

  it("keeps models (and keys) when keepModels is on", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: true });
    expect(next.models).toEqual(cur.models);
    expect(next.models[0]?.apiKey).toBe("sk-test-FAKE-0001");
  });

  it("keeps name, language, dayNight, and seen flags", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: false });
    expect(next.userName).toBe("Samet");
    expect(next.language).toBe("tr");
    expect(next.dayNight).toBe("night");
    expect(next.onboardingSeen).toBe(true);
    expect(next.controlsHelpSeen).toBe(true);
  });

  it("returns chatterMode to defaultPersisted() even when it was non-default", () => {
    const cur = seededPersisted();
    expect(cur.chatterMode).not.toBe(defaultPersisted().chatterMode);
    const next = resetPersisted(cur, { keepModels: false });
    expect(next.chatterMode).toBe(defaultPersisted().chatterMode);
  });

  it("resets mapId to the builtin default and clears custom maps", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: false });
    expect(next.mapId).toBe(appConfig.defaults.mapId);
    expect(next.customMaps).toEqual([]);
  });

  it("restores default graphics", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: false });
    expect(next.graphics).toEqual({ ...DEFAULT_GRAPHICS });
  });

  it("clears agents, favorites, chats, and arena history", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: false });
    expect(next.agents).toEqual([]);
    expect(next.favoriteAssets).toEqual([]);
    expect(next.chats).toEqual({});
    expect(next.arenaChatHistory).toEqual([]);
  });

  it("does not mutate the input", () => {
    const cur = seededPersisted();
    const before = structuredClone(cur);
    resetPersisted(cur, { keepModels: false });
    expect(cur).toEqual(before);
  });

  it("output keys match defaultPersisted()", () => {
    const cur = seededPersisted();
    const next = resetPersisted(cur, { keepModels: true });
    expect(Object.keys(next).sort()).toEqual(
      Object.keys(defaultPersisted()).sort(),
    );
  });
});
