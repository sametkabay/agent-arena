import { Suspense, useMemo, Component, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Mesh, type Object3D } from "three";
import { isPlaceableId, PLACEABLE_SPECS, type PlaceableId } from "@/lib/assets/catalog";
import { PolyProp } from "@/components/scene/PolyProps";
import type { PlaceableInstance } from "@/lib/types";

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

function groundGlb(root: Object3D) {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const center = new Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
  const grounded = new Box3().setFromObject(root);
  if (Number.isFinite(grounded.min.y)) root.position.y -= grounded.min.y;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
}

function KenneyGlb({ path, scale }: { path: string; scale: number }) {
  const { scene } = useGLTF(path);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    groundGlb(c);
    return c;
  }, [scene]);
  return (
    <group scale={scale}>
      <primitive object={clone} />
    </group>
  );
}

function PlaceableMesh({ id }: { id: PlaceableId }) {
  const spec = PLACEABLE_SPECS[id];
  const fallback = <PolyProp id={id} />;
  if (!spec.glb) return fallback;

  return (
    <PropErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <KenneyGlb path={spec.glb} scale={spec.scale ?? 1} />
      </Suspense>
    </PropErrorBoundary>
  );
}

export function Placeables({ items }: { items: PlaceableInstance[] }) {
  return (
    <group>
      {items.map((item) => {
        if (!isPlaceableId(item.placeableId)) return null;
        return (
          <group
            key={item.id}
            position={item.position}
            rotation={[0, item.rotationY, 0]}
            scale={item.scale ?? 1}
          >
            <PlaceableMesh id={item.placeableId} />
          </group>
        );
      })}
    </group>
  );
}

// Preload Kenney props
Object.values(PLACEABLE_SPECS).forEach((s) => {
  if (s.glb) useGLTF.preload(s.glb);
});
