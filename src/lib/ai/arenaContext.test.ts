import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  buildArenaWorldContext,
  buildSituationUserPrefix,
  buildTemperamentLine,
  describeAgentBrief,
  getArenaWorldContext,
  languageLabel,
  personalizeAgentPrompt,
  withSituationUserMessage,
  worldContextFromMapAndAgents,
} from "@/lib/ai/arenaContext";
import { buildSystemPrompt } from "@/lib/ai/providers";
import { prompts } from "@/lib/config";
import { getPolyPreset } from "@/lib/poly/presets";
import { sampleAgent, sampleMap } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

const CIVILITY_AGREEABLE = prompts.temperament.civilityAgreeable;
const CIVILITY_BLUNT = prompts.temperament.civilityBlunt;
const LEVEL_9_LINE = buildTemperamentLine(9);

const world = {
  userName: "Samet",
  language: "en" as const,
  mapName: "Office",
  mapDescription: "Desks and a cat",
  mapAreas: ["Lounge"],
  dayNight: "day" as const,
  otherAgents: [{ name: "Scout", role: "Explorer", blurb: "Maps caves." }],
};

describe("describeAgentBrief", () => {
  it("prefers bio, then cleaned system prompt", () => {
    expect(describeAgentBrief(sampleAgent()).blurb).toContain("Maps caves");
    // First sentence only; role name stripped → empty (no second-person leftover).
    const fromPrompt = describeAgentBrief(
      sampleAgent({ bio: "  ", systemPrompt: "You are Scout. Keep it short." }),
    );
    expect(fromPrompt.blurb).toBe("");
    const empty = describeAgentBrief(
      sampleAgent({ bio: undefined, systemPrompt: "   " }),
    );
    expect(empty.blurb).toBe("");
  });

  it("keeps the persona description when bio is empty (all 8 roles)", () => {
    const expected: Record<string, string> = {
      explorer: "A curious and adventurous guide in Agent Arena.",
      engineer: "A practical problem-solver.",
      botanist: "Calm and observant.",
      scholar: "Thoughtful and well-read.",
      artisan: "Creative and hands-on.",
      guardian: "Steady and protective.",
      scout: "Energetic and decisive.",
      muse: "Imaginative and encouraging.",
    };
    for (const id of Object.keys(expected)) {
      const p = getPolyPreset(id);
      const { blurb } = describeAgentBrief(
        sampleAgent({
          bio: "",
          polyPresetId: id,
          systemPrompt: p.defaultSystemPrompt,
        }),
      );
      expect(blurb, id).toBe(expected[id]);
      expect(blurb.toLowerCase().startsWith("you ")).toBe(false);
    }
  });

  it("clips long bios", () => {
    const long = "x".repeat(prompts.briefs.bioMax + 40);
    const { blurb } = describeAgentBrief(sampleAgent({ bio: long }));
    expect(blurb.endsWith("…")).toBe(true);
    expect(blurb.length).toBeLessThanOrEqual(prompts.briefs.bioMax);
  });

  it("does not cut the first sentence after common abbreviations (Dr., Mr., …)", () => {
    const { blurb } = describeAgentBrief(
      sampleAgent({
        bio: "",
        polyPresetId: "custom",
        displayName: "Ada",
        systemPrompt: "You are Dr. Smith, a surgeon. Stay calm.",
      }),
    );
    expect(blurb).not.toBe("Dr.");
    expect(blurb.toLowerCase()).toContain("surgeon");
  });
});

