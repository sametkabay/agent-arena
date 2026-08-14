import * as THREE from "three";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";

export type FireFxKind = "campfire" | "fire";

const ARM_COUNT = 5;

export type FireTongueMesh = {
  mesh: THREE.Mesh;
  pos: THREE.BufferAttribute;
  /** Base positions (xyz packed). */
  base: Float32Array;
  /** 0 at base → 1 at tip. */
  tip: Float32Array;
  /** Soft arm id for mild tongue variation. */
  arm: Float32Array;
  radialX: Float32Array;
  radialZ: Float32Array;
  mats: THREE.MeshStandardMaterial[];
};

/**
 * Single Fire.glb mesh: tips stretch / shrink (and soft lean) while the shape
 * stays one cohesive flame — not separate pieces.
 */
export function prepareFireMesh(root: THREE.Object3D): FireTongueMesh[] {
  const list: FireTongueMesh[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    if (mesh.name.startsWith("FireArm_")) return;

    // Own geometry so we never mutate the GLTF cache.
    const geo = mesh.geometry.clone();
    mesh.geometry = geo;

    const src = geo.attributes.position;
    const n = src.count;
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      base[i * 3] = src.getX(i);
      base[i * 3 + 1] = src.getY(i);
      base[i * 3 + 2] = src.getZ(i);
    }
    const pos = new THREE.BufferAttribute(base.slice(), 3);
    geo.setAttribute("position", pos);

    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = base[i * 3 + 1]!;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const height = Math.max(maxY - minY, 1e-5);

    const tip = new Float32Array(n);
    const arm = new Float32Array(n);
    const radialX = new Float32Array(n);
    const radialZ = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const x = base[i * 3]!;
      const y = base[i * 3 + 1]!;
      const z = base[i * 3 + 2]!;
      const h = (y - minY) / height;
      // Smooth tip weight — base locked, tips move.
      tip[i] = Math.pow(Math.max(0, (h - 0.08) / 0.92), 1.35);
      const r = Math.hypot(x, z);
      const inv = r > 1e-5 ? 1 / r : 0;
      radialX[i] = x * inv;
      radialZ[i] = z * inv;
      const ang = Math.atan2(z, x);
      arm[i] = ((ang + Math.PI) / (Math.PI * 2)) * ARM_COUNT;
    }

    const mats: THREE.MeshStandardMaterial[] = [];
    const raw = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = raw.map((m) => {
      if (!m) return m;
      const next = m.clone();
      if ("emissive" in next) {
        const std = next as THREE.MeshStandardMaterial;
        std.emissive.set("#ff5a18");
        std.emissiveIntensity = 1.35;
        std.toneMapped = false;
        mats.push(std);
      }
      return next;
    });
    mesh.material = cloned.length === 1 ? cloned[0]! : cloned;
    mesh.frustumCulled = false;

    list.push({ mesh, pos, base, tip, arm, radialX, radialZ, mats });
  });

  return list;
}

export function getFireFxKind(placeableId: string): FireFxKind | null {
  const glb = PLACEABLE_SPECS[placeableId]?.glb ?? "";
  const decoded = decodeURIComponent(glb);
  if (
    placeableId === "camping__fire" ||
    placeableId === "fire" ||
    /\/Fire\.glb$/i.test(decoded)
  ) {
    return "fire";
  }
  if (
    placeableId === "campfire" ||
    /campfire/i.test(placeableId) ||
    /Campfire\.glb$/i.test(decoded)
  ) {
    return "campfire";
  }
  return null;
}

export function isCampfirePlaceable(placeableId: string): boolean {
  return getFireFxKind(placeableId) === "campfire";
}

export function isFirePlaceable(placeableId: string): boolean {
  return getFireFxKind(placeableId) === "fire";
}

export function isFireGlbPath(path: string): boolean {
  return /\/Fire\.glb$/i.test(decodeURIComponent(path));
}
