import type { UserAssetBBox } from "@/lib/userAssets/types";

type Vec3 = [number, number, number];
type Mat4 = number[]; // column-major 4x4

function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0) as number[];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row]! * b[col * 4]! +
        a[4 + row]! * b[col * 4 + 1]! +
        a[8 + row]! * b[col * 4 + 2]! +
        a[12 + row]! * b[col * 4 + 3]!;
    }
  }
  return out;
}

function fromTRS(
  translation?: number[],
  rotation?: number[],
  scale?: number[],
): Mat4 {
  const t = translation ?? [0, 0, 0];
  const r = rotation ?? [0, 0, 0, 1]; // xyzw
  const s = scale ?? [1, 1, 1];
  const [x, y, z, w] = r;
  const x2 = x! + x!;
  const y2 = y! + y!;
  const z2 = z! + z!;
  const xx = x! * x2;
  const yy = y! * y2;
  const zz = z! * z2;
  const xy = x! * y2;
  const xz = x! * z2;
  const yz = y! * z2;
  const wx = w! * x2;
  const wy = w! * y2;
  const wz = w! * z2;
  return [
    (1 - (yy + zz)) * s[0]!,
    (xy + wz) * s[0]!,
    (xz - wy) * s[0]!,
    0,
    (xy - wz) * s[1]!,
    (1 - (xx + zz)) * s[1]!,
    (yz + wx) * s[1]!,
    0,
    (xz + wy) * s[2]!,
    (yz - wx) * s[2]!,
    (1 - (xx + yy)) * s[2]!,
    0,
    t[0]!,
    t[1]!,
    t[2]!,
    1,
  ];
}

function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const x = p[0];
  const y = p[1];
  const z = p[2];
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ];
}

function nodeMatrix(node: Record<string, unknown>): Mat4 {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return (node.matrix as number[]).slice() as Mat4;
  }
  return fromTRS(
    Array.isArray(node.translation) ? (node.translation as number[]) : undefined,
    Array.isArray(node.rotation) ? (node.rotation as number[]) : undefined,
    Array.isArray(node.scale) ? (node.scale as number[]) : undefined,
  );
}

/**
 * Compute world-space AABB from POSITION accessor min/max without reading buffers.
 * Returns null if any referenced POSITION accessor lacks min/max.
 */
export function gltfBounds(json: Record<string, unknown>): UserAssetBBox | null {
  const nodes = Array.isArray(json.nodes) ? (json.nodes as Record<string, unknown>[]) : [];
  const meshes = Array.isArray(json.meshes) ? (json.meshes as Record<string, unknown>[]) : [];
  const accessors = Array.isArray(json.accessors)
    ? (json.accessors as Record<string, unknown>[])
    : [];
  const scenes = Array.isArray(json.scenes) ? (json.scenes as Record<string, unknown>[]) : [];

  let sceneIndex =
    typeof json.scene === "number" ? json.scene : scenes.length > 0 ? 0 : -1;
  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    // No scene — walk all root nodes
    sceneIndex = -1;
  }

  const roots: number[] =
    sceneIndex >= 0
      ? ((Array.isArray(scenes[sceneIndex]!.nodes)
          ? scenes[sceneIndex]!.nodes
          : []) as number[])
      : nodes.map((_, i) => i);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let found = false;
  let missingMinMax = false;

  const visited = new Set<number>();

  const visit = (nodeIndex: number, parent: Mat4) => {
    if (visited.has(nodeIndex)) return;
    visited.add(nodeIndex);
    const node = nodes[nodeIndex];
    if (!node) return;
    const local = multiply(parent, nodeMatrix(node));
    const meshIndex = node.mesh;
    if (typeof meshIndex === "number" && meshes[meshIndex]) {
      const prims = Array.isArray(meshes[meshIndex]!.primitives)
        ? (meshes[meshIndex]!.primitives as Record<string, unknown>[])
        : [];
      for (const prim of prims) {
        const attrs = prim.attributes as Record<string, unknown> | undefined;
        const posIdx = attrs?.POSITION;
        if (typeof posIdx !== "number") continue;
        const acc = accessors[posIdx];
        if (!acc) continue;
        const amin = acc.min;
        const amax = acc.max;
        if (
          !Array.isArray(amin) ||
          !Array.isArray(amax) ||
          amin.length < 3 ||
          amax.length < 3
        ) {
          missingMinMax = true;
          continue;
        }
        const corners: Vec3[] = [
          [amin[0] as number, amin[1] as number, amin[2] as number],
          [amin[0] as number, amin[1] as number, amax[2] as number],
          [amin[0] as number, amax[1] as number, amin[2] as number],
          [amin[0] as number, amax[1] as number, amax[2] as number],
          [amax[0] as number, amin[1] as number, amin[2] as number],
          [amax[0] as number, amin[1] as number, amax[2] as number],
          [amax[0] as number, amax[1] as number, amin[2] as number],
          [amax[0] as number, amax[1] as number, amax[2] as number],
        ];
        for (const c of corners) {
          const w = transformPoint(local, c);
          minX = Math.min(minX, w[0]);
          minY = Math.min(minY, w[1]);
          minZ = Math.min(minZ, w[2]);
          maxX = Math.max(maxX, w[0]);
          maxY = Math.max(maxY, w[1]);
          maxZ = Math.max(maxZ, w[2]);
          found = true;
        }
      }
    }
    const children = Array.isArray(node.children) ? (node.children as number[]) : [];
    for (const c of children) {
      if (typeof c === "number") visit(c, local);
    }
  };

  for (const r of roots) visit(r, identity());

  // Prefer accessor min/max; callers may Box3-measure on first load when null.
  if (!found) return null;
  if (missingMinMax && !found) return null;
  if (missingMinMax) return null;
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}
