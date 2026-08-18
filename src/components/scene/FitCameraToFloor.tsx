import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Vector3 } from "three";

type CameraControls = {
  target?: Vector3;
  update?: () => void;
};

/** Fit larger built-in maps on first load while leaving OrbitControls interactive. */
export function FitCameraToFloor({
  floorSize,
  viewKey,
  basePosition = [16, 18, 20],
}: {
  floorSize: number;
  viewKey: string;
  basePosition?: [number, number, number];
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as CameraControls | null;
  const [baseX, baseY, baseZ] = basePosition;

  useEffect(() => {
    const scale =
      floorSize > 30 ? floorSize / 20 : Math.max(1, floorSize / 24);
    camera.position.set(
      baseX * scale,
      baseY * scale,
      baseZ * scale,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls?.target?.set(0, 0, 0);
    controls?.update?.();
  }, [baseX, baseY, baseZ, camera, controls, floorSize, viewKey]);

  return null;
}
