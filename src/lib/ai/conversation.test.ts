import { describe, expect, it } from "vitest";
import {
  abortTurn,
  applyHumanMessage,
  beginTurn,
  canTakeTurn,
  completeTurn,
  createConversationState,
  callableSpeakerIds,
  eligibleSpeakers,
  failTurn,
  formatArenaHistory,
  isWaitingForHuman,
  parseChatterMode,
  pickNextSpeaker,
  type CanTakeTurnResult,
  type ConversationBudget,
  type ConversationState,
  type EligibleSpeaker,
} from "@/lib/ai/conversation";

function reasonOf(result: CanTakeTurnResult): string | undefined {
  return result.ok ? undefined : result.reason;
}
import { sampleAgent, sampleModel } from "@/test/fixtures";
import type { FloatingChatLine } from "@/lib/types";

const budget: ConversationBudget = {
  minGapMs: 5000,
  maxAgentTurns: 6,
  humanReplyDelayMs: 400,
  firstTurnDelayMs: 1500,
  historyLines: 12,
  historyMaxChars: 1600,
};

function baseState(partial: Partial<ConversationState> = {}): ConversationState {
  return {
    lastSpeakerId: null,
    lastTurnEndedAt: 0,
    agentTurnsSinceHuman: 0,
    priorityQueue: [],
    inflightAgentId: null,
    humanSeq: 0,
    ...partial,
  };
}

describe("parseChatterMode", () => {
  it("accepts the three valid modes", () => {
    expect(parseChatterMode("off")).toBe("off");
    expect(parseChatterMode("idle")).toBe("idle");
    expect(parseChatterMode("conversation")).toBe("conversation");
  });

  it("migrates legacy idleChatterEnabled", () => {
    expect(parseChatterMode(undefined, true)).toBe("idle");
    expect(parseChatterMode(undefined, false)).toBe("off");
    expect(parseChatterMode(undefined, undefined)).toBe("off");
  });

  it("rejects junk and prefers an explicit mode over legacy", () => {
    expect(parseChatterMode("loud")).toBe("off");
    expect(parseChatterMode(1)).toBe("off");
    expect(parseChatterMode("idle", false)).toBe("idle");
    expect(parseChatterMode("off", true)).toBe("off");
  });
});

describe("createConversationState", () => {
  it("grants a first-turn delay allowance", () => {
    const now = 10_000;
    const state = createConversationState(now, budget);
    expect(state.lastTurnEndedAt).toBe(now - budget.minGapMs + budget.firstTurnDelayMs);
    expect(state.agentTurnsSinceHuman).toBe(0);
    expect(state.lastSpeakerId).toBeNull();
  });
});

describe("callableSpeakerIds", () => {
  it("includes chattiness-0 agents that still have a model", () => {
    const models = [sampleModel({ id: "m1" })];
    const agents = [
      sampleAgent({ id: "quiet", chattiness: 0, modelConfigId: "m1" }),
      sampleAgent({ id: "chatty", chattiness: 40, modelConfigId: "m1" }),
      sampleAgent({ id: "off", enabled: false, chattiness: 50, modelConfigId: "m1" }),
      sampleAgent({ id: "nomodel", chattiness: 50, modelConfigId: "" }),
    ];
    expect([...callableSpeakerIds(agents, models)]).toEqual(["quiet", "chatty"]);
  });
});

describe("eligibleSpeakers", () => {
  it("keeps enabled chatty agents with a known model in stable order", () => {
    const models = [sampleModel({ id: "m1" }), sampleModel({ id: "m2" })];
    const agents = [
      sampleAgent({ id: "a", chattiness: 10, modelConfigId: "m1" }),
      sampleAgent({ id: "b", chattiness: 0, modelConfigId: "m1" }),
      sampleAgent({ id: "c", chattiness: 40, modelConfigId: "missing" }),
      sampleAgent({ id: "d", chattiness: 20, modelConfigId: "m2", enabled: false }),
      sampleAgent({ id: "e", chattiness: 30, modelConfigId: "m2" }),
    ];
    expect(eligibleSpeakers(agents, models).map((s) => s.id)).toEqual(["a", "e"]);
  });
});

