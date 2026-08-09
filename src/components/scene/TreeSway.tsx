import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";

/** Gentle wind sway for trees / tall nature props. */
export function TreeSway({
  children,
  strength = 0.035,
  speed = 0.7,
  phase = 0,
}: {
  children: ReactNode;
  strength?: number;
  speed?: number;
  phase?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * speed + phase;
    g.rotation.z = Math.sin(t) * strength;
    g.rotation.x = Math.cos(t * 0.85) * strength * 0.45;
  });
  return <group ref={ref}>{children}</group>;
}

export function isSwayPlaceable(placeableId: string, category?: string): boolean {
  if (category === "nature" && placeableId.includes("tree")) return true;
  if (/^tree_/.test(placeableId)) return true;
  if (placeableId === "camping__tree") return true;
  return false;
}
