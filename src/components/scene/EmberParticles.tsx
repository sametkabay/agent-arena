import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Rising ember particles for campfires. */
export function EmberParticles({
  count = 28,
  height = 1.4,
}: {
  count?: number;
  height?: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.35;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
      speeds[i] = 0.35 + Math.random() * 0.55;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, [count, height]);

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3 + 1] += speeds[i]! * dt;
      arr[i3] += Math.sin(phases[i]! + arr[i3 + 1]! * 4) * 0.01;
      arr[i3 + 2] += Math.cos(phases[i]! + arr[i3 + 1]! * 3) * 0.01;
      if (arr[i3 + 1]! > height) {
        arr[i3] = (Math.random() - 0.5) * 0.3;
        arr[i3 + 1] = 0.05;
        arr[i3 + 2] = (Math.random() - 0.5) * 0.3;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} position={[0, 0.35, 0]} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffaa55"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
