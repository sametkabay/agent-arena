import { useCallback, useEffect, useState } from "react";

export type MoveBurst = {
  id: string;
  x: number;
  z: number;
  born: number;
};

const BURST_MS = 650;

export function useMoveBursts() {
  const [bursts, setBursts] = useState<MoveBurst[]>([]);

  const addBurst = useCallback((x: number, z: number) => {
    const id = `burst_${performance.now().toFixed(3)}`;
    setBursts((prev) => [...prev, { id, x, z, born: performance.now() }]);
  }, []);

  const removeBurst = useCallback((id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  useEffect(() => {
    // Safety cleanup if a burst callback is missed
    const t = window.setInterval(() => {
      const now = performance.now();
      setBursts((prev) => prev.filter((b) => now - b.born < BURST_MS + 200));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  return { bursts, addBurst, removeBurst };
}