describe("canTakeTurn", () => {
  const pauseOff = { settingsOpen: false, mapEditorOpen: false, hidden: false };

  it("checks pause, inflight, budget, then gap in order", () => {
    const state = baseState({
      inflightAgentId: "a",
      agentTurnsSinceHuman: 6,
      lastTurnEndedAt: 9_000,
    });
    expect(
      reasonOf(
        canTakeTurn(state, budget, 10_000, {
          settingsOpen: true,
          mapEditorOpen: false,
          hidden: false,
        }),
      ),
    ).toBe("paused");
    expect(reasonOf(canTakeTurn(state, budget, 10_000, pauseOff))).toBe("inflight");
    expect(
      reasonOf(
        canTakeTurn({ ...state, inflightAgentId: null }, budget, 10_000, pauseOff),
      ),
    ).toBe("budget");
    expect(
      reasonOf(
        canTakeTurn(
          { ...state, inflightAgentId: null, agentTurnsSinceHuman: 5 },
          budget,
          10_000,
          pauseOff,
        ),
      ),
    ).toBe("gap");
    expect(
      canTakeTurn(
        { ...state, inflightAgentId: null, agentTurnsSinceHuman: 5, lastTurnEndedAt: 5_000 },
        budget,
        10_000,
        pauseOff,
      ),
    ).toEqual({ ok: true });
  });

  it("treats gap as strict less-than and budget at the N boundary", () => {
    const state = baseState({ lastTurnEndedAt: 5_000, agentTurnsSinceHuman: 5 });
    expect(canTakeTurn(state, budget, 10_000, pauseOff)).toEqual({ ok: true });
    expect(reasonOf(canTakeTurn(state, budget, 9_999, pauseOff))).toBe("gap");
    expect(
      reasonOf(
        canTakeTurn(
          { ...state, agentTurnsSinceHuman: 6, lastTurnEndedAt: 0 },
          budget,
          10_000,
          pauseOff,
        ),
      ),
    ).toBe("budget");
    expect(
      reasonOf(
        canTakeTurn(
          { ...state, agentTurnsSinceHuman: 7, lastTurnEndedAt: 0 },
          budget,
          10_000,
          pauseOff,
        ),
      ),
    ).toBe("budget");
  });
});

describe("pickNextSpeaker", () => {
  const eligible: EligibleSpeaker[] = [
    { id: "a", chattiness: 50 },
    { id: "b", chattiness: 50 },
    { id: "c", chattiness: 50 },
  ];

  it("prefers the priority queue and skips last speaker / ineligible", () => {
    const state = baseState({
      lastSpeakerId: "a",
      priorityQueue: ["a", "gone", "b", "c"],
    });
    expect(pickNextSpeaker(state, eligible, {}, () => 0)).toBe("b");
    expect(
      pickNextSpeaker(state, eligible, new Set(["b", "c"]), () => 0),
    ).toBeNull();
  });

  it("waits when the next priority agent is busy instead of picking another", () => {
    const state = baseState({
      lastSpeakerId: "a",
      priorityQueue: ["b", "c"],
    });
    expect(pickNextSpeaker(state, eligible, { b: true }, () => 0)).toBeNull();
  });

  it("allows chattiness-0 agents via priorityAllowIds", () => {
    const state = baseState({ priorityQueue: ["zed"] });
    const allow = new Set(["zed", "a", "b"]);
    expect(
      pickNextSpeaker(state, eligible, {}, () => 0, allow),
    ).toBe("zed");
    // Without priorityAllowIds, chattiness-0 ids are skipped and weighted pick runs.
    expect(pickNextSpeaker(state, eligible, {}, () => 0)).toBe("a");
  });

  it("never returns the last speaker over many weighted draws", () => {
    const state = baseState({ lastSpeakerId: "a" });
    const rng = () => Math.random();
    for (let i = 0; i < 1000; i++) {
      const id = pickNextSpeaker(state, eligible, {}, rng);
      expect(id).not.toBe("a");
      expect(id === "b" || id === "c").toBe(true);
    }
  });

  it("returns null with one eligible agent after their turn or with none", () => {
    expect(
      pickNextSpeaker(baseState({ lastSpeakerId: "solo" }), [{ id: "solo", chattiness: 10 }], {}),
    ).toBeNull();
    expect(pickNextSpeaker(baseState(), [], {})).toBeNull();
    expect(
      pickNextSpeaker(baseState(), [{ id: "z", chattiness: 0 }], {}),
    ).toBeNull();
  });
});

