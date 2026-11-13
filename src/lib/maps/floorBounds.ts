/** Snap a coordinate to a grid step (no-op when step ≤ 0). */
export function snapCoord(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

/**
 * Clamp XZ onto the playable floor plane (tiny inset from the tile edge).
 * Returns `[x, 0, z]`.
 */
export function clampToFloor(
  x: number,
  z: number,
  floorSize: number,
  snapStep = 0,
): [number, number, number] {
  const half = floorSize / 2 - 0.05;
  let sx = Math.max(-half, Math.min(half, x));
  let sz = Math.max(-half, Math.min(half, z));
  if (snapStep > 0) {
    sx = Math.max(-half, Math.min(half, snapCoord(sx, snapStep)));
    sz = Math.max(-half, Math.min(half, snapCoord(sz, snapStep)));
  }
  return [sx, 0, sz];
}
