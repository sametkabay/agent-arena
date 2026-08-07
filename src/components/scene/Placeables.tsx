import { Suspense, useEffect, useMemo, Component, type ReactNode } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  Box3,
  Vector3,
  type AnimationClip,
  type Mesh,
  type Object3D,
} from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  isPlaceableId,
  pickClipName,
  PLACEABLE_SPECS,
  type PlaceableId,
  type PlaceableSpec,
} from "@/lib/assets/catalog";
import { PolyProp } from "@/components/scene/PolyProps";
import {
  CampfireFx,
  FireMeshTicker,
  getFireFxKind,
  prepareFireMesh,
} from "@/components/scene/CampfireFx";
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

function resolveScale(root: Object3D, spec: PlaceableSpec): number {
  if (spec.autoFit && spec.targetSize) {
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    box.getSize(size);
    const dim =
      spec.autoFit === "xz" ? Math.max(size.x, size.z) : size.y;
    if (Number.isFinite(dim) && dim > 1e-6) {
      return spec.targetSize / dim;
    }
  }
  return spec.scale ?? 1;
}

function KenneyGlb({
  path,
  spec,
  locomotion,
  animateFire,
}: {
  path: string;
  spec: PlaceableSpec;
  locomotion?: "idle" | "walk";
  animateFire?: boolean;
}) {
  const { scene, animations } = useGLTF(path) as {
    scene: Object3D;
    animations: AnimationClip[];
  };

  const shouldAnimateFire = Boolean(animateFire);

  const { clone, scale, fireMeshes } = useMemo(() => {
    const c = cloneSkinned(scene);
    groundGlb(c);
    const s = resolveScale(c, spec);
    const fireMeshes = shouldAnimateFire ? prepareFireMesh(c) : [];
    return { clone: c, scale: s, fireMeshes };
  }, [scene, spec, shouldAnimateFire]);

  const { actions, names } = useAnimations(animations, clone);
  const walkName = useMemo(
    () => pickClipName(names, spec.walkClipHints),
    [names, spec.walkClipHints],
  );
  const idleName = useMemo(
    () => pickClipName(names, spec.idleClipHints) ?? walkName,
    [names, spec.idleClipHints, walkName],
  );

  useEffect(() => {
    if (!spec.canWander || !actions || names.length === 0) return;
    const want =
      locomotion === "walk"
        ? walkName ?? idleName
        : idleName ?? walkName;
    if (!want) return;

    for (const [name, action] of Object.entries(actions)) {
      if (!action) continue;
      if (name === want) {
        action.reset().fadeIn(0.2).play();
      } else if (action.isRunning()) {
        action.fadeOut(0.2);
      }
    }
    return () => {
      for (const action of Object.values(actions)) {
        action?.fadeOut(0.1);
      }
    };
  }, [spec.canWander, actions, names, locomotion, walkName, idleName]);

  return (
    <group scale={scale}>
      <primitive object={clone} />
      <FireMeshTicker meshes={fireMeshes} />
    </group>
  );
}

function PlaceableMesh({
  id,
  locomotion,
  animateFire,
}: {
  id: PlaceableId;
  locomotion?: "idle" | "walk";
  animateFire?: boolean;
}) {
  const spec = PLACEABLE_SPECS[id];
  const fallback = <PolyProp id={id} />;
  if (!spec?.glb) return fallback;

  return (
    <PropErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <KenneyGlb
          path={spec.glb}
          spec={spec}
          locomotion={locomotion}
          animateFire={animateFire}
        />
      </Suspense>
    </PropErrorBoundary>
  );
}

/** Editor / play placeable meshes (wander assets animate when locomotion is set). */
export function Placeables({ items }: { items: PlaceableInstance[] }) {
  return (
    <group>
      {items.map((item) => {
        if (!isPlaceableId(item.placeableId)) return null;
        const loco = PLACEABLE_SPECS[item.placeableId]?.canWander
          ? item.behavior === "wander"
            ? (item.locomotion ?? "idle")
            : "idle"
          : undefined;
        const fireKind = getFireFxKind(item.placeableId);
        // Fire: animate unless explicitly static (omit / "animated" → on).
        const animateFire =
          fireKind === "fire" && item.behavior !== "static";
        return (
          <group
            key={item.id}
            position={item.position}
            rotation={[0, item.rotationY, 0]}
            scale={item.scale ?? 1}
          >
            <PlaceableMesh
              id={item.placeableId}
              locomotion={loco}
              animateFire={animateFire}
            />
            {fireKind === "campfire" && <CampfireFx />}
          </group>
        );
      })}
    </group>
  );
}
