import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { getMap, shadowMapSize } from "@/lib/maps";
import { useArenaStore } from "@/store/arenaStore";
import { CharacterAgent } from "@/components/scene/CharacterAgent";
import { OfficeFloor } from "@/components/scene/OfficeFloor";
import { Placeables } from "@/components/scene/Placeables";

function SceneTick() {
  useFrame((_, dt) => {
    useArenaStore.getState().tick(Math.min(dt, 0.05), Date.now());
  });
  return null;
}

function ArenaWorld() {
  const floorSize = useArenaStore((s) => s.floorSize);
  const placeables = useArenaStore((s) => s.placeables);
  const agents = useArenaStore((s) => s.runtimeAgents);
  const mapId = useArenaStore((s) => s.mapId);
  const graphics = useArenaStore((s) => s.graphics);
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const selectAgent = useArenaStore((s) => s.selectAgent);
  const theme = getMap(mapId).theme;

  const camTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, floorSize * 2.8, floorSize * 6]} />
      <ambientLight intensity={0.55} color={theme.ambient} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.55]} />
      <directionalLight
        castShadow={graphics.castShadows}
        position={[8, 14, 6]}
        intensity={1.15}
        color={theme.sun}
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
      {graphics.roomLights && (
        <>
          <pointLight position={[-4, 3, -3]} intensity={0.35} color="#fff2dd" />
          <pointLight position={[5, 3, 4]} intensity={0.28} color="#e8f0ff" />
        </>
      )}

      <OfficeFloor size={floorSize} mapId={mapId} />
      <Placeables items={placeables} />

      {agents.map((agent) => (
        <CharacterAgent
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          onClick={() => selectAgent(agent.id)}
        />
      ))}

      {graphics.contactShadows && (
        <ContactShadows
          key={`contact-${agents.length}-${floorSize}`}
          position={[0, 0.04, 0]}
          opacity={0.38}
          scale={floorSize * 1.15}
          blur={2.6}
          far={8}
          resolution={512}
          frames={Infinity}
        />
      )}

      <OrbitControls
        makeDefault
        target={camTarget}
        enablePan
        enableDamping
        dampingFactor={0.18}
        rotateSpeed={0.72}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={0.15}
        minDistance={4}
        maxDistance={Math.max(48, floorSize * 2.4)}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
      <SceneTick />
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

export function ArenaScene() {
  const graphics = useArenaStore((s) => s.graphics);

  return (
    <div className="scene-root">
      <Canvas
        key={`${graphics.antialias}-${graphics.maxDpr}-${graphics.castShadows}`}
        shadows={graphics.castShadows}
        dpr={[1, graphics.maxDpr]}
        camera={{ position: [16, 18, 20], fov: 42, near: 0.1, far: 280 }}
        gl={{ antialias: graphics.antialias }}
        onPointerMissed={() => useArenaStore.getState().selectAgent(null)}
      >
        <ArenaWorld />
      </Canvas>
    </div>
  );
}
