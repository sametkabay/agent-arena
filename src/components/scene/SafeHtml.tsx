import { useFrame, useThree } from "@react-three/fiber";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";

/**
 * Minimal Html overlay (drei-compatible subset) that avoids React 19's
 * "synchronously unmount a root while React was already rendering" / removeChild
 * race: DOM is detached immediately; createRoot().unmount() is deferred.
 *
 * One createRoot per mount lifetime — never recreate on camera/size churn.
 */

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function projectToScreen(
  el: THREE.Object3D,
  camera: THREE.Camera,
  size: { width: number; height: number },
): [number, number] {
  const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
  objectPos.project(camera);
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  return [
    objectPos.x * widthHalf + widthHalf,
    -(objectPos.y * heightHalf) + heightHalf,
  ];
}

function isBehindCamera(el: THREE.Object3D, camera: THREE.Camera): boolean {
  const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
  const cameraPos = _v2.setFromMatrixPosition(camera.matrixWorld);
  const delta = objectPos.sub(cameraPos);
  const camDir = camera.getWorldDirection(_v3);
  return delta.angleTo(camDir) > Math.PI / 2;
}

function zIndexFor(
  el: THREE.Object3D,
  camera: THREE.Camera,
  zIndexRange: [number, number],
): number | undefined {
  if (
    !(camera instanceof THREE.PerspectiveCamera) &&
    !(camera instanceof THREE.OrthographicCamera)
  ) {
    return undefined;
  }
  const objectPos = _v1.setFromMatrixPosition(el.matrixWorld);
  const cameraPos = _v2.setFromMatrixPosition(camera.matrixWorld);
  const dist = objectPos.distanceTo(cameraPos);
  const A = (zIndexRange[1] - zIndexRange[0]) / (camera.far - camera.near);
  const B = zIndexRange[1] - A * camera.far;
  return Math.round(A * dist + B);
}

type SafeHtmlProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  center?: boolean;
  eps?: number;
  zIndexRange?: [number, number];
  position?: [number, number, number];
};

export function SafeHtml({
  children,
  className,
  style,
  center = false,
  eps = 0.001,
  zIndexRange = [45, 10],
  position,
}: SafeHtmlProps) {
  const { gl, camera, size, events } = useThree();
  const group = useRef<THREE.Group>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const oldZoom = useRef(0);
  const oldPosition = useRef<[number, number]>([0, 0]);
  const visible = useRef(true);

  const target =
    (events.connected as HTMLElement | undefined) ||
    (gl.domElement.parentNode as HTMLElement | null);

  // Mount portal host + root once; reparent if the canvas host changes.
  useLayoutEffect(() => {
    if (!target) return;
    const el = elRef.current ?? document.createElement("div");
    elRef.current = el;
    if (!rootRef.current) {
      rootRef.current = createRoot(el);
    }
    if (el.parentNode !== target) {
      el.parentNode?.removeChild(el);
      target.appendChild(el);
    }
    el.style.cssText =
      "position:absolute;top:0;left:0;transform:translate3d(0,0,0);transform-origin:0 0;";
    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [target]);

  // Defer nested-root teardown until after the parent R3F/React commit.
  useLayoutEffect(() => {
    return () => {
      const root = rootRef.current;
      rootRef.current = null;
      elRef.current = null;
      if (!root) return;
      queueMicrotask(() => {
        try {
          root.unmount();
        } catch {
          /* already unmounted */
        }
      });
    };
  }, []);

  const styles = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      transform: center ? "translate3d(-50%,-50%,0)" : "none",
      ...style,
    }),
    [style, center],
  );

  useLayoutEffect(() => {
    rootRef.current?.render(
      <div style={styles} className={className}>
        {children}
      </div>,
    );
  });

  useFrame(() => {
    const g = group.current;
    const el = elRef.current;
    if (!g || !el) return;
    camera.updateMatrixWorld();
    g.updateWorldMatrix(true, false);
    const vec = projectToScreen(g, camera, size);
    if (
      Math.abs(oldZoom.current - camera.zoom) > eps ||
      Math.abs(oldPosition.current[0] - vec[0]) > eps ||
      Math.abs(oldPosition.current[1] - vec[1]) > eps
    ) {
      const nextVisible = !isBehindCamera(g, camera);
      if (visible.current !== nextVisible) {
        visible.current = nextVisible;
        el.style.display = nextVisible ? "block" : "none";
      }
      const z = zIndexFor(g, camera, zIndexRange);
      if (z !== undefined) el.style.zIndex = String(z);
      el.style.transform = `translate3d(${vec[0]}px,${vec[1]}px,0)`;
      oldPosition.current = vec;
      oldZoom.current = camera.zoom;
    }
  });

  return <group ref={group} position={position} />;
}
