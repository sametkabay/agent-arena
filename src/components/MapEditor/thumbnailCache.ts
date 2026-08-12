import {
  Box3,
  DirectionalLight,
  AmbientLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Mesh,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLACEABLE_SPECS, type PlaceableId } from "@/lib/assets/catalog";

const SIZE = 128;
/** Frame size after normalize; higher margin = more padding in thumb. */
const FIT = 1;
const MARGIN_DEFAULT = 1.45;
const MARGIN_ANIMALS = 1.9;
/** Bump to invalidate in-memory thumbs after framing changes. */
const CACHE_VER = "framing-v10-pingpong-567cbf-linear";

const cache = new Map<string, string>();
const inflight = new Map<PlaceableId, Promise<string>>();
const waiters = new Map<PlaceableId, Set<() => void>>();

let renderer: WebGLRenderer | null = null;
let loader: GLTFLoader | null = null;
let renderChain: Promise<void> = Promise.resolve();

function cacheKey(id: PlaceableId): string {
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

function frameMarginFor(id: PlaceableId): number {
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
  const { scene, camera } = buildScene(model, margin);
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

function notify(id: PlaceableId) {
  const set = waiters.get(id);
  if (!set) return;
  set.forEach((fn) => fn());
}

export function getCachedThumb(id: PlaceableId): string | null {
  return cache.get(cacheKey(id)) ?? null;
}

export function subscribeThumb(id: PlaceableId, fn: () => void): () => void {
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
export function requestThumb(id: PlaceableId): Promise<string> {
  const key = cacheKey(id);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const pending = inflight.get(id);
  if (pending) return pending;

  const spec = PLACEABLE_SPECS[id];
  const job = (async () => {
    await acquireLoadSlot();
    try {
      let url: string;
      if (spec?.glb) {
        url = await renderGlb(spec.glb, frameMarginFor(id));
      } else {
        url = renderPlaceholder(spec?.label ?? id);
      }
      cache.set(key, url);
      notify(id);
      return url;
    } catch (err) {
      console.warn(`[thumb] failed ${id}`, err);
      const url = renderPlaceholder(spec?.label ?? id);
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
export function warmThumbs(ids: PlaceableId[]): void {
  void (async () => {
    for (const id of ids) {
      if (!cache.has(cacheKey(id))) await requestThumb(id);
    }
  })();
}
