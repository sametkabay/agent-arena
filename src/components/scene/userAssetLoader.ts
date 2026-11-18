import { use, useEffect } from "react";
import {
  Box3,
  LoadingManager,
  Object3D,
  Vector3,
  type Object3DEventMap,
  type Material,
  type Texture,
  type BufferGeometry,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { buildUrlMap, type UrlMap } from "@/lib/userAssets/buildUrlMap";
import { createIdbBackend } from "@/lib/userAssets/idbBackend";
import type { UserAssetBackend } from "@/lib/userAssets/backend";
import type { UserAssetMeta } from "@/lib/userAssets/types";
import { createSceneCache } from "@/lib/userAssets/sceneCache";

type LoadedScene = {
  root: Object3D | null;
  urls: UrlMap | null;
};

let backend: UserAssetBackend = createIdbBackend();

/** Test / #8 seam — inject a backend instead of the module-level IDB default. */
export function setUserAssetLoaderBackend(next: UserAssetBackend): void {
  backend = next;
}

export function getUserAssetLoaderBackend(): UserAssetBackend {
  return backend;
}

function cacheKey(id: string, rev: number): string {
  return `${id}@${rev}`;
}

const TEXTURE_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "emissiveMap",
  "aoMap",
  "alphaMap",
  "bumpMap",
  "displacementMap",
  "envMap",
  "lightMap",
  "specularMap",
] as const;

function disposeTexture(tex: Texture | null | undefined) {
  if (!tex) return;
  const img = tex.image as { close?: () => void } | undefined;
  try {
    img?.close?.();
  } catch {
    /* ImageBitmap.close may throw if already closed */
  }
  tex.dispose();
}

function disposeObject(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    mesh.geometry?.dispose?.();
    const mats = mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : [];
    for (const m of mats) {
      const mat = m as Material & Record<string, unknown>;
      for (const key of TEXTURE_KEYS) {
        const tex = mat[key];
        if (tex && typeof tex === "object" && "dispose" in tex) {
          disposeTexture(tex as Texture);
        }
      }
      mat.dispose?.();
    }
  });
}

function disposeLoaded(loaded: LoadedScene | null | undefined) {
  if (!loaded) return;
  loaded.urls?.revokeAll();
  if (loaded.root) disposeObject(loaded.root);
  loaded.urls = null;
  loaded.root = null;
}

const sceneCache = createSceneCache<LoadedScene | null>(disposeLoaded);

/** World AABB via Box3 — used when import-time accessor min/max was missing. */
export function measureObjectBBox(root: Object3D): {
  min: [number, number, number];
  max: [number, number, number];
} | null {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  if (box.isEmpty()) return null;
  const size = new Vector3();
  box.getSize(size);
  if (Math.max(size.x, size.y, size.z) < 1e-8) return null;
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

async function loadUserGltf(
  meta: UserAssetMeta,
  files: Record<string, Blob>,
): Promise<{ root: Object3D; urls: UrlMap }> {
  const urls = buildUrlMap(meta, files);
  const manager = new LoadingManager();
  manager.setURLModifier(urls.modifier);
  const loader = new GLTFLoader(manager);
  if (MeshoptDecoder) {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  const entryBlob = files[meta.entry];
  if (!entryBlob) {
    urls.revokeAll();
    throw new Error("missing entry blob");
  }
  const resourcePath = "https://user-asset.local/";
  const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => {
    const onLoad = (g: { scene: Object3D }) => resolve(g);
    if (meta.format === "glb") {
      void entryBlob.arrayBuffer().then(
        (buf) => loader.parse(buf, resourcePath, onLoad, reject),
        reject,
      );
    } else {
      void entryBlob.text().then(
        (text) => loader.parse(text, resourcePath, onLoad, reject),
        reject,
      );
    }
  });
  return { root: gltf.scene, urls };
}

export function invalidateUserAsset(id: string): void {
  sceneCache.invalidatePrefix(`${id}@`);
}

export function invalidateAllUserAssets(): void {
  sceneCache.invalidateAll();
}

/**
 * Suspense-friendly user asset load. Per-asset GLTFLoader + URL modifier.
 * Rejected promises are dropped so the next render can retry.
 * StrictMode-safe: delayed dispose at refs=0; remount within the window reuses.
 */
export function useUserAssetScene(
  meta: UserAssetMeta | null,
): Object3D | null {
  const key = meta ? cacheKey(meta.id, meta.rev) : null;

  const entry =
    meta && key
      ? sceneCache.getOrCreate(key, async () => {
          const files = await backend.getFiles(meta.id);
          // Resolve null for missing blobs so the scene can show MissingAssetBox
          // without relying on Error Boundaries inside the R3F tree.
          if (!files || !files[meta.entry]) return null;
          const { root, urls } = await loadUserGltf(meta, files);
          return { root, urls };
        })
      : null;

  useEffect(() => {
    if (!entry || !key) return;
    sceneCache.retain(entry);
    return () => {
      sceneCache.release(entry, key);
    };
  }, [entry, key]);

  if (!entry) return null;

  const loaded = use(entry.promise);
  return (loaded?.root ?? null) as Object3D<Object3DEventMap> | null;
}

/** Non-React loader for thumbnails. */
export async function loadUserAssetForThumb(
  meta: UserAssetMeta,
): Promise<{ root: Object3D; dispose: () => void } | null> {
  const files = await backend.getFiles(meta.id);
  if (!files || !files[meta.entry]) return null;
  const { root, urls } = await loadUserGltf(meta, files);
  return {
    root,
    dispose: () => {
      urls.revokeAll();
      disposeObject(root);
    },
  };
}
