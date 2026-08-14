import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useArenaStore } from "@/store/arenaStore";
import { EmberParticles } from "@/components/scene/EmberParticles";
import {
  prepareFireMesh,
  type FireTongueMesh,
} from "@/components/scene/fireFx";

const flameVert = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float tip = uv.y * uv.y;
  p.x += sin(uTime * 9.0 + uv.y * 10.0) * 0.05 * tip;
  p.z += cos(uTime * 7.5 + uv.y * 8.0) * 0.04 * tip;
  p.y += sin(uTime * 12.0 + uv.x * 6.0) * 0.02 * tip;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const flameFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  float flicker = 0.82 + 0.18 * sin(uTime * 19.0 + vUv.x * 14.0);
  float rise = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.4, 1.0, vUv.y));
  float waist = 1.0 - abs(vUv.x - 0.5) * 2.0;
  waist = pow(max(waist, 0.0), 1.35);
  float wave = sin(uTime * 11.0 + vUv.y * 14.0 + vUv.x * 5.0) * 0.1;
  waist *= smoothstep(0.0, 0.5, waist + wave);
  float heat = rise * waist * flicker;
  vec3 core = vec3(1.0, 0.92, 0.55);
  vec3 mid = vec3(1.0, 0.45, 0.08);
  vec3 tip = vec3(0.95, 0.18, 0.02);
  vec3 col = mix(mid, tip, smoothstep(0.15, 0.95, vUv.y));
  col = mix(col, core, pow(heat, 2.6) * (1.0 - vUv.y));
  float alpha = heat * 0.9;
  if (alpha < 0.03) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

function FlamePlane({
  rotationY,
  width,
  height,
  offset,
}: {
  rotationY: number;
  width: number;
  height: number;
  offset?: [number, number, number];
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });

  return (
    <mesh rotation={[0, rotationY, 0]} position={offset ?? [0, 0, 0]}>
      <planeGeometry args={[width, height, 8, 12]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={flameVert}
        fragmentShader={flameFrag}
      />
    </mesh>
  );
}

/** Campfire-only: shader flame planes + warm light (overlay on the prop). */
export function CampfireFx() {
  const lampLights = useArenaStore((s) => s.graphics.lampLights);
  const dayNight = useArenaStore((s) => s.dayNight);
  const light = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  const nightBoost = dayNight === "night" ? 1.55 : 1;

  useFrame((_, dt) => {
    t.current += dt;
    if (!light.current) return;
    const pulse =
      0.85 +
      0.15 * Math.sin(t.current * 14) +
      0.08 * Math.sin(t.current * 27.3);
    light.current.intensity =
      (lampLights ? 1.7 : 1.05) * pulse * nightBoost;
  });

  return (
    <group position={[0, 0.3, 0]}>
      <FlamePlane rotationY={0} width={0.58} height={0.86} offset={[0, 0.3, 0]} />
      <FlamePlane
        rotationY={Math.PI / 2}
        width={0.58}
        height={0.86}
        offset={[0, 0.3, 0]}
      />
      <FlamePlane
        rotationY={Math.PI / 4}
        width={0.4}
        height={0.58}
        offset={[0, 0.24, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial
          color="#ff6a22"
          transparent
          opacity={dayNight === "night" ? 0.32 : 0.24}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={light}
        color="#ff7a32"
        intensity={(lampLights ? 1.7 : 1.05) * nightBoost}
        distance={lampLights ? 12.5 : 8}
        decay={2}
        position={[0, 0.42, 0]}
      />
      <EmberParticles count={22} height={1.35} />
    </group>
  );
}

/** Tick tongue stretch on a prepared single-mesh fire. */
export function FireMeshTicker({ meshes }: { meshes: FireTongueMesh[] }) {
  const lampLights = useArenaStore((s) => s.graphics.lampLights);
  const dayNight = useArenaStore((s) => s.dayNight);
  const light = useRef<THREE.PointLight>(null);
  const t = useRef(Math.random() * 8);
  const nightBoost = dayNight === "night" ? 1.6 : 1;

  useFrame((_, dt) => {
    if (meshes.length === 0) return;
    t.current += dt;
    const time = t.current;

    // Shared “heartbeat” so the whole flame feels like one fire.
    const body =
      0.55 +
      0.45 *
        (0.5 + 0.5 * Math.sin(time * 5.2) + 0.25 * Math.sin(time * 9.1));

    for (const entry of meshes) {
      const { pos, base, tip, arm, radialX, radialZ, mats } = entry;
      const arr = pos.array as Float32Array;
      const n = tip.length;

      for (let i = 0; i < n; i++) {
        const w = tip[i]!;
        const bx = base[i * 3]!;
        const by = base[i * 3 + 1]!;
        const bz = base[i * 3 + 2]!;
        if (w < 0.01) {
          arr[i * 3] = bx;
          arr[i * 3 + 1] = by;
          arr[i * 3 + 2] = bz;
          continue;
        }

        // Mild tongue phase — same body pulse, slight offset per arm.
        const a = arm[i]!;
        const tongue =
          Math.sin(time * 7.4 + a * 1.15) * 0.55 +
          Math.sin(time * 12.8 + a * 0.7) * 0.3;
        // Stretch / shrink mostly along Y (what “uzayıp kısalma” means).
        const stretch = (0.65 * body + 0.35 * (0.5 + 0.5 * tongue)) * w;
        const dy = stretch * 0.28;

        // Soft lean — small, shared so pieces don’t tear apart.
        const lean =
          Math.sin(time * 4.6 + a * 0.4) * 0.04 +
          Math.sin(time * 8.3) * 0.025;
        const rx = radialX[i]!;
        const rz = radialZ[i]!;

        arr[i * 3] = bx + rx * lean * w;
        arr[i * 3 + 1] = by + dy;
        arr[i * 3 + 2] = bz + rz * lean * w;
      }

      pos.needsUpdate = true;
      entry.mesh.geometry.computeBoundingSphere();

      const heat = 1.1 + 0.25 * body + 0.1 * Math.sin(time * 16);
      for (const mat of mats) mat.emissiveIntensity = heat * (dayNight === "night" ? 1.35 : 1);
    }

    if (light.current) {
      const pulse =
        0.88 + 0.12 * Math.sin(time * 12) + 0.06 * Math.sin(time * 25);
      light.current.intensity =
        (lampLights ? 1.35 : 0.75) * pulse * nightBoost;
    }
  });

  if (meshes.length === 0) return null;

  return (
    <group>
      <pointLight
        ref={light}
        color="#ff7a32"
        intensity={(lampLights ? 1.35 : 0.75) * nightBoost}
        distance={lampLights ? 9.5 : 6}
        decay={2}
        position={[0, 0.4, 0]}
      />
      <EmberParticles count={18} height={1.2} />
    </group>
  );
}

/** @deprecated — prefer prepareFireMesh + FireMeshTicker in KenneyGlb. */
export function FireMeshAnimator({ root }: { root: THREE.Object3D }) {
  const meshes = useMemo(() => prepareFireMesh(root), [root]);
  return <FireMeshTicker meshes={meshes} />;
}
