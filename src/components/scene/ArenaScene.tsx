import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { shadowMapSize } from "@/lib/maps";
import { resolveSceneLighting } from "@/lib/dayNight";
import { CANVAS_SHADOWS, onCanvasCreated } from "@/lib/three/canvasConfig";
import {
  agentIdsFromIntersections,
  pickStackedAgent,
} from "@/lib/three/pickAgents";
import { useArenaStore } from "@/store/arenaStore";
import { CharacterAgent } from "@/components/scene/CharacterAgent";
import { ArenaFloor } from "@/components/scene/OfficeFloor";
import { Placeables } from "@/components/scene/Placeables";
import {
  MoveMarkers,
  useMoveBursts,
} from "@/components/scene/MoveMarkers";

function SceneTick({ dormant }: { dormant: boolean }) {
  useFrame((_, dt) => {
    if (dormant) return;
    useArenaStore.getState().tick(Math.min(dt, 0.05), Date.now());
  });
  return null;
}

/** Right-click on the ground sends the selected agent (works through props). */
function FloorCommandClick({
  floorSize,
  onSend,
}: {
  floorSize: number;
  onSend: (x: number, z: number) => void;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    const onContextMenu = (ev: MouseEvent) => {
      ev.preventDefault();
      const selectedId = useArenaStore.getState().selectedAgentId;
      if (!selectedId) return;

      const rect = el.getBoundingClientRect();
      ndc.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;

      const half = floorSize / 2 - 1.2;
      const x = Math.max(-half, Math.min(half, hit.x));
      const z = Math.max(-half, Math.min(half, hit.z));
      onSend(x, z);
    };

    el.addEventListener("contextmenu", onContextMenu);
    return () => el.removeEventListener("contextmenu", onContextMenu);
  }, [camera, gl, floorSize, onSend]);

  return null;
}

function ArenaWorld({ dormant }: { dormant: boolean }) {
  const floorSize = useArenaStore((s) => s.floorSize);
  const placeables = useArenaStore((s) => s.placeables);
  const agents = useArenaStore((s) => s.runtimeAgents);
  const activeMap = useArenaStore((s) => s.activeMap);
  const graphics = useArenaStore((s) => s.graphics);
  const dayNight = useArenaStore((s) => s.dayNight);
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const selectAgent = useArenaStore((s) => s.selectAgent);
  const commandAgentTo = useArenaStore((s) => s.commandAgentTo);
  const theme = activeMap?.theme;
  const lighting = useMemo(
    () => (theme ? resolveSceneLighting(theme, dayNight) : null),
    [theme, dayNight],
  );
  const floor = activeMap?.floor ?? {
    size: floorSize,
    style: "checker" as const,
    cells: 8,
    color: "#D2C9BB",
  };

  const camTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const { bursts, addBurst, removeBurst } = useMoveBursts();

  const onAgentPick = (e: ThreeEvent<MouseEvent>) => {
    const stack = agentIdsFromIntersections(e.intersections);
    const next = pickStackedAgent(stack, selectedAgentId);
    if (next) selectAgent(next);
  };

  const onSendTo = useMemo(() => {
    return (x: number, z: number) => {
      const id = useArenaStore.getState().selectedAgentId;
      if (!id) return;
      commandAgentTo(id, [x, 0, z]);
      addBurst(x, z);
    };
  }, [commandAgentTo, addBurst]);

  const selected = agents.find((a) => a.id === selectedAgentId);
  const destination =
    selected?.commandTarget != null
      ? {
          x: selected.commandTarget[0],
          z: selected.commandTarget[2],
        }
      : null;

  const orbitButtons = useMemo(
    () =>
      (selectedAgentId
        ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY }
        : {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }) as {
        LEFT: THREE.MOUSE;
        MIDDLE: THREE.MOUSE;
        RIGHT?: THREE.MOUSE;
      },
    [selectedAgentId],
  );

  if (!theme || !lighting) return null;

  return (
    <>
      <color attach="background" args={[lighting.background]} />
      <fog
        attach="fog"
        args={[lighting.fog, floorSize * 2.8, floorSize * 6]}
      />
      <ambientLight
        intensity={lighting.ambientIntensity}
        color={lighting.ambient}
      />
      <hemisphereLight
        args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiIntensity]}
      />
      <directionalLight
        castShadow={graphics.castShadows}
        position={lighting.sunPosition}
        intensity={lighting.sunIntensity}
        color={lighting.sun}
        shadow-mapSize-width={shadowMapSize(graphics.shadowQuality)}
        shadow-mapSize-height={shadowMapSize(graphics.shadowQuality)}
        shadow-bias={-0.00035}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-(floorSize / 2 + 4)}
        shadow-camera-right={floorSize / 2 + 4}
        shadow-camera-top={floorSize / 2 + 4}
        shadow-camera-bottom={-(floorSize / 2 + 4)}
      />
      {lighting.fillIntensity > 0 && (
        <pointLight
          position={lighting.fillPosition}
          intensity={lighting.fillIntensity}
          color={lighting.fillColor}
          distance={floorSize * 1.8}
          decay={2}
        />
      )}
      {graphics.roomLights && (
        <>
          <pointLight
            position={[-4, 3, -3]}
            intensity={dayNight === "night" ? 0.55 : 0.35}
            color={dayNight === "night" ? "#ffcc88" : "#fff2dd"}
          />
          <pointLight
            position={[5, 3, 4]}
            intensity={dayNight === "night" ? 0.42 : 0.28}
            color={dayNight === "night" ? "#a8c0ff" : "#e8f0ff"}
          />
        </>
      )}

      <ArenaFloor floor={{ ...floor, size: floorSize }} />
      <Placeables items={placeables} />

      {agents.map((agent) => (
        <CharacterAgent
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          onPick={onAgentPick}
        />
      ))}

      <MoveMarkers
        bursts={bursts}
        onBurstDone={removeBurst}
        destination={destination}
      />

      <FloorCommandClick floorSize={floorSize} onSend={onSendTo} />

      {graphics.contactShadows && (
        <ContactShadows
          key={`contact-${floorSize}`}
          position={[0, 0.04, 0]}
          opacity={0.38}
          scale={floorSize * 1.15}
          blur={2.4}
          far={8}
          resolution={256}
          frames={Infinity}
        />
      )}

      <OrbitControls
        makeDefault
        target={camTarget}
        enablePan={!selectedAgentId}
        enableDamping
        dampingFactor={0.18}
        rotateSpeed={0.72}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={0.15}
        minDistance={4}
        maxDistance={Math.max(48, floorSize * 2.4)}
        mouseButtons={orbitButtons}
      />
      <SceneTick dormant={dormant} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        onClick={() => selectAgent(null)}
      >
        <planeGeometry args={[floorSize * 3, floorSize * 3]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export function ArenaScene({ dormant = false }: { dormant?: boolean }) {
  const graphics = useArenaStore((s) => s.graphics);

  return (
    <div className="scene-root" onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        // Only remount when antialias changes (requires new GL context).
        key={graphics.antialias ? "aa" : "noaa"}
        frameloop={dormant ? "never" : "always"}
        shadows={graphics.castShadows ? CANVAS_SHADOWS : false}
        dpr={[1, graphics.maxDpr]}
        camera={{ position: [16, 18, 20], fov: 42, near: 0.1, far: 280 }}
        gl={{
          antialias: graphics.antialias,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={onCanvasCreated}
        onPointerMissed={() => {
          if (dormant) return;
          useArenaStore.getState().selectAgent(null);
        }}
      >
        <ArenaWorld dormant={dormant} />
      </Canvas>
    </div>
  );
}
