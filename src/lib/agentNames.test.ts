import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";
import { ALL_POLY_PRESETS } from "@/lib/poly/presets";
import {
  AGENT_NAME_POOL,
  isRoleDefaultName,
  migrateAgentNames,
  pickAgentName,
} from "@/lib/agentNames";

const localeModules = import.meta.glob("../i18n/*.json", {
  eager: true,
  import: "default",
}) as Record<string, { characters: Record<string, string>; poly: Record<string, { name: string }> }>;
const locales = Object.values(localeModules);

describe("agent name pool (agent-arena.yaml defaults.agentNamePool)", () => {
  it("is the agreed ordered list", () => {
    expect(appConfig.defaults.agentNamePool).toEqual([
      "Kai", "Mira", "Theo", "Iris", "Omar", "Lena",
      "Nico", "Zara", "Emil", "Juno", "Rosa", "Hugo",
    ]);
  });

  it("names are ASCII, 3–5 letters, and unique", () => {
    for (const n of AGENT_NAME_POOL) expect(n).toMatch(/^[A-Za-z]{3,5}$/);
    const lower = AGENT_NAME_POOL.map((n) => n.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it("never collides with a Look name or a role name in any locale", () => {
    expect(locales).toHaveLength(appConfig.languages.length);
    const reserved = new Set<string>();
    for (const l of locales) {
      for (const n of Object.values(l.characters)) reserved.add(n.trim().toLowerCase());
      for (const p of Object.values(l.poly)) reserved.add(p.name.trim().toLowerCase());
    }
    for (const p of ALL_POLY_PRESETS) reserved.add(p.defaultDisplayName.trim().toLowerCase());
    expect(reserved.has("alex")).toBe(true);
    expect(reserved.has("kaşif")).toBe(true);
    for (const n of AGENT_NAME_POOL) expect(reserved.has(n.toLowerCase()), n).toBe(false);
  });
});

describe("pickAgentName", () => {
  it("returns the first pool name when nothing is taken", () => {
    expect(pickAgentName([])).toBe("Kai");
  });

  it("skips taken names case-insensitively and trimmed", () => {
    expect(pickAgentName([" kai ", "MIRA"])).toBe("Theo");
    expect(pickAgentName(["Mira"])).toBe("Kai");
  });

  it("appends the first free number once the pool is exhausted", () => {
    const all = [...AGENT_NAME_POOL];
    expect(pickAgentName(all)).toBe("Kai 2");
    expect(pickAgentName([...all, "kai 2"])).toBe("Kai 3");
    expect(pickAgentName([...all, "Kai 3"])).toBe("Kai 2");
  });
});

describe("isRoleDefaultName", () => {
  it("matches the yaml default and every locale title of that preset", () => {
    expect(isRoleDefaultName("Explorer", "explorer")).toBe(true);
    expect(isRoleDefaultName("  explorer ", "explorer")).toBe(true);
    expect(isRoleDefaultName("Kaşif", "explorer")).toBe(true);
    expect(isRoleDefaultName("Entdecker", "explorer")).toBe(true);
    expect(isRoleDefaultName("探検家", "explorer")).toBe(true);
    expect(isRoleDefaultName("Mühendis", "engineer")).toBe(true);
  });

  it("checks every locale for every preset", () => {
    for (const p of ALL_POLY_PRESETS) {
      for (const l of locales) expect(isRoleDefaultName(l.poly[p.id].name, p.id)).toBe(true);
    }
  });

  it("also accepts the custom preset's names", () => {
    expect(isRoleDefaultName("Custom", "scout")).toBe(true);
    expect(isRoleDefaultName("Özel", "muse")).toBe(true);
  });

  it("rejects other roles' titles, real names, and blanks", () => {
    expect(isRoleDefaultName("Engineer", "explorer")).toBe(false);
    expect(isRoleDefaultName("Explorer Bob", "explorer")).toBe(false);
    expect(isRoleDefaultName("Kai", "explorer")).toBe(false);
    expect(isRoleDefaultName("   ", "explorer")).toBe(false);
  });
});

describe("migrateAgentNames", () => {
  const a = (displayName: string, polyPresetId = "explorer") => ({ displayName, polyPresetId });

  it("renames role-named and empty agents, keeps order and other names", () => {
    const { agents, changed } = migrateAgentNames([
      a("Explorer"),
      a("Ada's helper", "scout"),
      a("Kaşif"),
      a("", "muse"),
      a("探検家"),
    ]);
    expect(changed).toBe(true);
    expect(agents.map((x) => x.displayName)).toEqual([
      "Kai",
      "Ada's helper",
      "Mira",
      "Theo",
      "Iris",
    ]);
  });

  it("skips pool names already used by untouched agents", () => {
    const { agents } = migrateAgentNames([a("Explorer"), a("kai", "scout")]);
    expect(agents.map((x) => x.displayName)).toEqual(["Mira", "kai"]);
  });

  it("returns the same objects when nothing needs renaming", () => {
    const input = [a("Kai"), a("Bob")];
    const res = migrateAgentNames(input);
    expect(res.changed).toBe(false);
    expect(res.agents[0]).toBe(input[0]);
    expect(res.agents[1]).toBe(input[1]);
  });
});
