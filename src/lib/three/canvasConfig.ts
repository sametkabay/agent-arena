import * as THREE from "three";
import type { RootState } from "@react-three/fiber";

/**
 * Configure WebGL renderer for three r183+ compatibility:
 * - PCFShadowMap (PCFSoftShadowMap is deprecated; PCF is soft now)
 */
export function configureRenderer(gl: THREE.WebGLRenderer): void {
  gl.shadowMap.type = THREE.PCFShadowMap;
}

/** R3F Canvas `onCreated` helper. */
export function onCanvasCreated({ gl }: RootState): void {
  configureRenderer(gl);
}

/**
 * Prefer this over `shadows={true}` — R3F maps `true`/`"soft"` to deprecated
 * PCFSoftShadowMap. `"percentage"` → PCFShadowMap.
 */
export const CANVAS_SHADOWS = "percentage" as const;
