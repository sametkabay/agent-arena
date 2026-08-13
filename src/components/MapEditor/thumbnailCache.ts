import {
  Box3,
  DirectionalLight,
  AmbientLight,
  HemisphereLight,
  Matrix4,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Mesh,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLACEABLE_SPECS } from "@/lib/assets/catalog";
import { getCharacter, isCharacterId } from "@/lib/assets/characters";
import { skinnedWorldBox } from "@/lib/three/glbFit";
import {
  applyCharacterProportions,
  poseCharacterIdle,
  scaleHeadAnimationTracks,
} from "@/lib/three/characterRig";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { AnimationClip } from "three";

const SIZE = 128;
const CHAR_W = 120;
const CHAR_H = 160;
/** Frame size after normalize; higher margin = more padding in thumb. */
const FIT = 1;
const MARGIN_DEFAULT = 1.45;
const MARGIN_ANIMALS = 1.9;
/** Extra padding so feet/head aren't clipped in the 3:4 portrait. */
const MARGIN_CHARACTER = 1.16;
/** Bump to invalidate in-memory thumbs after framing changes. */
const CACHE_VER = "framing-v34-hands-up";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const waiters = new Map<string, Set<() => void>>();

let renderer: WebGLRenderer | null = null;
let loader: GLTFLoader | null = null;
let renderChain: Promise<void> = Promise.resolve();

function cacheKey(id: string): string {
  return `${CACHE_VER}:${id}`;
}

/** Serialize GPU reads so concurrent thumbs don't corrupt the shared canvas. */
function enqueueRender<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = renderChain.then(fn, fn);
  renderChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function getRenderer(): WebGLRenderer {
  if (!renderer) {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
  }
  return renderer;
}

function getLoader(): GLTFLoader {
  if (!loader) loader = new GLTFLoader();
  return loader;
}

/** Prefer real mesh volumes — skinned animal armatures often poison setFromObject. */
function contentBox(root: Object3D): Box3 {
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

function normalizeToBox(root: Object3D, target = FIT): boolean {
  const box = contentBox(root);
  if (box.isEmpty()) return false;
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim < 1e-8) return false;
  const s = target / maxDim;
  root.position.set(-center.x * s, -center.y * s, -center.z * s);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  return true;
}

function prepareMeshes(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
}

function frameMarginFor(id: string): number {
  const spec = PLACEABLE_SPECS[id];
  const cat = spec?.category;
  if (cat === "animals") return MARGIN_ANIMALS;
  if (id.includes("astronaut")) return MARGIN_ANIMALS;
  return MARGIN_DEFAULT;
}

function buildScene(
  model: Object3D,
  margin: number,
): { scene: Scene; camera: OrthographicCamera } {
  const scene = new Scene();
  // Refit ortho to the actual content AABB after normalize (avoids overshoot).
  const box = contentBox(model);
  const size = new Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, FIT);
  const half = (maxDim / 2) * margin;

  const camera = new OrthographicCamera(-half, half, half, -half, -40, 80);
  camera.position.set(1.55, 1.25, 1.55);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  scene.add(new AmbientLight(0xffffff, 0.85));
  const key = new DirectionalLight(0xffffff, 1.25);
  key.position.set(2.5, 4, 2);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.35);
  fill.position.set(-2, 2, -1);
  scene.add(fill);
  scene.add(new HemisphereLight(0xfff8ee, 0x8a7e6e, 0.45));
  scene.add(model);
  return { scene, camera };
}

function renderToDataUrl(model: Object3D, margin: number): string {
  const gl = getRenderer();
  gl.setSize(SIZE, SIZE, false);
  const { scene, camera } = buildScene(model, margin);
  gl.clear();
  gl.render(scene, camera);
  return gl.domElement.toDataURL("image/png");
}

function normalizeCharacterToBox(root: Object3D, target = FIT): boolean {
  const box = skinnedWorldBox(root);
  if (box.isEmpty()) return false;
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const h = size.y;
  if (!Number.isFinite(h) || h < 1e-8) return false;
  const s = target / h;
  root.position.set(-center.x * s, -center.y * s, -center.z * s);
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  return true;
}

function frameOrthoToBox(
  camera: OrthographicCamera,
  box: Box3,
  aspect: number,
  margin: number,
) {
  camera.updateMatrixWorld(true);
  const inv = new Matrix4().copy(camera.matrixWorld).invert();
  const min = box.min;
  const max = box.max;
  const corners = [
    min.x, min.y, min.z, max.x, min.y, min.z, min.x, max.y, min.z, max.x, max.y, min.z,
    min.x, min.y, max.z, max.x, min.y, max.z, min.x, max.y, max.z, max.x, max.y, max.z,
  ];
  const v = new Vector3();
  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCy = Infinity;
  let maxCy = -Infinity;
  for (let i = 0; i < corners.length; i += 3) {
    v.set(corners[i], corners[i + 1], corners[i + 2]).applyMatrix4(inv);
    minCx = Math.min(minCx, v.x);
    maxCx = Math.max(maxCx, v.x);
    minCy = Math.min(minCy, v.y);
    maxCy = Math.max(maxCy, v.y);
  }
  let halfW = Math.max(Math.abs(minCx), Math.abs(maxCx), 0.01);
  let halfH = Math.max(Math.abs(minCy), Math.abs(maxCy), 0.01);
  if (halfW / halfH > aspect) halfH = halfW / aspect;
  else halfW = halfH * aspect;
  camera.left = -halfW * margin;
  camera.right = halfW * margin;
  camera.top = halfH * margin;
  camera.bottom = -halfH * margin;
  camera.updateProjectionMatrix();
}

