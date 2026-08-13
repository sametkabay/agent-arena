import { useCallback, useRef, useState } from "react";
import type { ArenaMapDefinition } from "@/lib/maps/schema";
import { cloneMap } from "@/lib/maps";
import { appConfig } from "@/lib/config";

const MAX_HISTORY = appConfig.ui.editorMaxHistory;

/**
 * Map-editor undo/redo stack.
 * - `commit` records a snapshot before applying a change
 * - `setLive` updates without recording (e.g. mid-drag)
 * - `beginGesture` / `endGesture` record one undo step for a drag/slider
 */
export function useMapHistory(initial: ArenaMapDefinition | null) {
  const [draft, setDraftState] = useState<ArenaMapDefinition | null>(initial);
  const [pastLen, setPastLen] = useState(0);
  const [futureLen, setFutureLen] = useState(0);
  const past = useRef<ArenaMapDefinition[]>([]);
  const future = useRef<ArenaMapDefinition[]>([]);
  const gestureBefore = useRef<ArenaMapDefinition | null>(null);

  const reset = useCallback((next: ArenaMapDefinition | null) => {
    past.current = [];
    future.current = [];
    gestureBefore.current = null;
    setPastLen(0);
    setFutureLen(0);
    setDraftState(next ? cloneMap(next) : null);
  }, []);

  const setLive = useCallback(
    (updater: ArenaMapDefinition | ((d: ArenaMapDefinition) => ArenaMapDefinition)) => {
      setDraftState((d) => {
        if (!d) return d;
        return typeof updater === "function" ? updater(d) : updater;
      });
    },
    [],
  );

  const commit = useCallback(
    (updater: ArenaMapDefinition | ((d: ArenaMapDefinition) => ArenaMapDefinition)) => {
      setDraftState((d) => {
        if (!d) return d;
        const next = typeof updater === "function" ? updater(d) : updater;
        if (next === d) return d;
        past.current = [...past.current.slice(-(MAX_HISTORY - 1)), cloneMap(d)];
        future.current = [];
        setPastLen(past.current.length);
        setFutureLen(0);
        return next;
      });
    },
    [],
  );

  const beginGesture = useCallback(() => {
    setDraftState((d) => {
      gestureBefore.current = d ? cloneMap(d) : null;
      return d;
    });
  }, []);

  const endGesture = useCallback(() => {
    const before = gestureBefore.current;
    gestureBefore.current = null;
    if (!before) return;
    setDraftState((d) => {
      if (!d) return d;
      // Only push history if something actually changed
      if (JSON.stringify(before) === JSON.stringify(d)) return d;
      past.current = [...past.current.slice(-(MAX_HISTORY - 1)), before];
      future.current = [];
      setPastLen(past.current.length);
      setFutureLen(0);
      return d;
    });
  }, []);

  const undo = useCallback(() => {
    setDraftState((d) => {
      if (!d || past.current.length === 0) return d;
      const prev = past.current[past.current.length - 1];
      past.current = past.current.slice(0, -1);
      future.current = [...future.current, cloneMap(d)];
      setPastLen(past.current.length);
      setFutureLen(future.current.length);
      return cloneMap(prev);
    });
  }, []);

  const redo = useCallback(() => {
    setDraftState((d) => {
      if (!d || future.current.length === 0) return d;
      const next = future.current[future.current.length - 1];
      future.current = future.current.slice(0, -1);
      past.current = [...past.current, cloneMap(d)];
      setPastLen(past.current.length);
      setFutureLen(future.current.length);
      return cloneMap(next);
    });
  }, []);

  return {
    draft,
    setLive,
    commit,
    reset,
    undo,
    redo,
    beginGesture,
    endGesture,
    canUndo: pastLen > 0,
    canRedo: futureLen > 0,
  };
}
