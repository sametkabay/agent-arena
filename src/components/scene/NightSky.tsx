import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Soft star field that fades in with nightAmount (0–1). */
export function NightSky({
  nightAmount,
  radius = 90,
  count = 900,
}: {
  nightAmount: number;
  radius?: number;
  count?: number;
}) {
  const mat = useRef<THREE.PointsMaterial>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Hemisphere above the horizon
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - v * 0.92); // mostly upper dome
      const r = radius * (0.92 + Math.random() * 0.08);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 2;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count, radius]);

  useFrame(({ clock }) => {
    if (!mat.current) return;
    const twinkle = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 0.7);
    mat.current.opacity = Math.min(1, Math.max(0, nightAmount)) * 0.92 * twinkle;
    mat.current.size = 0.35 + nightAmount * 0.25;
  });

  if (nightAmount < 0.02) return null;

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        color="#e8eefc"
        size={0.45}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={nightAmount}
        toneMapped={false}
      />
    </points>
  );
}

/** Very soft sky glow dome for night. */
export function NightGlow({
  nightAmount,
  color = "#1a2744",
}: {
  nightAmount: number;
  color?: string;
}) {
  if (nightAmount < 0.05) return null;
  return (
    <mesh scale={[70, 40, 70]} position={[0, 8, 0]}>
      <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18 * nightAmount}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
