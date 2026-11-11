import { describe, expect, it } from "vitest";
import { sampleAgent } from "@/test/fixtures";
import { DEFAULT_CHARACTER_ID } from "@/lib/assets/characters";
import { getPolyPreset } from "@/lib/poly/presets";
import {
  ROSTER_FORMAT,
  ROSTER_LIMITS,
  ROSTER_VERSION,
  RosterImportError,
  applyAllModelIds,
  buildRosterExport,
  parseRosterImport,
  remapModelIds,
  resolveImportNames,
  rosterExportFileName,
} from "@/lib/agentRoster";

function parseOk(text: string, opts?: Parameters<typeof parseRosterImport>[1]) {
  return parseRosterImport(text, opts);
}

function exportThenParse(agents = [sampleAgent()]) {
  const json = buildRosterExport(agents);
  return { json, parsed: JSON.parse(json), result: parseOk(json) };
}

describe("buildRosterExport", () => {
  it("omits id, modelConfigId, createdAt, apiKey and skill ids", () => {
    const agent = sampleAgent({
      id: "secret-id",
      modelConfigId: "model-secret",
      createdAt: 99,
      skills: [{ id: "skill-1", name: "Scout", content: "Look around." }],
    });
    const { json, parsed } = exportThenParse([agent]);
    expect(parsed.format).toBe(ROSTER_FORMAT);
    expect(parsed.version).toBe(ROSTER_VERSION);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(json).not.toContain("secret-id");
    expect(json).not.toContain("model-secret");
    expect(json).not.toMatch(/"createdAt"/);
    expect(json).not.toMatch(/"apiKey"/);
    expect(json).not.toMatch(/"modelConfigId"/);
    expect(json).not.toMatch(/"id"/);
    expect(parsed.agents[0].skills[0]).toEqual({
      name: "Scout",
      content: "Look around.",
    });
    expect(parsed.agents[0].skills[0].id).toBeUndefined();
  });

  it("pretty-prints JSON", () => {
    const json = buildRosterExport([sampleAgent()]);
    expect(json).toContain("\n");
    expect(json.startsWith("{")).toBe(true);
  });
});

describe("rosterExportFileName", () => {
  it("uses YYYYMMDD and .aa-agents.json suffix", () => {
    expect(rosterExportFileName(new Date("2026-11-11T12:00:00Z"))).toBe(
      "agent-arena-agents-20261111.aa-agents.json",
    );
  });
});

