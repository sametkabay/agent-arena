import {
  AnimationMixer,
  Quaternion,
  Vector3,
  VectorKeyframeTrack,
  type AnimationClip,
  type Object3D,
  type SkinnedMesh,
} from "three";

/**
 * Authored cube-heads are oversized. Scale the Head bone only — do not
 * refit overall height afterwards, or the body inflates.
 */
export const DEFAULT_HEAD_SCALE = 0.62;
/** Authored fists are large cubes; a modest shrink. */
export const DEFAULT_HAND_SCALE = 0.72;
/** Pull each fist this fraction of the way toward the Body bone. */
const HAND_INSET = 0.22;
/** Extra lift as a fraction of body–hand distance. */
const HAND_LIFT = 0.14;

const _body = new Vector3();
const _hand = new Vector3();

function isHeadScaleTrack(name: string): boolean {
  return /(^|[./|])head\.scale$/i.test(name);
}

function isHandScaleTrack(name: string): boolean {
  return /(^|[./|])hand[._]?[lr]\.scale$/i.test(name);
}

function isHeadNode(obj: Object3D): boolean {
  return /^head$/i.test(obj.name);
}

function isHandNode(obj: Object3D): boolean {
  return /^hand[._]?[lr]$/i.test(obj.name);
}

function isBodyNode(obj: Object3D): boolean {
  return /^body$/i.test(obj.name);
}

function applyBoneScale(
  root: Object3D,
  match: (obj: Object3D) => boolean,
  scale: number,
): void {
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-3) return;
  root.traverse((obj) => {
    if (match(obj)) obj.scale.setScalar(scale);
  });
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    for (const bone of mesh.skeleton.bones) {
      if (match(bone)) bone.scale.setScalar(scale);
    }
    mesh.skeleton.update();
  });
}

function insetHands(root: Object3D): void {
  let body: Object3D | null = null;
  const hands: Object3D[] = [];
  root.traverse((obj) => {
    if (!body && isBodyNode(obj)) body = obj;
    if (isHandNode(obj)) hands.push(obj);
  });
  if (!body || hands.length === 0) return;
  body.updateWorldMatrix(true, false);
  body.getWorldPosition(_body);
  for (const hand of hands) {
    const parent = hand.parent;
    if (!parent) continue;
    hand.getWorldPosition(_hand);
    const span = _hand.distanceTo(_body);
    _hand.lerp(_body, HAND_INSET);
    _hand.y += span * HAND_LIFT;
    parent.worldToLocal(_hand);
    hand.position.copy(_hand);
  }
}

/** Head + hand bone scale, and fists pulled in toward the torso. */
export function applyCharacterProportions(
  root: Object3D,
  headScale: number,
): void {
  applyBoneScale(root, isHeadNode, headScale);
  applyBoneScale(root, isHandNode, DEFAULT_HAND_SCALE);
  insetHands(root);
  root.updateMatrixWorld(true);
}

function injectScaleTrack(
  clip: AnimationClip,
  bone: string,
  scale: number,
): void {
  let found = false;
  for (const track of clip.tracks) {
    if (!new RegExp(`(^|[./|])${bone}\\.scale$`, "i").test(track.name)) continue;
    found = true;
    const values = track.values;
    for (let i = 0; i < values.length; i++) values[i] *= scale;
  }
  if (found) return;
  const t1 = Math.max(clip.duration, 0.001);
  clip.tracks.push(
    new VectorKeyframeTrack(
      `${bone}.scale`,
      [0, t1],
      [scale, scale, scale, scale, scale, scale],
    ),
  );
}

/**
 * Idle/Walk do not key Head.scale, but mixer reset restores bind scale 1.
 * Multiply existing scale tracks and inject a constant scale otherwise.
 * Mutates clips — clone them first if they come from a shared GLTF cache.
 */
export function scaleHeadAnimationTracks(
  clips: AnimationClip[],
  headScale: number,
): void {
  for (const clip of clips) {
    if (Number.isFinite(headScale) && Math.abs(headScale - 1) >= 1e-3) {
      let found = false;
      for (const track of clip.tracks) {
        if (!isHeadScaleTrack(track.name)) continue;
        found = true;
        const values = track.values;
        for (let i = 0; i < values.length; i++) values[i] *= headScale;
      }
      if (!found) injectScaleTrack(clip, "Head", headScale);
    }
    if (Math.abs(DEFAULT_HAND_SCALE - 1) >= 1e-3) {
      let found = false;
      for (const track of clip.tracks) {
        if (!isHandScaleTrack(track.name)) continue;
        found = true;
        const values = track.values;
        for (let i = 0; i < values.length; i++) values[i] *= DEFAULT_HAND_SCALE;
      }
      if (!found) {
        injectScaleTrack(clip, "HandL", DEFAULT_HAND_SCALE);
        injectScaleTrack(clip, "HandR", DEFAULT_HAND_SCALE);
      }
    }
  }
}

/**
 * Sample a standing Idle frame and bake local TRS.
 * Mixer stop/uncache restores bind pose (a cube blob on these FBX rigs) —
 * we copy posed transforms back so thumbs show the full figure.
 */
export function poseCharacterIdle(
  root: Object3D,
  clips: AnimationClip[],
): void {
  const clip = clips.find((c) => /idle/i.test(c.name));
  if (!clip || clip.duration <= 0) return;
  const mixer = new AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.update(Math.min(0.4, clip.duration * 0.25));

  const posed: Array<{
    obj: Object3D;
    p: Vector3;
    q: Quaternion;
    s: Vector3;
  }> = [];
  root.traverse((obj) => {
    posed.push({
      obj,
      p: obj.position.clone(),
      q: obj.quaternion.clone(),
      s: obj.scale.clone(),
    });
  });

  mixer.stopAllAction();
  mixer.uncacheRoot(root);

  for (const { obj, p, q, s } of posed) {
    obj.position.copy(p);
    obj.quaternion.copy(q);
    obj.scale.copy(s);
  }
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (mesh.isSkinnedMesh) mesh.skeleton?.update();
  });
}
