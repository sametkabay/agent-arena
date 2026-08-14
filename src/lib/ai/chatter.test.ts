import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatterRuntime,
  disposeChatterRuntime,
  meanChatterIntervalMs,
  pauseChatterRuntime,
  resumeChatterRuntime,
  scheduleNextChatterAt,
  tickAgentChatter,
} from "@/lib/ai/chatter";
import { sampleAgent, sampleModel } from "@/test/fixtures";
import { useArenaStore } from "@/store/arenaStore";

const chatCompletion = vi.fn();

vi.mock("@/lib/ai/providers", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

function seedStore(partial: Record<string, unknown> = {}) {
  useArenaStore.setState({
    mapEditorOpen: false,
    settingsOpen: false,
    chatBusyById: {},
    agents: [sampleAgent({ chattiness: 80, modelConfigId: "model-1" })],
    models: [sampleModel()],
    activeMap: null,
    customMaps: [],
    mapId: "office",
    userName: "Samet",
    language: "en",
    dayNight: "day",
    ...partial,
  });
}

describe("chatter scheduling", () => {
  it("returns infinity when chattiness is 0", () => {
    expect(meanChatterIntervalMs(0)).toBe(Number.POSITIVE_INFINITY);
    expect(scheduleNextChatterAt(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("schedules a finite future time at high chattiness", () => {
    const now = 1_000_000;
    const at = scheduleNextChatterAt(100, now);
    expect(at).toBeGreaterThan(now);
    expect(meanChatterIntervalMs(100)).toBeGreaterThan(0);
    expect(Number.isFinite(meanChatterIntervalMs(50))).toBe(true);
  });
});

describe("chatter runtime pause/resume", () => {
  it("aborts inflight work and shifts timers on resume", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const rt = createChatterRuntime();
    const ac = new AbortController();
    rt.inflight.set("a", ac);
    rt.nextAt.set("a", 2000);
    pauseChatterRuntime(rt);
    expect(ac.signal.aborted).toBe(true);
    expect(rt.inflight.size).toBe(0);
    pauseChatterRuntime(rt);
    vi.setSystemTime(1500);
    resumeChatterRuntime(rt);
    expect(rt.nextAt.get("a")).toBe(2500);
    resumeChatterRuntime(rt);
    disposeChatterRuntime(rt);
    expect(rt.nextAt.size).toBe(0);
    vi.useRealTimers();
  });
});

describe("tickAgentChatter", () => {
  beforeEach(() => {
    chatCompletion.mockReset();
    chatCompletion.mockResolvedValue("hmm");
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = () => {};
    seedStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips while the map editor is open", () => {
    const rt = createChatterRuntime();
    seedStore({ mapEditorOpen: true });
    tickAgentChatter(rt);
    expect(rt.nextAt.size).toBe(0);
  });

  it("schedules then fires a mutter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    const rt = createChatterRuntime();
    tickAgentChatter(rt);
    expect(rt.nextAt.has("agent-1")).toBe(true);
    rt.nextAt.set("agent-1", 4000);
    tickAgentChatter(rt);
    await vi.runAllTimersAsync();
    expect(chatCompletion).toHaveBeenCalled();
    disposeChatterRuntime(rt);
  });

  it("does not mutter without a model or when chattiness is 0", () => {
    const rt = createChatterRuntime();
    seedStore({
      agents: [sampleAgent({ chattiness: 0 })],
    });
    tickAgentChatter(rt);
    expect(rt.nextAt.has("agent-1")).toBe(false);

    seedStore({
      agents: [sampleAgent({ chattiness: 50, modelConfigId: "missing" })],
    });
    rt.nextAt.set("agent-1", 0);
    tickAgentChatter(rt);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("drops timers for disabled agents", () => {
    const rt = createChatterRuntime();
    rt.nextAt.set("gone", 1);
    seedStore({
      agents: [sampleAgent({ id: "gone", enabled: false, chattiness: 80 })],
    });
    tickAgentChatter(rt);
    expect(rt.nextAt.has("gone")).toBe(false);
  });

  it("pauses when the document is hidden", () => {
    const rt = createChatterRuntime();
    const previous = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { visibilityState: "hidden" },
    });
    tickAgentChatter(rt);
    expect(rt.pausedAt).not.toBeNull();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previous,
    });
  });

  it("aborts inflight work for removed or busy agents", () => {
    const rt = createChatterRuntime();
    const removed = new AbortController();
    rt.nextAt.set("gone", 1);
    rt.inflight.set("gone", removed);
    seedStore({ agents: [sampleAgent({ id: "kept", chattiness: 50 })] });
    tickAgentChatter(rt);
    expect(removed.signal.aborted).toBe(true);

    const busy = new AbortController();
    rt.nextAt.set("agent-1", 0);
    rt.inflight.set("agent-1", busy);
    seedStore({
      agents: [sampleAgent({ chattiness: 80 })],
      chatBusyById: { "agent-1": true },
    });
    tickAgentChatter(rt);
    expect(busy.signal.aborted).toBe(true);
    expect(rt.inflight.has("agent-1")).toBe(false);
  });

  it("handles empty mutters, abort, and other failures", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(8000);
    const rt = createChatterRuntime();
    rt.nextAt.set("agent-1", 0);

    chatCompletion.mockImplementation(async (req: { onToken?: (c: string) => void }) => {
      req.onToken?.("   ");
      req.onToken?.("line: hi");
      return '"hi"';
    });
    tickAgentChatter(rt);
    await vi.runAllTimersAsync();

    rt.nextAt.set("agent-1", 0);
    chatCompletion.mockResolvedValue("   ");
    tickAgentChatter(rt);
    await vi.runAllTimersAsync();

    rt.nextAt.set("agent-1", 0);
    chatCompletion.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    tickAgentChatter(rt);
    await vi.runAllTimersAsync();

    rt.nextAt.set("agent-1", 0);
    chatCompletion.mockRejectedValue(new Error("boom"));
    tickAgentChatter(rt);
    await vi.runAllTimersAsync();

    disposeChatterRuntime(rt);
  });
});