describe("parseRosterImport errors", () => {
  it("rejects oversized files before trusting content", () => {
    expect(() =>
      parseOk("{}", { fileSize: ROSTER_LIMITS.maxFileBytes + 1 }),
    ).toThrow(RosterImportError);
    try {
      parseOk("{}", { fileSize: ROSTER_LIMITS.maxFileBytes + 1 });
    } catch (e) {
      expect((e as RosterImportError).code).toBe("tooLarge");
    }
  });

  it("rejects non-JSON text", () => {
    expect(() => parseOk("not json {{{")).toThrow(
      expect.objectContaining({ code: "invalidJson" }),
    );
  });

  it("rejects null, array, and string roots", () => {
    for (const text of ["null", "[]", '"hello"']) {
      expect(() => parseOk(text)).toThrow(
        expect.objectContaining({ code: "wrongFormat" }),
      );
    }
  });

  it("rejects wrong format and unsupported version", () => {
    expect(() =>
      parseOk(
        JSON.stringify({
          format: "other",
          version: 1,
          agents: [{ displayName: "A" }],
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "wrongFormat" }));

    expect(() =>
      parseOk(
        JSON.stringify({
          format: ROSTER_FORMAT,
          version: 2,
          agents: [{ displayName: "A" }],
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "unsupportedVersion" }));
  });

  it("rejects empty lists and more than 50 agents", () => {
    expect(() =>
      parseOk(
        JSON.stringify({ format: ROSTER_FORMAT, version: 1, agents: [] }),
      ),
    ).toThrow(expect.objectContaining({ code: "empty" }));

    const agents = Array.from({ length: 51 }, (_, i) => ({
      displayName: `A${i}`,
    }));
    expect(() =>
      parseOk(JSON.stringify({ format: ROSTER_FORMAT, version: 1, agents })),
    ).toThrow(expect.objectContaining({ code: "tooMany" }));
  });

  it("rejects when existing + import would exceed 100", () => {
    const agents = Array.from({ length: 3 }, (_, i) => ({
      displayName: `A${i}`,
    }));
    expect(() =>
      parseOk(
        JSON.stringify({ format: ROSTER_FORMAT, version: 1, agents }),
        { existingCount: 98 },
      ),
    ).toThrow(expect.objectContaining({ code: "tooManyTotal" }));
  });
});

describe("parseRosterImport sanitize", () => {
  it("drops unknown fields and sanitizes chattiness, color, character, lengths", () => {
    // Raw string so "__proto__" is a real own key (object-literal __proto__ is not).
    const json = [
      "{",
      `"format":${JSON.stringify(ROSTER_FORMAT)},`,
      `"version":1,`,
      `"agents":[`,
      "{",
      `"displayName":"  Ada  ",`,
      `"polyPresetId":"not-a-role",`,
      `"characterId":"nope",`,
      `"systemPrompt":${JSON.stringify("x".repeat(ROSTER_LIMITS.systemPromptMax + 10))},`,
      `"bio":${JSON.stringify("y".repeat(ROSTER_LIMITS.bioMax + 5))},`,
      `"color":"red",`,
      `"chattiness":-5,`,
      `"thinkingEnabled":"yes",`,
      `"enabled":false,`,
      `"apiKey":"sk-leak",`,
      `"modelConfigId":"m1",`,
      `"id":"old",`,
      `"createdAt":1,`,
      `"__proto__":{"polluted":true},`,
      `"extra":true,`,
      `"skills":[`,
      `{"id":"old-skill","name":"A","content":"B"},`,
      `{"name":"","content":""},`,
      `{"name":${JSON.stringify("n".repeat(80))},"content":${JSON.stringify("c".repeat(5000))}}`,
      `]`,
      "},",
      `{"displayName":"   ","systemPrompt":"skip me"},`,
      `{"displayName":"Bo","chattiness":300},`,
      "{",
      `"displayName":"Cy",`,
      `"chattiness":"50",`,
      `"color":"#AABBCC",`,
      `"polyPresetId":"engineer",`,
      `"characterId":"generic-female",`,
      `"thinkingEnabled":true,`,
      `"enabled":true`,
      "}",
      "]}",
    ].join("");

    const result = parseOk(json);
    expect(result.skipped).toBe(1);
    expect(result.agents).toHaveLength(3);

    const ada = result.agents[0]!;
    expect(ada.displayName).toBe("Ada");
    expect(ada.polyPresetId).toBe("explorer");
    expect(ada.characterId).toBe(DEFAULT_CHARACTER_ID);
    expect(ada.systemPrompt).toHaveLength(ROSTER_LIMITS.systemPromptMax);
    expect(ada.bio).toHaveLength(ROSTER_LIMITS.bioMax);
    expect(ada.color).toBe(getPolyPreset("explorer").defaultColor);
    expect(ada.chattiness).toBe(0);
    expect(ada.thinkingEnabled).toBe(false);
    expect(ada.enabled).toBe(false);
    expect(ada.skills).toHaveLength(2);
    expect(ada.skills[0]!.id).toMatch(/^skill_/);
    expect(ada.skills[0]!.id).not.toBe("old-skill");
    expect(ada.skills[1]!.name).toHaveLength(ROSTER_LIMITS.skillNameMax);
    expect(ada.skills[1]!.content).toHaveLength(ROSTER_LIMITS.skillContentMax);
    expect((ada as { apiKey?: string }).apiKey).toBeUndefined();
    expect((ada as { modelConfigId?: string }).modelConfigId).toBeUndefined();
    expect(
      (Object.prototype as { polluted?: boolean }).polluted,
    ).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(ada)).toBe(Object.prototype);

    expect(result.agents[1]!.chattiness).toBe(100);
    expect(result.agents[2]!.chattiness).toBe(50);
    expect(result.agents[2]!.color).toBe("#AABBCC");
    expect(result.agents[2]!.polyPresetId).toBe("engineer");
    expect(result.agents[2]!.characterId).toBe("generic-female");
    expect(result.agents[2]!.thinkingEnabled).toBe(true);
  });

  it("caps skills at 10", () => {
    const skills = Array.from({ length: 15 }, (_, i) => ({
      name: `S${i}`,
      content: `C${i}`,
    }));
    const result = parseOk(
      JSON.stringify({
        format: ROSTER_FORMAT,
        version: 1,
        agents: [{ displayName: "Ada", skills }],
      }),
    );
    expect(result.agents[0]!.skills).toHaveLength(10);
  });

  it("clips displayName to 40 chars", () => {
    const result = parseOk(
      JSON.stringify({
        format: ROSTER_FORMAT,
        version: 1,
        agents: [{ displayName: "N".repeat(50) }],
      }),
    );
    expect(result.agents[0]!.displayName).toHaveLength(40);
  });
});

describe("remap helpers", () => {
  it("applyAllModelIds fills every row", () => {
    expect(applyAllModelIds(3, "m2")).toEqual(["m2", "m2", "m2"]);
    expect(applyAllModelIds(0, "m2")).toEqual([]);
  });

  it("remapModelIds falls back to models[0] for unknown ids", () => {
    expect(remapModelIds(["m2", "missing", "m1"], ["m1", "m2"])).toEqual([
      "m2",
      "m1",
      "m1",
    ]);
  });
});

describe("resolveImportNames", () => {
  it("keeps non-colliding names and suffixes collisions", () => {
    expect(resolveImportNames(["Ada", "Bo"], ["Cy"], "copy")).toEqual([
      "Ada",
      "Bo",
    ]);
    expect(resolveImportNames(["Ada", "Bo"], ["Ada"], "copy")).toEqual([
      "Ada (copy)",
      "Bo",
    ]);
  });

  it("handles collisions within the import batch", () => {
    expect(resolveImportNames(["Ada", "Ada"], [], "copy")).toEqual([
      "Ada",
      "Ada (copy)",
    ]);
  });

  it("normalizes names when detecting collisions", () => {
    expect(resolveImportNames(["A da"], ["ada"], "copy")).toEqual([
      "A da (copy)",
    ]);
  });
});

describe("round-trip", () => {
  it("preserves persona fields with fresh skill ids", () => {
    const source = sampleAgent({
      displayName: "Ada",
      thinkingEnabled: true,
      skills: [{ id: "s1", name: "Code", content: "Be clear." }],
      bio: "Curious.",
    });
    const { result } = exportThenParse([source]);
    const imported = result.agents[0]!;
    expect(imported.displayName).toBe(source.displayName);
    expect(imported.polyPresetId).toBe(source.polyPresetId);
    expect(imported.characterId).toBe(source.characterId);
    expect(imported.systemPrompt).toBe(source.systemPrompt);
    expect(imported.bio).toBe(source.bio);
    expect(imported.color).toBe(source.color);
    expect(imported.chattiness).toBe(source.chattiness);
    expect(imported.thinkingEnabled).toBe(true);
    expect(imported.enabled).toBe(true);
    expect(imported.skills[0]!.name).toBe("Code");
    expect(imported.skills[0]!.content).toBe("Be clear.");
    expect(imported.skills[0]!.id).not.toBe("s1");
  });
});
