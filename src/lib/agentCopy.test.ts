import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@/lib/types";
import {
  createAgentCopy,
  nextCopyName,
  normalizeAgentName,
} from "@/lib/agentCopy";
import { sampleAgent } from "@/test/fixtures";

describe("normalizeAgentName", () => {
  it("trims, lowercases, and collapses spaces", () => {
    expect(normalizeAgentName("  Explorer  One ")).toBe("explorerone");
  });
});

describe("nextCopyName", () => {
  it("names the first copy with (label)", () => {
    expect(nextCopyName("Explorer", ["Explorer"], "copy")).toBe(
      "Explorer (copy)",
    );
  });

  it("uses (label 2) when the first copy name is taken", () => {
    expect(
      nextCopyName("Explorer", ["Explorer", "Explorer (copy)"], "copy"),
    ).toBe("Explorer (copy 2)");
  });

  it("reuses a gap in the sequence", () => {
    expect(
      nextCopyName(
        "Explorer",
        ["Explorer", "Explorer (copy 2)", "Explorer (copy 3)"],
        "copy",
      ),
    ).toBe("Explorer (copy)");
  });

  it("strips an existing copy suffix so copies never nest (copy)(copy)", () => {
    expect(
      nextCopyName(
        "Explorer (copy)",
        ["Explorer", "Explorer (copy)"],
        "copy",
      ),
    ).toBe("Explorer (copy 2)");
  });

  it("ignores case and spaces when checking taken names", () => {
    expect(
      nextCopyName("Explorer", ["Explorer", "explorer(COPY)"], "copy"),
    ).toBe("Explorer (copy 2)");
  });

  it("handles a source literally named (copy)", () => {
    expect(nextCopyName("(copy)", ["(copy)"], "copy")).toBe("(copy 2)");
  });

  it("gives (label) for a blank source", () => {
    expect(nextCopyName("   ", [], "copy")).toBe("(copy)");
    expect(nextCopyName("", ["(copy)"], "copy")).toBe("(copy 2)");
  });

  it("escapes regex characters in the label", () => {
    expect(nextCopyName("Bot (a+b)", ["Bot (a+b)"], "a+b")).toBe("Bot (a+b 2)");
  });
});

describe("createAgentCopy", () => {
  it("assigns a new id and createdAt while copying other fields", () => {
    const source = sampleAgent({
      skills: [{ id: "s1", name: "Style", content: "Be clear" }],
      thinkingEnabled: true,
      chattiness: 70,
    });
    const before = Date.now();
    const copy = createAgentCopy(source, [source], "copy");
    expect(copy.id).not.toBe(source.id);
    expect(copy.id.startsWith("agent_")).toBe(true);
    expect(copy.createdAt).toBeGreaterThanOrEqual(before);
    expect(copy.displayName).toBe("Explorer (copy)");
    expect(copy.modelConfigId).toBe(source.modelConfigId);
    expect(copy.polyPresetId).toBe(source.polyPresetId);
    expect(copy.characterId).toBe(source.characterId);
    expect(copy.systemPrompt).toBe(source.systemPrompt);
    expect(copy.enabled).toBe(source.enabled);
    expect(copy.thinkingEnabled).toBe(true);
    expect(copy.chattiness).toBe(70);
    expect(copy.color).toBe(source.color);
    expect(copy.bio).toBe(source.bio);
    expect(copy.skills).toEqual(source.skills);
  });

  it("deep-clones skills so mutations do not touch the source", () => {
    const source = sampleAgent({
      skills: [{ id: "s1", name: "Style", content: "Be clear" }],
    });
    const copy = createAgentCopy(source, [source], "copy");
    copy.skills[0]!.name = "Changed";
    copy.skills.push({ id: "s2", name: "Extra", content: "More" });
    expect(source.skills).toEqual([
      { id: "s1", name: "Style", content: "Be clear" },
    ]);
  });

  it("normalizes missing skills to an empty array", () => {
    const source = sampleAgent();
    const { skills: _ignored, ...rest } = source;
    const copy = createAgentCopy(
      rest as AgentConfig,
      [source],
      "copy",
    );
    expect(copy.skills).toEqual([]);
  });
});