function buildCharacterScene(
  model: Object3D,
  margin: number,
): { scene: Scene; camera: OrthographicCamera } {
  const scene = new Scene();
  const box = skinnedWorldBox(model);
  const aspect = CHAR_W / CHAR_H;
  const camera = new OrthographicCamera(-1, 1, 1, -1, -40, 80);
  camera.position.set(0.45, 0.35, 2.2);
  camera.lookAt(0, 0, 0);
  frameOrthoToBox(camera, box, aspect, margin);

  scene.add(new AmbientLight(0xffffff, 0.9));
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2.2, 3.6, 2.4);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.4);
  fill.position.set(-2, 2, -1);
  scene.add(fill);
  scene.add(new HemisphereLight(0xfff8ee, 0x8a7e6e, 0.5));
  scene.add(model);
  return { scene, camera };
}

function renderCharacterToDataUrl(model: Object3D): string {
  const gl = getRenderer();
  gl.setSize(CHAR_W, CHAR_H, false);
  const { scene, camera } = buildCharacterScene(model, MARGIN_CHARACTER);
  gl.clear();
  gl.render(scene, camera);
  return gl.domElement.toDataURL("image/png");
}

async function renderGlb(path: string, margin: number): Promise<string> {
  const gltf = await getLoader().loadAsync(path);
  const root = gltf.scene.clone(true);
  prepareMeshes(root);
  if (!normalizeToBox(root, FIT)) {
    root.scale.setScalar(0.01);
  }
  return enqueueRender(() => renderToDataUrl(root, margin));
}

async function renderCharacterGlb(
  path: string,
  headScale: number,
): Promise<string> {
  const gltf = await getLoader().loadAsync(path);
  const root = cloneSkinned(gltf.scene);
  prepareMeshes(root);
  const clips = ((gltf.animations ?? []) as AnimationClip[]).map((c) =>
    c.clone(),
  );
  scaleHeadAnimationTracks(clips, headScale);
  poseCharacterIdle(root, clips);
  applyCharacterProportions(root, headScale);
  if (!normalizeCharacterToBox(root, FIT)) {
    root.scale.setScalar(0.01);
  }
  return enqueueRender(() => renderCharacterToDataUrl(root));
}

/** Solid placeholder when GLB fails — keeps grid from looking empty. */
function renderPlaceholder(label: string): string {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, "#453d36");
  g.addColorStop(1, "#2c2621");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "rgba(244,239,230,0.55)";
  ctx.font = "bold 11px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = label.split(" ");
  ctx.fillText(words[0] ?? "?", SIZE / 2, SIZE / 2 - (words.length > 1 ? 6 : 0));
  if (words[1]) ctx.fillText(words.slice(1).join(" "), SIZE / 2, SIZE / 2 + 8);
  return c.toDataURL("image/png");
}

function notify(id: string) {
  const set = waiters.get(id);
  if (!set) return;
  set.forEach((fn) => fn());
}

export function getCachedThumb(id: string): string | null {
  return cache.get(cacheKey(id)) ?? null;
}

export function subscribeThumb(id: string, fn: () => void): () => void {
  let set = waiters.get(id);
  if (!set) {
    set = new Set();
    waiters.set(id, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) waiters.delete(id);
  };
}

/** Max parallel GLB→thumb jobs (serial GPU queue still applies). */
const MAX_PARALLEL_LOADS = 2;
let activeLoads = 0;
const waitQueue: Array<() => void> = [];

function acquireLoadSlot(): Promise<void> {
  if (activeLoads < MAX_PARALLEL_LOADS) {
    activeLoads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeLoads += 1;
      resolve();
    });
  });
}

function releaseLoadSlot() {
  activeLoads = Math.max(0, activeLoads - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/** Load+render one thumbnail (cached). Safe to call from many React thumbs. */
export function requestThumb(id: string): Promise<string> {
  const key = cacheKey(id);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const pending = inflight.get(id);
  if (pending) return pending;

  const placeable = PLACEABLE_SPECS[id];
  const character = isCharacterId(id) ? getCharacter(id) : null;
  const glb = placeable?.glb ?? character?.glb;
  const label = placeable?.label ?? character?.id ?? id;

  const job = (async () => {
    await acquireLoadSlot();
    try {
      let url: string;
      if (glb) {
        url = character
          ? await renderCharacterGlb(glb, character.headScale ?? 1)
          : await renderGlb(glb, frameMarginFor(id));
      } else {
        url = renderPlaceholder(label);
      }
      cache.set(key, url);
      notify(id);
      return url;
    } catch (err) {
      console.warn(`[thumb] failed ${id}`, err);
      const url = renderPlaceholder(label);
      cache.set(key, url);
      notify(id);
      return url;
    } finally {
      inflight.delete(id);
      releaseLoadSlot();
    }
  })();

  inflight.set(id, job);
  return job;
}

/** Release the shared offscreen WebGL context (call when leaving map editor). */
export function disposeThumbRenderer(): void {
  if (renderer) {
    // Dispose without forceContextLoss — that logs a noisy "Context Lost" warning
    // and can cascade onto other canvases on Windows.
    renderer.dispose();
    renderer = null;
  }
  loader = null;
  renderChain = Promise.resolve();
  activeLoads = 0;
  waitQueue.length = 0;
}

/** Warm a list sequentially to avoid GLTF/GPU spikes. */
export function warmThumbs(ids: string[]): void {
  void (async () => {
    for (const id of ids) {
      if (!cache.has(cacheKey(id))) await requestThumb(id);
    }
  })();
}
