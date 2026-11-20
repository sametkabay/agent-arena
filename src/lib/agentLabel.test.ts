import { describe, expect, it } from "vitest";
import { agentLabel } from "@/lib/agentLabel";

const t = (key: string) => `t:${key}`;

describe("agentLabel", () => {
  it("returns the user-given name, never the role", () => {
    expect(agentLabel({ displayName: "Ada", polyPresetId: "explorer" }, t)).toBe("Ada");
    expect(agentLabel({ displayName: "  Ada Lovelace ", polyPresetId: "engineer" }, t)).toBe(
      "Ada Lovelace",
    );
  });

  it("falls back to the translated role name for a nameless agent", () => {
    expect(agentLabel({ displayName: "", polyPresetId: "explorer" }, t)).toBe(
      "t:poly.explorer.name",
    );
    expect(agentLabel({ displayName: "   ", polyPresetId: "custom" }, t)).toBe(
      "t:poly.custom.name",
    );
  });

  it("uses the preset default name when the translation is empty", () => {
    expect(agentLabel({ displayName: "", polyPresetId: "muse" }, () => "")).toBe("Muse");
  });
});
