import {
  Box3,
  Vector3,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three";

/** Mesh-geometry AABB in world space (bind pose). */
export function contentBox(root: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const box = new Box3();
  let found = false;
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox || geo.boundingBox.isEmpty()) return;
    const b = geo.boundingBox.clone();
    b.applyMatrix4(mesh.matrixWorld);
    const size = new Vector3();
    b.getSize(size);
    if (Math.max(size.x, size.y, size.z) < 1e-5) return;
    if (!found) {
      box.copy(b);
      found = true;
    } else {
      box.union(b);
    }
  });
  if (found && !box.isEmpty()) return box;
  return new Box3().setFromObject(root);
}

/**
 * Visual AABB after bone skinning. Bind-pose geometry on these FBX
 * characters is not the standing silhouette.
 */
export function skinnedWorldBox(root: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const box = new Box3();
  let found = false;
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.isSkinnedMesh) {
      mesh.skeleton?.update();
      mesh.computeBoundingBox();
      if (!mesh.boundingBox || mesh.boundingBox.isEmpty()) return;
      const b = mesh.boundingBox.clone();
      b.applyMatrix4(mesh.matrixWorld);
      const size = new Vector3();
      b.getSize(size);
      if (Math.max(size.x, size.y, size.z) < 1e-5) return;
      if (!found) {
        box.copy(b);
        found = true;
      } else {
        box.union(b);
      }
      return;
    }
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox || geo.boundingBox.isEmpty()) return;
    const b = geo.boundingBox.clone();
    b.applyMatrix4(mesh.matrixWorld);
    if (!found) {
      box.copy(b);
      found = true;
    } else {
      box.union(b);
    }
  });
  if (found && !box.isEmpty()) return box;
  return contentBox(root);
}

export function prepareCharacterMeshes(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
}

export interface FittedGlb {
  scale: number;
  /** Parent-space offset so feet sit on y=0 and XZ is centered. */
  offset: [number, number, number];
  height: number;
}

/** Scale to `targetHeight` meters and ground the model. */
export function fitGlbToHeight(root: Object3D, targetHeight: number): FittedGlb {
  const box = skinnedWorldBox(root);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const h = size.y > 1e-6 ? size.y : 1;
  const scale = targetHeight / h;
  return {
    scale,
    offset: [-center.x * scale, -box.min.y * scale, -center.z * scale],
    height: targetHeight,
  };
}
