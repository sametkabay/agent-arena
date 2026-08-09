import { Suspense, useEffect, useMemo, Component, type ReactNode } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  Box3,
  Color,
  Vector3,
  type AnimationClip,
  type Mesh,
  type MeshStandardMaterial,
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
import { getLampKind, LampFx } from "@/components/scene/LampFx";
import { TreeSway, isSwayPlaceable } from "@/components/scene/TreeSway";
import type { PlaceableInstance } from "@/lib/types";

/** Match procedural `wall_solid` (PropWallSolid) cream palette. */
const WALL_SOLID_PALETTE = {
  body: new Color("#E8E2D6"),
  trim: new Color("#BFAF9A"),
  trimLight: new Color("#D2C8B8"),
  glass: new Color("#C5D0C8"),
};

function isKenneyWallLikeGlb(path: string): boolean {
  const n = decodeURIComponent(path).toLowerCase();
  return /wall window|wall doorway|doorway/.test(n);
}

/**
 * Kenney Wall*.glb ships duplicate half-modules (`wallWindow` + `wallWindow_1`)
 * stacked on the same [-1,0] span → z-fighting. Drop the `_1` copy.
 */
function dedupeKenneyWallHalves(root: Object3D) {
  const remove: Object3D[] = [];
  root.traverse((obj) => {
    if (!obj.name.endsWith("_1")) return;
    const base = obj.name.slice(0, -2);
    if (!/wall/i.test(base)) return;
    const sibling = obj.parent?.children.find((c) => c !== obj && c.name === base);
    if (sibling) remove.push(obj);
  });
  for (const obj of remove) obj.removeFromParent();

  // Degenerate (zero-thickness) faces in the pack also z-fight.
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return;
    const dx = box.max.x - box.min.x;
    const dy = box.max.y - box.min.y;
    const dz = box.max.z - box.min.z;
    if (dx < 1e-4 || dy < 1e-4 || dz < 1e-4) mesh.visible = false;
  });
}

function cloneMeshMaterial(mat: MeshStandardMaterial): MeshStandardMaterial {
  const next = mat.clone();
  next.color = mat.color.clone();
  return next;
}

/** Retint Kenney wall/door materials to the cream solid-wall palette. */
function tintKenneyWallToSolidPalette(root: Object3D) {
  const remapped = new Map<object, MeshStandardMaterial>();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nextList = list.map((mat) => {
      const src = mat as MeshStandardMaterial;
      if (!src?.color) return mat;
      const cached = remapped.get(src);
      if (cached) return cached;
      const m = cloneMeshMaterial(src);
      remapped.set(src, m);
      const name = (m.name || "").toLowerCase();
      const { r, g, b } = src.color;
      const warmOrange = r > 0.55 && g < 0.45 && b < 0.3;
      if (name.includes("glass") || (r < 0.55 && g > 0.5 && b > 0.4 && r < g)) {
        m.color.copy(WALL_SOLID_PALETTE.glass);
        m.roughness = Math.max(m.roughness ?? 0.4, 0.35);
        m.metalness = 0.05;
        m.transparent = true;
        m.opacity = Math.min(m.opacity ?? 0.55, 0.55);
      } else if (name.includes("wood") || warmOrange) {
        // Frame trim → same as solid wall baseboard
        m.color.copy(WALL_SOLID_PALETTE.trim);
        m.roughness = 0.88;
        m.metalness = 0.02;
      } else if (name.includes("metal") || (r < 0.2 && g < 0.25 && b < 0.25)) {
        // Dark metal → solid wall crown trim
        m.color.copy(WALL_SOLID_PALETTE.trimLight);
        m.roughness = 0.82;
        m.metalness = 0.04;
      } else {
        // `_defaultMat` / wall body → PropWallSolid cream
        m.color.copy(WALL_SOLID_PALETTE.body);
        m.roughness = 0.88;
        m.metalness = 0.02;
      }
      m.needsUpdate = true;
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? nextList : nextList[0];
  });
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
    if (isKenneyWallLikeGlb(path)) {
      dedupeKenneyWallHalves(c);
      tintKenneyWallToSolidPalette(c);
    }
    groundGlb(c);
    const s = resolveScale(c, spec);
    const fireMeshes = shouldAnimateFire ? prepareFireMesh(c) : [];
    return { clone: c, scale: s, fireMeshes };
  }, [scene, spec, shouldAnimateFire, path]);

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
        const spec = PLACEABLE_SPECS[item.placeableId];
        const loco = spec?.canWander
          ? item.behavior === "wander"
            ? (item.locomotion ?? "idle")
            : "idle"
          : undefined;
        const fireKind = getFireFxKind(item.placeableId);
        const lampKind = getLampKind(item.placeableId);
        // Fire: animate unless explicitly static (omit / "animated" → on).
        const animateFire =
          fireKind === "fire" && item.behavior !== "static";
        const sway = isSwayPlaceable(item.placeableId, spec?.category);
        const phase =
          (item.position[0] * 0.37 + item.position[2] * 0.51) % (Math.PI * 2);
        const mesh = (
          <>
            <PlaceableMesh
              id={item.placeableId}
              locomotion={loco}
              animateFire={animateFire}
            />
            {fireKind === "campfire" && <CampfireFx />}
            {lampKind && <LampFx kind={lampKind} />}
          </>
        );
        return (
          <group
            key={item.id}
            position={item.position}
            rotation={[0, item.rotationY, 0]}
            scale={item.scale ?? 1}
          >
            {sway ? (
              <TreeSway phase={phase} strength={0.028 + (item.scale ?? 1) * 0.008}>
                {mesh}
              </TreeSway>
            ) : (
              mesh
            )}
          </group>
        );
      })}
    </group>
  );
}
