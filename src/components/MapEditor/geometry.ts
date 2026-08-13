import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PLACEABLE_SPECS, type PlaceableId } from "@/lib/assets/catalog";

export function snapCoord(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

export function clampToFloor(
  x: number,
  z: number,
  floorSize: number,
  snapStep = 0,
): [number, number, number] {
  // Playable grid is size×size; keep a tiny inset from the tile edge
  const half = floorSize / 2 - 0.05;
  let sx = Math.max(-half, Math.min(half, x));
  let sz = Math.max(-half, Math.min(half, z));
  if (snapStep > 0) {
    sx = Math.max(-half, Math.min(half, snapCoord(sx, snapStep)));
    sz = Math.max(-half, Math.min(half, snapCoord(sz, snapStep)));
  }
  return [sx, 0, sz];
}

export function hitFloor(
  event: ThreeEvent<PointerEvent>,
  floorSize: number,
  snapStep = 0,
): [number, number, number] | null {
  return clampToFloor(event.point.x, event.point.z, floorSize, snapStep);
}

/** Map a DOM pointer (e.g. library drag-drop) onto the y=0 floor plane. */
export function screenToFloor(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  floorSize: number,
  snapStep = 0,
): [number, number, number] | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return clampToFloor(hit.x, hit.z, floorSize, snapStep);
}

export function footprintSize(placeableId: string): [number, number, number] {
  const spec = PLACEABLE_SPECS[placeableId as PlaceableId];
  if (!spec) return [1.2, 1.2, 1.2];
  const [w, d] = spec.footprint;
  return [Math.max(0.8, w * 1.15), 1.4, Math.max(0.8, d * 1.15)];
}

/** Hit volume for picking — respects visual scale but never shrinks below a clickable size. */
export function hitboxSize(
  placeableId: string,
  scale = 1,
): [number, number, number] {
  const [sx, sy, sz] = footprintSize(placeableId);
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const MIN_XZ = 0.6;
  const MIN_Y = 0.75;
  return [
    Math.max(MIN_XZ, sx * s),
    Math.max(MIN_Y, sy * s),
    Math.max(MIN_XZ, sz * s),
  ];
}

/** Rotate (x,z) around (cx,cz) by delta radians (Three.js +Y). */
export function rotateXZAround(
  x: number,
  z: number,
  cx: number,
  cz: number,
  delta: number,
): [number, number] {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(delta);
  const s = Math.sin(delta);
  return [cx + dx * c + dz * s, cz - dx * s + dz * c];
}

export function wrapAngle(rad: number): number {
  return ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}
