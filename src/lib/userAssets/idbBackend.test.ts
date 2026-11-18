import { describe, expect, it } from "vitest";
import { createIdbBackend } from "@/lib/userAssets/idbBackend";
import { createMiniIdbFactory } from "@/lib/userAssets/testing/miniIdb";
import type { UserAssetMeta } from "@/lib/userAssets/types";
import { UserAssetError } from "@/lib/userAssets/errors";

function sampleMeta(
  id = "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
): UserAssetMeta {
  return {
    id,
    kind: "placeable",
    name: "Cube",
    format: "glb",
    entry: "cube.glb",
    files: [{ path: "cube.glb", size: 4, mime: "model/gltf-binary" }],
    totalBytes: 4,
    externalUris: [],
    bbox: null,
    targetSize: 1,
    fitScale: 1,
    footprint: [1, 1],
    rev: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("idbBackend (miniIdb)", () => {
  it("puts and reads meta+blobs atomically", async () => {
    const factory = createMiniIdbFactory();
    const backend = createIdbBackend(factory);
    const meta = sampleMeta();
    await backend.put(meta, { "cube.glb": new Blob([new Uint8Array(4)]) });
    expect(await backend.getMeta(meta.id)).toMatchObject({ name: "Cube" });
    const files = await backend.getFiles(meta.id);
    expect(files?.["cube.glb"]).toBeTruthy();
    const listed = await backend.listMeta("placeable");
    expect(listed).toHaveLength(1);
    await backend.remove(meta.id);
    expect(await backend.getMeta(meta.id)).toBeNull();
  });

  it("classifies quota on put abort and leaves no meta (atomicity)", async () => {
    const factory = createMiniIdbFactory({ quotaOnPut: 1 });
    const backend = createIdbBackend(factory);
    const meta = sampleMeta();
    await expect(
      backend.put(meta, { "cube.glb": new Blob([new Uint8Array(4)]) }),
    ).rejects.toBeInstanceOf(UserAssetError);
    // Blob put failure must not leave a dangling meta row.
    expect(await backend.getMeta(meta.id)).toBeNull();
    expect(await backend.getFiles(meta.id)).toBeNull();
  });

  it("rolls back meta when blob put fails in the same transaction", async () => {
    // quotaOnPut: 2 → meta put succeeds, blob put throws; tx must not commit meta.
    const factory = createMiniIdbFactory({ quotaOnPut: 2 });
    const backend = createIdbBackend(factory);
    const boom = sampleMeta("user:22222222-2222-4222-8222-222222222222");
    await expect(
      backend.put(boom, { "cube.glb": new Blob([new Uint8Array(4)]) }),
    ).rejects.toBeInstanceOf(UserAssetError);
    expect(await backend.getMeta(boom.id)).toBeNull();
    expect(await backend.getFiles(boom.id)).toBeNull();
  });

  it("maps open errors to unavailable", async () => {
    const factory = createMiniIdbFactory({ openError: "SecurityError" });
    const backend = createIdbBackend(factory);
    await expect(backend.listMeta()).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
