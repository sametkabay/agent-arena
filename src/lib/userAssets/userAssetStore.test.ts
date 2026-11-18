import { describe, expect, it, vi } from "vitest";
import { createMemoryBackend } from "@/lib/userAssets/memoryBackend";
import { createUserAssetStore } from "@/lib/userAssets/userAssetStore";
import { UserAssetError } from "@/lib/userAssets/errors";
import {
  makeCubeGlbBlob,
  makeCubeGltfFiles,
} from "@/lib/userAssets/testing/makeGltf";
import { isUserAssetId } from "@/lib/userAssets/ids";

describe("userAssetStore (memory backend)", () => {
  it("put/get/list by kind", async () => {
    const backend = createMemoryBackend();
    const store = createUserAssetStore(backend);
    const blob = makeCubeGlbBlob();
    const meta = await store.put({
      kind: "placeable",
      name: "My Cube",
      files: [{ path: "cube.glb", blob }],
      targetSize: 1,
    });
    expect(isUserAssetId(meta.id)).toBe(true);
    expect(meta.fitScale).toBeCloseTo(1);
    const got = await store.get(meta.id);
    expect(got?.meta.name).toBe("My Cube");
    expect(got?.files["cube.glb"]).toBeTruthy();
    const listed = await store.list("placeable");
    expect(listed).toHaveLength(1);
    expect(await store.list("character")).toHaveLength(0);
  });

  it("rename / replace keeps id, bumps rev, preserves targetSize", async () => {
    const store = createUserAssetStore(createMemoryBackend());
    const meta = await store.put({
      kind: "placeable",
      name: "A",
      files: [{ path: "cube.glb", blob: makeCubeGlbBlob() }],
      targetSize: 2,
    });
    const renamed = await store.rename(meta.id, "B");
    expect(renamed.name).toBe("B");
    expect(renamed.id).toBe(meta.id);

    const duo = makeCubeGltfFiles();
    const replaced = await store.replace(meta.id, [
      { path: duo.names.gltf, blob: duo.gltf },
      { path: duo.names.bin, blob: duo.bin },
    ]);
    expect(replaced.id).toBe(meta.id);
    expect(replaced.rev).toBe(meta.rev + 1);
    expect(replaced.targetSize).toBe(2);
    expect(replaced.format).toBe("gltf");
    expect(replaced.fitScale).toBeCloseTo(2); // target 2 / extent 1
  });

  it("delete removes meta and files", async () => {
    const store = createUserAssetStore(createMemoryBackend());
    const meta = await store.put({
      kind: "placeable",
      name: "X",
      files: [{ path: "cube.glb", blob: makeCubeGlbBlob() }],
    });
    await store.delete(meta.id);
    expect(await store.get(meta.id)).toBeNull();
  });

  it("maps quota and unavailable", async () => {
    const backend = createMemoryBackend({ quotaBytes: 10 });
    const store = createUserAssetStore(backend);
    await expect(
      store.put({
        kind: "placeable",
        name: "Big",
        files: [{ path: "cube.glb", blob: makeCubeGlbBlob() }],
      }),
    ).rejects.toMatchObject({ code: "quota" });

    backend.setUnavailable(true);
    await expect(store.list()).rejects.toMatchObject({ code: "unavailable" });
  });

  it("abort leaves nothing written", async () => {
    const backend = createMemoryBackend();
    const store = createUserAssetStore(backend);
    const ac = new AbortController();
    ac.abort();
    await expect(
      store.put(
        {
          kind: "placeable",
          name: "Nope",
          files: [{ path: "cube.glb", blob: makeCubeGlbBlob() }],
        },
        { signal: ac.signal },
      ),
    ).rejects.toBeInstanceOf(UserAssetError);
    expect(await store.list()).toHaveLength(0);
  });

  it("aborts after put by rolling back the new asset", async () => {
    const backend = createMemoryBackend();
    const store = createUserAssetStore(backend);
    const ac = new AbortController();
    const origPut = backend.put.bind(backend);
    backend.put = async (meta, files) => {
      await origPut(meta, files);
      ac.abort();
    };
    await expect(
      store.put(
        {
          kind: "placeable",
          name: "Late cancel",
          files: [{ path: "cube.glb", blob: makeCubeGlbBlob() }],
        },
        { signal: ac.signal },
      ),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(await store.list()).toHaveLength(0);
  });

  it("estimate returns null when unsupported", async () => {
    const store = createUserAssetStore(createMemoryBackend());
    const prev = globalThis.navigator;
    vi.stubGlobal("navigator", {});
    expect(await store.estimate()).toBeNull();
    vi.stubGlobal("navigator", prev);
  });

  it("setTargetSize recomputes fitScale", async () => {
    const store = createUserAssetStore(createMemoryBackend());
    const meta = await store.put({
      kind: "placeable",
      name: "S",
      files: [{ path: "cube.glb", blob: makeCubeGlbBlob() }],
      targetSize: 1,
    });
    const next = await store.setTargetSize(meta.id, 2);
    expect(next.targetSize).toBe(2);
    expect(next.fitScale).toBeCloseTo(2);
  });

  it("estimate returns usage when navigator.storage exists", async () => {
    const store = createUserAssetStore(createMemoryBackend());
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => ({ usage: 10, quota: 100 }),
      },
    });
    expect(await store.estimate()).toEqual({ usage: 10, quota: 100 });
    vi.unstubAllGlobals();
  });

  it("requires allowExternal for https buffers", async () => {
    const store = createUserAssetStore(createMemoryBackend());
    const { makeExternalUriGltf } = await import(
      "@/lib/userAssets/testing/makeGltf"
    );
    const text = makeExternalUriGltf();
    await expect(
      store.put({
        kind: "placeable",
        name: "Ext",
        files: [
          {
            path: "ext.gltf",
            blob: new Blob([text], { type: "model/gltf+json" }),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    const meta = await store.put({
      kind: "placeable",
      name: "Ext",
      files: [
        {
          path: "ext.gltf",
          blob: new Blob([text], { type: "model/gltf+json" }),
        },
      ],
      allowExternal: ["https://cdn.example.test/cube.bin"],
    });
    expect(meta.externalUris).toContain("https://cdn.example.test/cube.bin");
  });
});
