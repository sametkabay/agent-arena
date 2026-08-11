import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { forwardRef, useMemo, useRef } from "react";
import * as THREE from "three";
import { getPolyPreset } from "@/lib/poly/presets";
import type { ArenaAgent } from "@/lib/types";
import { THINKING_BUBBLE, useArenaStore } from "@/store/arenaStore";

interface Props {
  agent: ArenaAgent;
  selected: boolean;
  onPick: (e: ThreeEvent<MouseEvent>) => void;
}

const softMat = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} />
);

const Limb = forwardRef<
  THREE.Mesh,
  {
    color: string;
    args: [number, number, number, number];
    position: [number, number, number];
  }
>(function Limb({ color, args, position }, ref) {
  return (
    <mesh ref={ref} position={position} castShadow>
      <capsuleGeometry args={args} />
      {softMat(color)}
    </mesh>
  );
});

/** Soft rounded low-poly character (capsules + spheres — visible limbs). */
export function JellyAgent({ agent, selected, onPick }: Props) {
  const group = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const squash = useRef(1);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const preset = getPolyPreset(agent.polyPresetId);
  const bodyColor = agent.color || preset.defaultColor;
  const limbColor = useMemo(() => {
    const c = new THREE.Color(bodyColor);
    c.offsetHSL(0, -0.04, -0.1);
    return `#${c.getHexString()}`;
  }, [bodyColor]);

  const bodyScale =
    preset.body === "tall" ? 1.06 : preset.body === "compact" ? 0.92 : 1;
  const torsoR = preset.body === "round" ? 0.3 : 0.26;

  const moving = agent.state === "wander" || agent.state === "walk";

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime + phase;
    const bounce = moving ? 1 + Math.sin(t * 10) * 0.07 : 1 + Math.sin(t * 2.2) * 0.03;
    squash.current = THREE.MathUtils.damp(squash.current, bounce, 8, dt);
    const sy = squash.current;
    const sxz = 1 / Math.sqrt(sy);
    const selectedScale = selected ? 1.07 : 1;
    const s = bodyScale * selectedScale;
    g.scale.set(sxz * s, sy * s, sxz * s);
    g.position.set(agent.position[0], 0.02 + (sy - 1) * 0.3, agent.position[2]);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, agent.rotationY, 6, dt);

    const sway = moving ? Math.sin(t * 9) * 0.5 : Math.sin(t * 1.5) * 0.08;
    if (leftArm.current) leftArm.current.rotation.x = sway;
    if (rightArm.current) rightArm.current.rotation.x = -sway;
    if (leftLeg.current) leftLeg.current.rotation.x = -sway * 0.65;
    if (rightLeg.current) rightLeg.current.rotation.x = sway * 0.65;
  });

  const thinking = agent.state === "thinking" || agent.thinkingIntensity > 0.35;
  const bubble = agent.speechBubble || (thinking ? THINKING_BUBBLE : undefined);
  const settingsOpen = useArenaStore((s) => s.settingsOpen);
  // Keep labels below Settings (200) / Chat (100). drei Html defaults to ~16M z-index.
  const showLabels = !settingsOpen;

  return (
    <group
      ref={group}
      userData={{ agentId: agent.id }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(e);
      }}
    >
      {/* Head */}
      <mesh position={[0, 1.12, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.26, 18, 18]} />
        {softMat("#F2D6B3")}
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.09, 1.16, 0.22]} castShadow>
        <sphereGeometry args={[0.045, 10, 10]} />
        {softMat("#2C2620")}
      </mesh>
      <mesh position={[0.09, 1.16, 0.22]} castShadow>
        <sphereGeometry args={[0.045, 10, 10]} />
        {softMat("#2C2620")}
      </mesh>
      {/* Torso */}
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[torsoR, 0.28, 6, 12]} />
        {softMat(bodyColor)}
      </mesh>
      {/* Limbs */}
      <Limb
        ref={leftArm}
        color={limbColor}
        args={[0.075, 0.32, 5, 10]}
        position={[-torsoR - 0.06, 0.78, 0]}
      />
      <Limb
        ref={rightArm}
        color={limbColor}
        args={[0.075, 0.32, 5, 10]}
        position={[torsoR + 0.06, 0.78, 0]}
      />
      <Limb
        ref={leftLeg}
        color={limbColor}
        args={[0.09, 0.34, 5, 10]}
        position={[-0.13, 0.22, 0]}
      />
      <Limb
        ref={rightLeg}
        color={limbColor}
        args={[0.09, 0.34, 5, 10]}
        position={[0.13, 0.22, 0]}
      />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.48, 0.62, 28]} />
          <meshBasicMaterial color="#7a9e7e" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
      {showLabels && (
        <Html
          position={[0, 2.05, 0]}
          center
          distanceFactor={10}
          zIndexRange={[45, 10]}
          className="agent-html-overlay"
        >
          <button
            type="button"
            className={
              "agent-label" + (selected ? " agent-label--selected" : "")
            }
            onClick={(ev) => {
              ev.stopPropagation();
              useArenaStore.getState().selectAgent(agent.id);
            }}
          >
            {agent.displayName}
          </button>
        </Html>
      )}
      {showLabels && bubble && (
        <Html
          position={[0, 2.45, 0]}
          center
          distanceFactor={10}
          zIndexRange={[45, 10]}
          style={{ pointerEvents: "none" }}
          className="agent-html-overlay"
        >
          <div className="agent-speech">{bubble}</div>
        </Html>
      )}
    </group>
  );
}
