import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { MoveBurst } from "@/components/scene/useMoveBursts";

const BURST_MS = 650;
const SAGE = "#7a9e7e";
const SAGE_BRIGHT = "#a8c9ab";

function BurstRing({
  x,
  z,
  born,
  onDone,
}: {
  x: number;
  z: number;
  born: number;
  onDone: () => void;
}) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const done = useRef(false);

  useFrame(() => {
    const t = (performance.now() - born) / BURST_MS;
    if (t >= 1) {
      if (!done.current) {
        done.current = true;
        onDone();
      }
      return;
    }
    const ease = 1 - (1 - t) * (1 - t);
    if (outer.current) {
      const s = 0.35 + ease * 1.55;
      outer.current.scale.set(s, s, s);
      const mat = outer.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.85;
    }
    if (inner.current) {
      const s = 0.2 + ease * 0.55;
      inner.current.scale.set(s, s, s);
      const mat = inner.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.55;
    }
  });

  return (
    <group position={[x, 0.05, z]}>
      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.58, 48]} />
        <meshBasicMaterial
          color={SAGE_BRIGHT}
          transparent
          opacity={0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.22, 32]} />
        <meshBasicMaterial
          color={SAGE}
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function DestinationPulse({ x, z }: { x: number; z: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 2.4 + phase;
    const pulse = 0.5 + 0.5 * Math.sin(t);
    if (ring.current) {
      const s = 0.85 + pulse * 0.28;
      ring.current.scale.set(s, s, s);
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + pulse * 0.4;
    }
    if (core.current) {
      const mat = core.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 + pulse * 0.35;
    }
  });

  return (
    <group position={[x, 0.055, z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.34, 40]} />
        <meshBasicMaterial
          color={SAGE}
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial
          color={SAGE_BRIGHT}
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Ephemeral click bursts + looping destination marker for a commanded move. */
export function MoveMarkers({
  bursts,
  onBurstDone,
  destination,
}: {
  bursts: MoveBurst[];
  onBurstDone: (id: string) => void;
  destination: { x: number; z: number } | null;
}) {
  return (
    <group>
      {bursts.map((b) => (
        <BurstRing
          key={b.id}
          x={b.x}
          z={b.z}
          born={b.born}
          onDone={() => onBurstDone(b.id)}
        />
      ))}
      {destination && <DestinationPulse x={destination.x} z={destination.z} />}
    </group>
  );
}