describe("world context builders", () => {
  it("formats session facts and situation prefix", () => {
    const block = buildArenaWorldContext(world);
    expect(block).toContain("Samet");
    expect(block).toContain("Office");
    expect(block).toContain("Lounge");
    expect(block).toContain("Scout");

    const emptyPeople = buildArenaWorldContext({ ...world, otherAgents: [], mapAreas: [] });
    expect(emptyPeople).toContain(prompts.labels.none);

    const prefix = buildSituationUserPrefix(world, "private_chat");
    expect(prefix).toContain("Samet");
    expect(prefix).toContain(prompts.situation.footer.trim());
    expect(prefix).not.toContain(prompts.situation.footerConversation.trim());

    const conversation = buildSituationUserPrefix(world, "arena_conversation");
    expect(conversation).toContain(prompts.situation.footerConversation.trim());
    expect(conversation).not.toContain(prompts.situation.footer.trim());
    expect(buildArenaWorldContext(world, "arena_conversation")).toContain(
      prompts.session.speechDisciplineConversation.trim(),
    );
    expect(buildArenaWorldContext(world, "private_chat")).toContain(
      prompts.session.speechDiscipline.trim(),
    );
    expect(buildArenaWorldContext(world, "private_chat")).not.toContain(
      prompts.session.speechDisciplineConversation.trim(),
    );

    const night = buildSituationUserPrefix(
      { ...world, dayNight: "night", otherAgents: [], mapAreas: [] },
      "idle_mutter",
    );
    expect(night.toLowerCase()).toMatch(/night|evening|dark/);
  });

  it("builds a system prompt with skills", () => {
    const prompt = buildAgentSystemPrompt({
      agentPrompt: "Stay curious.",
      agentName: "Explorer",
      world,
      mode: "private_chat",
      temperament: 5,
      skills: [
        { id: "s1", name: "Map reading", content: "Always name the zone." },
        { id: "s2", name: "  ", content: "  " },
      ],
    });
    expect(prompt).toContain("Stay curious");
    expect(prompt).toContain("Map reading");
    expect(prompt).toContain("Always name the zone");
    const untitled = buildAgentSystemPrompt({
      agentPrompt: "Stay curious.",
      agentName: "Explorer",
      world,
      mode: "arena_mention",
      temperament: 5,
      skills: [{ id: "s3", name: "", content: "Nameless skill body." }],
    });
    expect(untitled).toContain(prompts.skills.untitled);

    const sameName = buildArenaWorldContext({
      ...world,
      otherAgents: [{ name: "Explorer", role: "Explorer", blurb: "" }],
    });
    expect(sameName).toContain("Explorer");
  });

  it("snapshots agents on a map", () => {
    const map = sampleMap({
      name: "Camp",
      description: "Trees",
      zones: [{ id: "z", name: "Fire pit", kind: "camp", center: [0, 0, 0], radius: 2 }],
    });
    const self = sampleAgent({ id: "self", displayName: "Me" });
    const other = sampleAgent({ id: "other", displayName: "  ", enabled: true });
    const disabled = sampleAgent({ id: "off", displayName: "Off", enabled: false });
    const ctx = worldContextFromMapAndAgents(
      map,
      "self",
      [self, other, disabled],
      "night",
      "  ",
      "tr",
    );
    expect(ctx.mapName).toBe("Camp");
    expect(ctx.mapAreas).toEqual(["Fire pit"]);
    expect(ctx.dayNight).toBe("night");
    expect(ctx.otherAgents).toHaveLength(1);
    expect(ctx.userName).toBeTruthy();
    expect(languageLabel("en")).toMatch(/English/i);
  });
});

