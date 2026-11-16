import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSceneCache } from "@/lib/userAssets/sceneCache";

type FakeModel = { id: string; disposed: boolean };

function makeModel(id: string): FakeModel {
  return { id, disposed: false };
}

describe("createSceneCache", () => {
  let disposed: FakeModel[];
  let cache: ReturnType<typeof createSceneCache<FakeModel | null>>;
  let now: number;
  let timers: { id: number; fn: () => void; at: number }[];
  let nextId: number;

  beforeEach(() => {
    disposed = [];
    now = 0;
    nextId = 1;
    timers = [];
    cache = createSceneCache<FakeModel | null>(
      (value) => {
        if (value) {
          value.disposed = true;
          disposed.push(value);
        }
      },
      {
        disposeDelayMs: 100,
        timers: {
          setTimeout: ((fn: () => void, ms: number) => {
            const id = nextId++;
            timers.push({ id, fn, at: now + ms });
            return id as unknown as ReturnType<typeof setTimeout>;
          }) as typeof setTimeout,
          clearTimeout: ((id: ReturnType<typeof setTimeout>) => {
            timers = timers.filter((t) => t.id !== (id as unknown as number));
          }) as typeof clearTimeout,
        },
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function advance(ms: number) {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const t of due) t.fn();
  }

  it("suspend → resolve → commit leaves the model usable (no dispose)", async () => {
    const model = makeModel("m1");
    let resolve!: (v: FakeModel) => void;
    const entry = cache.getOrCreate(
      "a@1",
      () =>
        new Promise<FakeModel>((r) => {
          resolve = r;
        }),
    );
    expect(entry.refs).toBe(0);

    resolve(model);
    await entry.promise;

    expect(model.disposed).toBe(false);
    expect(entry.value).toBe(model);
    expect(cache.size()).toBe(1);

    // Mount effect takes a ref — cancels the delayed dispose.
    cache.retain(entry);
    advance(200);
    expect(model.disposed).toBe(false);
    expect(disposed).toEqual([]);
  });

  it("unmount then timeout disposes the model", async () => {
    const model = makeModel("m2");
    const entry = cache.getOrCreate("b@1", async () => model);
    await entry.promise;
    cache.retain(entry);
    expect(model.disposed).toBe(false);

    cache.release(entry, "b@1");
    expect(model.disposed).toBe(false);
    advance(99);
    expect(model.disposed).toBe(false);
    advance(2);
    expect(model.disposed).toBe(true);
    expect(cache.size()).toBe(0);
  });

  it("remounting within the timeout reuses the model", async () => {
    const model = makeModel("m3");
    const factory = vi.fn(async () => model);
    const entry = cache.getOrCreate("c@1", factory);
    await entry.promise;
    cache.retain(entry);
    cache.release(entry, "c@1");

    advance(50); // still within delay
    const again = cache.getOrCreate("c@1", factory);
    expect(again).toBe(entry);
    expect(factory).toHaveBeenCalledTimes(1);
    cache.retain(again);
    advance(200);
    expect(model.disposed).toBe(false);
  });

  it("a failed load removes the entry so a retry can start", async () => {
    const entry = cache.getOrCreate("d@1", async () => {
      throw new Error("boom");
    });
    await expect(entry.promise).rejects.toThrow("boom");
    expect(cache.peek("d@1")).toBeUndefined();
    expect(cache.size()).toBe(0);

    const model = makeModel("retry");
    const retry = cache.getOrCreate("d@1", async () => model);
    await expect(retry.promise).resolves.toBe(model);
    expect(cache.peek("d@1")).toBe(retry);
  });

  it("invalidate disposes when refs===0 and marks stale when refs>0", async () => {
    const idle = makeModel("idle");
    const idleEntry = cache.getOrCreate("user:x@1", async () => idle);
    await idleEntry.promise;
    // refs still 0 — wait past delayed dispose? invalidate should dispose now
    cache.invalidatePrefix("user:x@");
    expect(idle.disposed).toBe(true);
    expect(cache.peek("user:x@1")).toBeUndefined();

    const live = makeModel("live");
    const liveEntry = cache.getOrCreate("user:y@2", async () => live);
    await liveEntry.promise;
    cache.retain(liveEntry);
    cache.invalidatePrefix("user:y@");
    expect(live.disposed).toBe(false);
    expect(liveEntry.stale).toBe(true);

    // Next getOrCreate starts a fresh load
    const fresh = makeModel("fresh");
    const factory = vi.fn(async () => fresh);
    const next = cache.getOrCreate("user:y@2", factory);
    expect(next).not.toBe(liveEntry);
    expect(factory).toHaveBeenCalledTimes(1);
    await next.promise;

    // Old entry still held until release
    expect(live.disposed).toBe(false);
    cache.release(liveEntry, "user:y@2");
    expect(live.disposed).toBe(true);

    cache.retain(next);
    advance(200);
    expect(fresh.disposed).toBe(false);
  });

  it("resolve with refs===0 schedules dispose; does not dispose synchronously", async () => {
    const model = makeModel("sync");
    const entry = cache.getOrCreate("e@1", async () => model);
    await entry.promise;
    expect(model.disposed).toBe(false);
    expect(entry.disposeTimer).not.toBeNull();
    advance(100);
    expect(model.disposed).toBe(true);
  });
});
