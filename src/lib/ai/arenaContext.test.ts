import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  buildArenaWorldContext,
  buildSituationUserPrefix,
  buildTemperamentLine,
  describeAgentBrief,
  getArenaWorldContext,
  languageLabel,
  withSituationUserMessage,
  worldContextFromMapAndAgents,
} from "@/lib/ai/arenaContext";
import { buildSystemPrompt } from "@/lib/ai/providers";
import { prompts } from "@/lib/config";
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
    const fromPrompt = describeAgentBrief(
      sampleAgent({ bio: "  ", systemPrompt: "You are Scout. Keep it short." }),
    );
    expect(fromPrompt.blurb).toContain("Keep it short");
    const empty = describeAgentBrief(
      sampleAgent({ bio: undefined, systemPrompt: "   " }),
    );
    expect(empty.blurb).toBe("");
  });

  it("clips long bios", () => {
    const long = "x".repeat(prompts.briefs.bioMax + 40);
    const { blurb } = describeAgentBrief(sampleAgent({ bio: long }));
    expect(blurb.endsWith("…")).toBe(true);
    expect(blurb.length).toBeLessThanOrEqual(prompts.briefs.bioMax);
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
    const identityIdx = prompt.indexOf("You are Explorer");
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
