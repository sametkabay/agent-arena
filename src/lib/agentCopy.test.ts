import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@/lib/types";
import {
  AGENT_COPY_LABELS,
  createAgentCopy,
  nextCopyName,
  normalizeAgentName,
  stripCopySuffix,
} from "@/lib/agentCopy";
import { sampleAgent } from "@/test/fixtures";

describe("normalizeAgentName", () => {
  it("trims, lowercases, and collapses spaces", () => {
    expect(normalizeAgentName("  Explorer  One ")).toBe("explorerone");
  });
});

describe("AGENT_COPY_LABELS", () => {
  it("includes every bundled locale copyLabel", () => {
    for (const label of [
      "copy",
      "kopya",
      "copia",
      "副本",
      "cópia",
      "copie",
      "Kopie",
      "コピー",
      "사본",
      "копия",
    ]) {
      expect(AGENT_COPY_LABELS).toContain(label);
    }
    expect(AGENT_COPY_LABELS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("stripCopySuffix", () => {
  it("strips any locale copy suffix", () => {
    expect(stripCopySuffix("Explorer (copy)", "kopya")).toBe("Explorer");
    expect(stripCopySuffix("Explorer (kopya)", "copy")).toBe("Explorer");
    expect(stripCopySuffix("Explorer (копия 2)", "copy")).toBe("Explorer");
    expect(stripCopySuffix("Explorer (コピー)", "copy")).toBe("Explorer");
    expect(stripCopySuffix("Explorer (副本)", "copy")).toBe("Explorer");
  });

  it("leaves non-copy parentheticals intact", () => {
    expect(stripCopySuffix("Bot (beta)", "copy")).toBe("Bot (beta)");
    expect(stripCopySuffix("Agent (v2)", "kopya")).toBe("Agent (v2)");
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

  it("strips an English suffix when renaming in Turkish (en→tr)", () => {
    expect(
      nextCopyName("Explorer (copy)", ["Explorer", "Explorer (copy)"], "kopya"),
    ).toBe("Explorer (kopya)");
  });

  it("strips a Turkish suffix when renaming in English (tr→en)", () => {
    expect(
      nextCopyName(
        "Explorer (kopya)",
        ["Explorer", "Explorer (kopya)"],
        "copy",
      ),
    ).toBe("Explorer (copy)");
  });

  it("uses the next free number in the current locale when that name is taken", () => {
    expect(
      nextCopyName(
        "Explorer (copy)",
        ["Explorer", "Explorer (copy)", "Explorer (kopya)"],
        "kopya",
      ),
    ).toBe("Explorer (kopya 2)");
  });

  it("strips Russian and CJK copy suffixes", () => {
    expect(
      nextCopyName("Scout (копия)", ["Scout", "Scout (копия)"], "copy"),
    ).toBe("Scout (copy)");
    expect(
      nextCopyName("Scout (コピー)", ["Scout", "Scout (コピー)"], "copy"),
    ).toBe("Scout (copy)");
    expect(
      nextCopyName("Scout (副本)", ["Scout", "Scout (副本)"], "copy"),
    ).toBe("Scout (copy)");
    expect(
      nextCopyName("Scout (사본 2)", ["Scout", "Scout (사본 2)"], "copy"),
    ).toBe("Scout (copy)");
  });

  it("keeps legitimate non-copy parentheses intact", () => {
    expect(nextCopyName("Bot (beta)", ["Bot (beta)"], "copy")).toBe(
      "Bot (beta) (copy)",
    );
  });

  it("ignores case and spaces when checking taken names", () => {
    expect(
      nextCopyName("Explorer", ["Explorer", "explorer(COPY)"], "copy"),
    ).toBe("Explorer (copy 2)");
  });

  it("strips copy suffixes case-insensitively", () => {
    expect(
      nextCopyName("Explorer (COPY)", ["Explorer", "Explorer (COPY)"], "kopya"),
    ).toBe("Explorer (kopya)");
    expect(
      nextCopyName("Explorer (Kopie)", ["Explorer", "Explorer (Kopie)"], "copy"),
    ).toBe("Explorer (copy)");
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

  it("uses cross-locale stripping when creating a copy", () => {
    const source = sampleAgent({ displayName: "Explorer (copy)" });
    const copy = createAgentCopy(source, [source], "kopya");
    expect(copy.displayName).toBe("Explorer (kopya)");
  });
});