describe("temperament prompt injection", () => {
  it("emits label, instruction, and per-band civility for every non-neutral level", () => {
    for (let level = 1; level <= 10; level++) {
      if (level === 5) {
        expect(buildTemperamentLine(level)).toBe("");
        continue;
      }
      const band = prompts.temperament.bands[String(level)]!;
      const line = buildTemperamentLine(level);
      expect(line).toContain(`${level}/10 (${band.label})`);
      expect(line).toContain(band.instruction);
      const expectedCivility =
        band.civility === "blunt" ? CIVILITY_BLUNT : CIVILITY_AGREEABLE;
      expect(line).toContain(expectedCivility);
      expect(line).not.toContain(
        band.civility === "blunt" ? CIVILITY_AGREEABLE : CIVILITY_BLUNT,
      );
    }
    expect(LEVEL_9_LINE).toContain("press weak points hard");
    expect(LEVEL_9_LINE).not.toContain("short fuse");
    expect(buildTemperamentLine(10)).toContain("fiercely contrarian");
    expect(buildTemperamentLine(1)).toContain("correct clear factual mistakes");
    expect(buildTemperamentLine(2)).toContain("correct clear factual mistakes");
  });

  it("injects nothing for level 5 or missing/undefined values", () => {
    expect(buildTemperamentLine(5)).toBe("");
    expect(buildTemperamentLine(undefined as unknown as number)).toBe("");
    const neutral = buildAgentSystemPrompt({
      agentPrompt: "Stay curious.",
      agentName: "Explorer",
      world,
      mode: "private_chat",
      temperament: 5,
    });
    expect(neutral).not.toContain("Temperament:");
    expect(neutral).not.toContain(CIVILITY_BLUNT);
    expect(neutral).not.toContain(CIVILITY_AGREEABLE);
  });

  it("places the temperament line right after the agent prompt", () => {
    const prompt = buildAgentSystemPrompt({
      agentPrompt: "Stay curious.",
      agentName: "Explorer",
      world,
      mode: "idle_mutter",
      temperament: 9,
    });
    const agentIdx = prompt.indexOf("Stay curious.");
    const tempIdx = prompt.indexOf(LEVEL_9_LINE);
    const identityIdx = prompt.indexOf("Your name is Explorer");
    expect(agentIdx).toBeGreaterThanOrEqual(0);
    expect(tempIdx).toBeGreaterThan(agentIdx);
    expect(identityIdx).toBeGreaterThan(tempIdx);
  });

  it("includes the level-9 line in every call-site system message builder", () => {
    const privateChat = buildSystemPrompt(
      "Stay curious.",
      "Explorer",
      [],
      world,
      9,
    );
    expect(privateChat).toContain(LEVEL_9_LINE);

    for (const mode of [
      "private_chat",
      "arena_broadcast",
      "arena_mention",
      "idle_mutter",
      "arena_conversation",
    ] as const) {
      const built = buildAgentSystemPrompt({
        agentPrompt: "Stay curious.",
        agentName: "Explorer",
        world,
        mode,
        temperament: 9,
      });
      expect(built, mode).toContain(LEVEL_9_LINE);
    }
  });
});

describe("store-backed helpers", () => {
  beforeEach(() => {
    useArenaStore.setState({
      userName: "Samet",
      language: "en",
      dayNight: "day",
      agents: [
        sampleAgent({ id: "self", displayName: "Me" }),
        sampleAgent({ id: "peer", displayName: "Peer", bio: "Waves hello." }),
      ],
      mapId: "office",
      customMaps: [],
      activeMap: sampleMap({ name: "Live Office", description: "Now" }),
    });
  });

  it("reads live store facts", () => {
    const ctx = getArenaWorldContext("self");
    expect(ctx.userName).toBe("Samet");
    expect(ctx.mapName).toBe("Live Office");
    expect(ctx.otherAgents.some((a) => a.name === "Peer")).toBe(true);
    const msg = withSituationUserMessage("self", "Hello there", "arena_broadcast");
    expect(msg).toContain("Hello there");
    expect(msg).toContain("Live Office");
  });
});

