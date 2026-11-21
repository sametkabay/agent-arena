/**
 * Suspense-style refcounted cache with delayed dispose.
 *
 * Load completion never disposes when refs===0 (the suspended component has
 * not mounted yet). A short timer gives the mount effect time to retain;
 * StrictMode remount within the window reuses the same entry.
 */

export type SceneCacheEntry<T> = {
  promise: Promise<T>;
  refs: number;
  value: T | undefined;
  /** Pending delayed dispose; cancelled by retain(). */
  disposeTimer: ReturnType<typeof setTimeout> | null;
  /** When true, next getOrCreate starts a fresh load; release disposes ASAP. */
  stale: boolean;
};

export type SceneCacheTimers = {
  setTimeout: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout: (id: ReturnType<typeof globalThis.setTimeout>) => void;
};

export type SceneCacheOptions = {
  disposeDelayMs?: number;
  timers?: SceneCacheTimers;
};

const DEFAULT_DISPOSE_DELAY_MS = 4_000;

export function createSceneCache<T>(
  disposeValue: (value: T | undefined) => void,
  opts: SceneCacheOptions = {},
) {
  const delayMs = opts.disposeDelayMs ?? DEFAULT_DISPOSE_DELAY_MS;
  // Bind via wrappers — bare `setTimeout` loses its receiver (Illegal invocation).
  const timers: SceneCacheTimers = opts.timers ?? {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => {
      globalThis.clearTimeout(id);
    },
  };
  const cache = new Map<string, SceneCacheEntry<T>>();
  /** Entries detached by invalidate while still referenced. */
  const orphans = new Set<SceneCacheEntry<T>>();

  function cancelTimer(entry: SceneCacheEntry<T>): void {
    if (entry.disposeTimer != null) {
      timers.clearTimeout(entry.disposeTimer);
      entry.disposeTimer = null;
    }
  }

  function finalize(entry: SceneCacheEntry<T>, key: string | null): void {
    cancelTimer(entry);
    disposeValue(entry.value);
    entry.value = undefined;
    orphans.delete(entry);
    if (key != null && cache.get(key) === entry) {
      cache.delete(key);
    } else {
      for (const [k, v] of cache) {
        if (v === entry) cache.delete(k);
      }
    }
  }

  function scheduleDispose(key: string, entry: SceneCacheEntry<T>): void {
    cancelTimer(entry);
    entry.disposeTimer = timers.setTimeout(() => {
      entry.disposeTimer = null;
      if (entry.refs > 0) return;
      if (cache.get(key) !== entry && !orphans.has(entry)) return;
      finalize(entry, key);
    }, delayMs);
  }

  function getOrCreate(
    key: string,
    factory: () => Promise<T>,
  ): SceneCacheEntry<T> {
    const existing = cache.get(key);
    if (existing && !existing.stale) return existing;

    if (existing?.stale) {
      cancelTimer(existing);
      if (existing.refs > 0) {
        orphans.add(existing);
      } else {
        disposeValue(existing.value);
        existing.value = undefined;
      }
      cache.delete(key);
    }

    const entry: SceneCacheEntry<T> = {
      promise: null as unknown as Promise<T>,
      refs: 0,
      value: undefined,
      disposeTimer: null,
      stale: false,
    };

    const promise = factory().then(
      (value) => {
        // Entry may have been invalidated/failed away.
        if (cache.get(key) !== entry && !orphans.has(entry)) {
          disposeValue(value);
          return value;
        }
        entry.value = value;
        // Never dispose immediately on resolve — mount effect may not have
        // run yet (refs still 0). Schedule a delayed release instead.
        if (entry.refs <= 0) {
          scheduleDispose(key, entry);
        }
        return value;
      },
      (err: unknown) => {
        // Failed load: drop the entry so the next render retries.
        if (cache.get(key) === entry) {
          cancelTimer(entry);
          cache.delete(key);
        }
        throw err;
      },
    );

    entry.promise = promise;
    cache.set(key, entry);
    return entry;
  }

  /** Mount / StrictMode remount — cancel pending dispose and take a ref. */
  function retain(entry: SceneCacheEntry<T>): void {
    cancelTimer(entry);
    entry.refs += 1;
  }

  /** Unmount — when last ref drops, schedule delayed dispose (or immediate if stale). */
  function release(entry: SceneCacheEntry<T>, key: string): void {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;
    if (entry.stale || orphans.has(entry)) {
      finalize(entry, key);
      return;
    }
    if (cache.get(key) === entry) {
      scheduleDispose(key, entry);
    } else {
      finalize(entry, null);
    }
  }

  /**
   * Invalidate keys with the given prefix (`id@`).
   * refs===0 → dispose + evict; refs>0 → mark stale (next getOrCreate reloads;
   * last release disposes).
   */
  function invalidatePrefix(prefix: string): void {
    for (const [key, entry] of [...cache.entries()]) {
      if (!key.startsWith(prefix)) continue;
      cancelTimer(entry);
      if (entry.refs <= 0) {
        finalize(entry, key);
      } else {
        entry.stale = true;
      }
    }
  }

  function invalidateAll(): void {
    for (const [key, entry] of [...cache.entries()]) {
      cancelTimer(entry);
      if (entry.refs <= 0) {
        finalize(entry, key);
      } else {
        entry.stale = true;
      }
    }
    for (const entry of [...orphans]) {
      if (entry.refs <= 0) finalize(entry, null);
      else entry.stale = true;
    }
  }

  function peek(key: string): SceneCacheEntry<T> | undefined {
    return cache.get(key);
  }

  function size(): number {
    return cache.size;
  }

  /** Test helper — run pending timers immediately when using fake timers. */
  function flushDispose(key: string): void {
    const entry = cache.get(key);
    if (!entry || entry.refs > 0) return;
    finalize(entry, key);
  }

  return {
    getOrCreate,
    retain,
    release,
    invalidatePrefix,
    invalidateAll,
    peek,
    size,
    flushDispose,
    disposeDelayMs: delayMs,
  };
}

export type SceneCache<T> = ReturnType<typeof createSceneCache<T>>;