describe("turn lifecycle", () => {
  it("applyHumanMessage resets count, speaker, queue, and advances reply time", () => {
    const now = 20_000;
    const prev = baseState({
      agentTurnsSinceHuman: 4,
      lastSpeakerId: "a",
      priorityQueue: ["x"],
      humanSeq: 2,
      lastTurnEndedAt: 1,
    });
    const next = applyHumanMessage(prev, ["b", "b", "c"], now, budget);
    expect(next.agentTurnsSinceHuman).toBe(0);
    expect(next.lastSpeakerId).toBeNull();
    expect(next.priorityQueue).toEqual(["b", "c"]);
    expect(next.lastTurnEndedAt).toBe(now - budget.minGapMs + budget.humanReplyDelayMs);
    expect(next.humanSeq).toBe(3);
  });

  it("completeTurn strips self, dedupes, and counts; fail counts; abort does not", () => {
    let state = beginTurn(baseState({ priorityQueue: ["b"] }), "a");
    expect(state.inflightAgentId).toBe("a");
    state = completeTurn(state, "a", 1000, ["a", "b", "c"]);
    expect(state.agentTurnsSinceHuman).toBe(1);
    expect(state.lastSpeakerId).toBe("a");
    expect(state.priorityQueue).toEqual(["b", "c"]);
    expect(state.inflightAgentId).toBeNull();

    state = failTurn(beginTurn(state, "b"), "b", 2000);
    expect(state.agentTurnsSinceHuman).toBe(2);
    expect(state.lastSpeakerId).toBe("b");
    expect(state.priorityQueue).toEqual(["c"]);

    state = beginTurn(state, "c");
    state = abortTurn(state);
    expect(state.inflightAgentId).toBeNull();
    expect(state.agentTurnsSinceHuman).toBe(2);
  });

  it("failTurn removes the failed id from the priority queue", () => {
    let state = beginTurn(
      baseState({ priorityQueue: ["broken", "ok"] }),
      "broken",
    );
    state = failTurn(state, "broken", 3000);
    expect(state.priorityQueue).toEqual(["ok"]);
  });
});

describe("simulated conversation run", () => {
  it("alternates for N turns then waits for a human before another N", () => {
    let state = createConversationState(0, budget);
    state = { ...state, lastTurnEndedAt: 0 };
    const eligible: EligibleSpeaker[] = [
      { id: "a", chattiness: 50 },
      { id: "b", chattiness: 50 },
    ];
    const speakers: string[] = [];
    let now = 10_000;
    for (let i = 0; i < budget.maxAgentTurns; i++) {
      const gate = canTakeTurn(state, budget, now, {
        settingsOpen: false,
        mapEditorOpen: false,
        hidden: false,
      });
      expect(gate.ok).toBe(true);
      const id = pickNextSpeaker(state, eligible, {});
      expect(id).toBeTruthy();
      speakers.push(id!);
      state = completeTurn(beginTurn(state, id!), id!, now, []);
      now += budget.minGapMs;
    }
    expect(speakers).toHaveLength(6);
    for (let i = 1; i < speakers.length; i++) {
      expect(speakers[i]).not.toBe(speakers[i - 1]);
    }
    expect(isWaitingForHuman(state, budget, eligible)).toBe(true);
    expect(
      reasonOf(
        canTakeTurn(state, budget, now, {
          settingsOpen: false,
          mapEditorOpen: false,
          hidden: false,
        }),
      ),
    ).toBe("budget");

    state = applyHumanMessage(state, [], now, budget);
    now = state.lastTurnEndedAt + budget.minGapMs;
    let more = 0;
    while (
      canTakeTurn(state, budget, now, {
        settingsOpen: false,
        mapEditorOpen: false,
        hidden: false,
      }).ok
    ) {
      const id = pickNextSpeaker(state, eligible, {});
      expect(id).toBeTruthy();
      state = completeTurn(beginTurn(state, id!), id!, now, []);
      now += budget.minGapMs;
      more += 1;
    }
    expect(more).toBe(6);
  });
});

describe("formatArenaHistory", () => {
  function line(
    partial: Partial<FloatingChatLine> & Pick<FloatingChatLine, "kind" | "text" | "agentName">,
  ): FloatingChatLine {
    return {
      id: partial.id ?? "x",
      color: "#fff",
      createdAt: 1,
      agentId: partial.agentId,
      ...partial,
    };
  }

  it("keeps last N user/agent lines, drops system, labels self, and trims oldest for chars", () => {
    const lines = [
      line({ kind: "system", text: "note", agentName: "System" }),
      line({ kind: "user", text: "hi", agentName: "Samet" }),
      line({ kind: "agent", text: "hello", agentName: "Ada", agentId: "ada" }),
      line({ kind: "agent", text: "yo", agentName: "Bo", agentId: "bo" }),
      line({ kind: "agent", text: "again", agentName: "Ada", agentId: "ada" }),
    ];
    const formatted = formatArenaHistory(lines, "ada", { max: 3, maxChars: 1600 });
    expect(formatted).not.toContain("note");
    expect(formatted).toContain("Ada (you): again");
    expect(formatted.split("\n")).toHaveLength(3);

    const tiny = formatArenaHistory(lines, "ada", { max: 10, maxChars: 20 });
    expect(tiny.length).toBeLessThanOrEqual(20);
    expect(tiny.length).toBeGreaterThan(0);
    expect(formatArenaHistory([], "ada", { max: 5, maxChars: 100 })).toBe("");
  });

  it("truncates an over-long newest line instead of returning empty", () => {
    const long = "x".repeat(80);
    const lines = [line({ kind: "user", text: long, agentName: "Samet" })];
    const out = formatArenaHistory(lines, "ada", { max: 5, maxChars: 30 });
    expect(out).toHaveLength(30);
    expect(out.startsWith("Samet: ")).toBe(true);
  });
});