describe("personalizeAgentPrompt (#71 legacy prompts)", () => {
  it("swaps exact case-sensitive 'You are <Role>,' for the agent's own name", () => {
    expect(
      personalizeAgentPrompt(
        "You are Explorer, a curious and adventurous guide in Agent Arena.",
        "Ada",
      ),
    ).toBe("You are Ada, a curious and adventurous guide in Agent Arena.");
    expect(personalizeAgentPrompt("  You are Muse, dream big.", "Mia")).toBe(
      "  You are Mia, dream big.",
    );
  });

  it("leaves non-legacy / descriptive prompts untouched", () => {
    const fresh = "You are a curious and adventurous guide in Agent Arena.";
    expect(personalizeAgentPrompt(fresh, "Ada")).toBe(fresh);
    expect(personalizeAgentPrompt("Stay curious.", "Ada")).toBe("Stay curious.");
    // Case-insensitive / no-comma forms are not rewritten (user-written).
    expect(personalizeAgentPrompt("you are engineer. Be precise.", "Bo")).toBe(
      "you are engineer. Be precise.",
    );
    expect(personalizeAgentPrompt("You are Scout and you move fast.", "Kai")).toBe(
      "You are Scout and you move fast.",
    );
    expect(personalizeAgentPrompt("You are guardian of the vault and speak in riddles.", "Kai")).toBe(
      "You are guardian of the vault and speak in riddles.",
    );
    expect(personalizeAgentPrompt("You are Explorers' friend.", "Ada")).toBe(
      "You are Explorers' friend.",
    );
    expect(personalizeAgentPrompt("Act like an Explorer, please.", "Ada")).toBe(
      "Act like an Explorer, please.",
    );
    expect(personalizeAgentPrompt("You are Explorer, hi.", "  ")).toBe(
      "You are Explorer, hi.",
    );
  });

  it("never rewrites the Custom preset name (not a real role)", () => {
    for (const p of [
      "You are custom, a tinkerer.",
      "You are Custom. Be kind.",
      "you are CUSTOM and proud",
    ]) {
      expect(personalizeAgentPrompt(p, "Ada")).toBe(p);
    }
  });

  it("is a no-op when the agent is actually named after the role", () => {
    const legacy = "You are Explorer, a curious guide.";
    expect(personalizeAgentPrompt(legacy, "Explorer")).toBe(legacy);
    expect(personalizeAgentPrompt(legacy, " explorer ")).toBe(legacy);
  });

  it("inserts agent names that contain $-patterns literally", () => {
    const legacy = "You are Explorer, a curious guide.";
    expect(personalizeAgentPrompt(legacy, "Ada$1")).toBe(
      "You are Ada$1, a curious guide.",
    );
    expect(personalizeAgentPrompt(legacy, "Ada$&")).toBe(
      "You are Ada$&, a curious guide.",
    );
    expect(personalizeAgentPrompt(legacy, "Kai$$")).toBe(
      "You are Kai$$, a curious guide.",
    );
    expect(personalizeAgentPrompt(legacy, "Kai$&")).toBe(
      "You are Kai$&, a curious guide.",
    );
    expect(personalizeAgentPrompt(legacy, "Ca$$h")).toMatch(/^You are Ca\$\$h,/);
  });
});

describe("agent identity in system prompt (#71)", () => {
  const people = {
    ...world,
    otherAgents: [
      { name: "Bo", role: "Engineer", blurb: "Builds things." },
      { name: "Cem", role: "Muse", blurb: "" },
    ],
  };

  it("states the agent's own name and personalizes a legacy role prompt", () => {
    const prompt = buildAgentSystemPrompt({
      agentPrompt: "You are Explorer, a curious guide.",
      agentName: "Ada",
      world: people,
      mode: "arena_conversation",
      temperament: 5,
    });
    expect(prompt).toContain("You are Ada, a curious guide.");
    expect(prompt).toContain("Your name is Ada");
    expect(prompt).not.toContain("You are Explorer");
  });

  it("lists others by name only and tells the agent to address them by name", () => {
    for (const mode of ["arena_conversation", "arena_mention", "arena_broadcast"] as const) {
      const prompt = buildAgentSystemPrompt({
        agentPrompt: "Stay curious.",
        agentName: "Ada",
        world: people,
        mode,
        temperament: 5,
      });
      expect(prompt).toContain("- Bo: Builds things.");
      expect(prompt).toContain("- Cem");
      expect(prompt).not.toContain("(Engineer)");
      expect(prompt).not.toContain("(Muse)");
      expect(prompt).toMatch(/by their names .*never by their role or class/);
    }
  });
});
