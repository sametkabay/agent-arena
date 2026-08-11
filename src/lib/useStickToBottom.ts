import { useCallback, useLayoutEffect, useRef } from "react";

const NEAR_BOTTOM_PX = 56;

/**
 * Keeps a scroll container pinned to the bottom while the user is already there.
 * Scrolling up stops auto-follow until they return near the bottom.
 */
export function useStickToBottom(deps: readonly unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distance <= NEAR_BOTTOM_PX;
  }, []);

  const stickNow = useCallback(() => {
    stickRef.current = true;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, deps);

  return { containerRef, onScroll, stickNow };
}
