import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  ALL_CHARACTERS,
  characterYawOffset,
  getCharacter,
} from "@/lib/assets/characters";
import { pickClipName } from "@/lib/assets/catalog";
import { fitGlbToHeight, prepareCharacterMeshes, skinnedWorldBox } from "@/lib/three/glbFit";
import {
  applyCharacterProportions,
  scaleHeadAnimationTracks,
} from "@/lib/three/characterRig";
import type { ArenaAgent } from "@/lib/types";
import { THINKING_BUBBLE, useArenaStore } from "@/store/arenaStore";
import { JellyAgent } from "@/components/scene/JellyAgent";

interface CharacterAgentProps {
  agent: ArenaAgent;
  selected: boolean;
  onPick: (e: ThreeEvent<MouseEvent>) => void;
}

for (const spec of ALL_CHARACTERS) {
  useGLTF.preload(spec.glb);
}

class PropErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function ProceduralWalk({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (!active) {
      g.position.y = 0;
      g.rotation.x = 0;
      g.rotation.z = 0;
      return;
    }
    const t = clock.elapsedTime * 11;
    g.position.y = Math.abs(Math.sin(t)) * 0.035;
    g.rotation.z = Math.sin(t) * 0.1;
    g.rotation.x = Math.sin(t * 2) * 0.035;
  });
  return <group ref={ref}>{children}</group>;
}

function AgentLabels({
  agent,
  selected,
  height,
}: {
  agent: ArenaAgent;
  selected: boolean;
  height: number;
}) {
  const settingsOpen = useArenaStore((s) => s.settingsOpen);
  const showLabels = !settingsOpen;
  const thinking = agent.state === "thinking" || agent.thinkingIntensity > 0.35;
  const bubble = agent.speechBubble || (thinking ? THINKING_BUBBLE : undefined);

  return (
    <>
      {showLabels && (
        <Html
          position={[0, height + 0.22, 0]}
          center
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
          position={[0, height + 0.62, 0]}
          center
          zIndexRange={[45, 10]}
          style={{ pointerEvents: "none" }}
          className="agent-html-overlay"
        >
          <div className="agent-speech">{bubble}</div>
        </Html>
      )}
    </>
  );
}

function GlbCharacter({ agent, selected, onPick }: CharacterAgentProps) {
  const spec = getCharacter(agent.characterId);
  const yawOffset = characterYawOffset(spec);
  const group = useRef<THREE.Group>(null);
  const { scene, animations: rawClips } = useGLTF(spec.glb) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const headScale = spec.headScale ?? 1;

  const animations = useMemo(() => {
    // Jump/Grounded key Head.scale ~1. Instantiating those clipActions makes the
    // mixer own Head.scale and restore bind pose (giant cube) every frame.
    const clips = rawClips
      .filter((c) => /idle|walk|sprint/i.test(c.name))
      .map((c) => c.clone());
    scaleHeadAnimationTracks(clips, headScale);
    return clips;
  }, [rawClips, headScale]);

  const { clone, scale, offset, height } = useMemo(() => {
    const c = cloneSkinned(scene);
    prepareCharacterMeshes(c);
    // Fit the authored model first so the body stays at the original map scale.
    const fit = fitGlbToHeight(c, spec.targetHeight);
    applyCharacterProportions(c, headScale);
    const shrunk = skinnedWorldBox(c);
    const size = new THREE.Vector3();
    shrunk.getSize(size);
    return {
      clone: c,
      scale: fit.scale,
      offset: fit.offset,
      height: size.y * fit.scale,
    };
  }, [scene, spec.targetHeight, headScale]);

  const { actions, names, mixer } = useAnimations(animations, clone);
  const walkName = useMemo(
    () => pickClipName(names, spec.walkClipHints),
    [names, spec.walkClipHints],
  );
  const idleName = useMemo(
    () => pickClipName(names, spec.idleClipHints) ?? walkName,
    [names, spec.idleClipHints, walkName],
  );
  const sprintName = useMemo(
    () => pickClipName(names, spec.sprintClipHints) ?? walkName,
    [names, spec.sprintClipHints, walkName],
  );

  const moving = agent.state === "wander" || agent.state === "walk";
  const commanded = Boolean(agent.commandTarget);

  useEffect(() => {
    const orig = mixer.update.bind(mixer);
    mixer.update = (dt: number) => {
      orig(dt);
      applyCharacterProportions(clone, headScale);
      return mixer;
    };
    applyCharacterProportions(clone, headScale);
    return () => {
      mixer.update = orig;
    };
  }, [mixer, clone, headScale]);

  useEffect(() => {
    const playable = [
      ...new Set(
        [idleName, walkName, sprintName].filter((n): n is string => Boolean(n)),
      ),
    ];
    if (playable.length === 0) return;
    const want = moving
      ? commanded
        ? sprintName ?? walkName ?? idleName
        : walkName ?? idleName
      : idleName ?? walkName;
    if (!want) return;

    for (const name of playable) {
      const action = actions[name];
      if (!action) continue;
      if (name === want) {
        action.reset().fadeIn(0.18).play();
      } else if (action.isRunning()) {
        action.fadeOut(0.18);
      }
    }
    return () => {
      for (const name of playable) {
        actions[name]?.fadeOut(0.08);
      }
    };
  }, [actions, moving, commanded, walkName, idleName, sprintName]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.set(agent.position[0], 0, agent.position[2]);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, agent.rotationY, 6, dt);
  });

  const useProceduralWalk = names.length === 0;
  const mesh = <primitive object={clone} />;
  const ringR = Math.max(spec.radius, spec.footprint[0] * 0.55);

  return (
    <group
      ref={group}
      userData={{ agentId: agent.id }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(e);
      }}
    >
      <group rotation={[0, yawOffset, 0]}>
        <group position={offset} scale={scale}>
          {useProceduralWalk ? (
            <ProceduralWalk active={moving}>{mesh}</ProceduralWalk>
          ) : (
            mesh
          )}
        </group>
      </group>
      <mesh
        visible={false}
        position={[0, height * 0.45, 0]}
        userData={{ agentId: agent.id }}
      >
        <capsuleGeometry args={[spec.radius, height * 0.72, 4, 8]} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[ringR * 0.85, ringR * 1.15, 28]} />
          <meshBasicMaterial
            color={agent.color || "#7a9e7e"}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      )}
      <AgentLabels agent={agent} selected={selected} height={height} />
    </group>
  );
}

function AgentStandIn({ agent, selected, onPick }: CharacterAgentProps) {
  const spec = getCharacter(agent.characterId);
  const h = spec.targetHeight;
  return (
    <group
      position={[agent.position[0], 0, agent.position[2]]}
      userData={{ agentId: agent.id }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(e);
      }}
    >
      <mesh position={[0, h * 0.45, 0]} castShadow>
        <capsuleGeometry args={[spec.radius * 0.85, h * 0.55, 5, 10]} />
        <meshStandardMaterial
          color={agent.color}
          roughness={0.6}
          metalness={0.04}
          transparent
          opacity={0.4}
        />
      </mesh>
      <AgentLabels agent={agent} selected={selected} height={h} />
    </group>
  );
}

/** GLB character on the map; jelly is only a load/error fallback. */
export function CharacterAgent(props: CharacterAgentProps) {
  const lookId = getCharacter(props.agent.characterId).id;
  return (
    <PropErrorBoundary fallback={<JellyAgent {...props} />}>
      <Suspense fallback={<AgentStandIn {...props} />}>
        <GlbCharacter key={lookId} {...props} />
      </Suspense>
    </PropErrorBoundary>
  );
}

export { JellyAgent };
