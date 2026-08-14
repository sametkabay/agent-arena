import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  buildArenaWorldContext,
  buildSituationUserPrefix,
  describeAgentBrief,
  getArenaWorldContext,
  languageLabel,
  withSituationUserMessage,
  worldContextFromMapAndAgents,
} from "@/lib/ai/arenaContext";
import { prompts } from "@/lib/config";
import { sampleAgent, sampleMap } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

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
    expect(prefix).toContain(prompts.situation.footer.trim().slice(0, 12));

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
