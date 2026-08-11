import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  castShadow: boolean;
  position: [number, number, number];
  intensity: number;
  color: string;
  /** Shadow map resolution (e.g. 512 / 1024 / 2048). */
  mapSize: number;
  floorSize: number;
};

/**
 * Directional sun with a frustum sized to the arena floor.
 * Remounts + disposes the shadow map when resolution changes — otherwise
 * Three keeps a stale render target and shadows shift or disappear.
 */
export function SunShadowLight({
  castShadow,
  position,
  intensity,
  color,
  mapSize,
  floorSize,
}: Props) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const half = floorSize / 2 + 4;
  // Stable vs day/night sun path so we don't churn the shadow map while blending.
  const far = Math.max(64, half * 4);

  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!light) return;

    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();

    light.shadow.mapSize.set(mapSize, mapSize);
    const cam = light.shadow.camera;
    cam.near = 0.5;
    cam.far = far;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();

    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
    light.shadow.needsUpdate = true;
  }, [mapSize, castShadow, half, far]);

  return (
    <directionalLight
      key={`sun-shadow-${mapSize}-${castShadow ? 1 : 0}`}
      ref={lightRef}
      castShadow={castShadow}
      position={position}
      intensity={intensity}
      color={color}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-bias={-0.00025}
      shadow-normalBias={0.035}
      shadow-camera-near={0.5}
      shadow-camera-far={far}
      shadow-camera-left={-half}
      shadow-camera-right={half}
      shadow-camera-top={half}
      shadow-camera-bottom={-half}
    />
  );
}
