import type { ThreeEvent } from "@react-three/fiber";
import type { Object3D } from "three";

type IntersectionList =
  | ThreeEvent<PointerEvent>["intersections"]
  | ThreeEvent<MouseEvent>["intersections"];

/** Walk up the Object3D tree for a string `userData[key]`. */
export function idFromUserData(obj: Object3D, key: string): string | null {
  let o: Object3D | null = obj;
  while (o) {
    const id = o.userData?.[key];
    if (typeof id === "string" && id.length > 0) return id;
    o = o.parent;
  }
  return null;
}

/**
 * Selectable ids along a pointer ray, nearest → farthest (deduped).
 * Industry-standard “select through” / cycle pick for stacked meshes.
 */
export function idsFromIntersections(
  intersections: IntersectionList,
  userDataKey: string,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const hit of intersections) {
    const id = idFromUserData(hit.object, userDataKey);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Frontmost if current selection isn’t in the stack;
 * otherwise the next target behind (wraps).
 */
export function pickStackedId(
  stack: string[],
  currentId: string | null,
): string | null {
  if (stack.length === 0) return null;
  if (stack.length === 1) return stack[0];
  const idx = currentId ? stack.indexOf(currentId) : -1;
  return stack[(idx + 1) % stack.length] ?? stack[0];
}

const AGENT_KEY = "agentId";

/** @deprecated Prefer idsFromIntersections(…, "agentId") */
export function agentIdFromObject(obj: Object3D): string | null {
  return idFromUserData(obj, AGENT_KEY);
}

export function agentIdsFromIntersections(
  intersections: IntersectionList,
): string[] {
  return idsFromIntersections(intersections, AGENT_KEY);
}

export function pickStackedAgent(
  stack: string[],
  currentId: string | null,
): string | null {
  return pickStackedId(stack, currentId);
}
