import { describe, expect, it, vi } from "vitest";
import {
  classifyUri,
  importBlocked,
  planImport,
  type SelectedFile,
} from "@/lib/userAssets/gltfUris";
import { UserAssetError } from "@/lib/userAssets/errors";
import {
  makeCubeGlb,
  makeCubeGltfPair,
  makeExternalUriGltf,
} from "@/lib/userAssets/testing/makeGltf";

const sel = (names: string[]): SelectedFile[] =>
  names.map((n) => ({ path: n, name: n, size: 10 }));

describe("classifyUri", () => {
  it("classifies data URIs", () => {
    const cls = classifyUri("data:text/plain;base64,YQ==", "", sel([]));
    expect(cls.kind).toBe("data");
    if (cls.kind === "data") expect(cls.byteLength).toBe(1);
  });

  it("resolves relative ./a.bin", () => {
    const files = sel(["model.gltf", "a.bin"]);
    const cls = classifyUri("./a.bin", "", files);
    expect(cls.kind).toBe("relative-in-selection");
  });

  it("decodes percent-encoded paths", () => {
    const files = sel(["tex/ x.png"]);
    const cls = classifyUri("tex/%20x.png", "", files);
    expect(cls.kind).toBe("relative-in-selection");
  });

  it("normalizes ../ segments", () => {
    const files = sel(["x.bin"]);
    const cls = classifyUri("../x.bin", "sub", files);
    expect(cls.kind).toBe("relative-in-selection");
  });

  it("falls back to basename match", () => {
    const files = sel(["textures/wood.png"]);
    const cls = classifyUri("wood.png", "", files);
    expect(cls.kind).toBe("relative-in-selection");
  });

  it("flags ambiguous basename", () => {
    const files = sel(["a/wood.png", "b/wood.png"]);
    const cls = classifyUri("wood.png", "", files);
    expect(cls.kind).toBe("ambiguous");
  });

  it("reports relative-missing", () => {
    const cls = classifyUri("gone.bin", "", sel(["model.gltf"]));
    expect(cls.kind).toBe("relative-missing");
  });

  it("classifies https as external", () => {
    const cls = classifyUri("https://cdn.example/a.bin", "", sel([]));
    expect(cls.kind).toBe("external");
    if (cls.kind === "external") expect(cls.host).toBe("cdn.example");
  });

  it("rejects file:/blob:/protocol-relative and unknown schemes", () => {
    expect(classifyUri("file:///x", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("blob:http://x", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("//cdn.example/x", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("ftp://cdn.example/x", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("mailto:a@b.c", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("\\\\host\\x", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("/\\host", "", sel([])).kind).toBe("rejected");
  });

  it("handles query/fragment, uppercase HTTP, and encoded dots", () => {
    const files = sel(["a.bin"]);
    expect(classifyUri("a.bin?x=1#frag", "", files).kind).toBe(
      "relative-in-selection",
    );
    expect(classifyUri("HTTP://cdn.example/a.bin", "", sel([])).kind).toBe(
      "external",
    );
    expect(classifyUri("%2e%2e/a.bin", "sub", files).kind).toBe(
      "relative-in-selection",
    );
  });
});

describe("planImport", () => {
  it("plans a GLB", () => {
    const glb = makeCubeGlb();
    const files = sel(["cube.glb"]);
    files[0]!.size = glb.byteLength;
    const plan = planImport(files, new Map([["cube.glb", glb]]));
    expect(plan.format).toBe("glb");
    expect(plan.missing).toEqual([]);
    expect(importBlocked(plan)).toBe(false);
  });

  it("plans gltf+bin", () => {
    const pair = makeCubeGltfPair("cube.bin");
    const files = sel(["cube.gltf", "cube.bin"]);
    files[0]!.size = pair.gltfBytes.byteLength;
    files[1]!.size = pair.bin.byteLength;
    const gltfBuf = pair.gltfBytes.buffer.slice(
      pair.gltfBytes.byteOffset,
      pair.gltfBytes.byteOffset + pair.gltfBytes.byteLength,
    ) as ArrayBuffer;
    const plan = planImport(
      files,
      new Map([
        ["cube.gltf", gltfBuf],
        ["cube.bin", pair.bin],
      ]),
    );
    expect(plan.needed).toContain("cube.bin");
    expect(plan.missing).toEqual([]);
  });

  it("flags missing bin", () => {
    const pair = makeCubeGltfPair("cube.bin");
    const files = sel(["cube.gltf"]);
    const gltfBuf = pair.gltfBytes.buffer.slice(
      pair.gltfBytes.byteOffset,
      pair.gltfBytes.byteOffset + pair.gltfBytes.byteLength,
    ) as ArrayBuffer;
    const plan = planImport(files, new Map([["cube.gltf", gltfBuf]]));
    expect(plan.missing.length).toBeGreaterThan(0);
    expect(importBlocked(plan)).toBe(true);
  });

  it("lists external without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("fetch must not be called during import");
    });
    try {
      const text = makeExternalUriGltf();
      const bytes = new TextEncoder().encode(text);
      const plan = planImport(
        sel(["ext.gltf"]),
        new Map([["ext.gltf", bytes.buffer]]),
      );
      expect(plan.external.length).toBe(1);
      expect(importBlocked(plan)).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("errors on zero or two entries", () => {
    expect(() => planImport(sel(["a.bin"]))).toThrow(UserAssetError);
    expect(() => planImport(sel(["a.glb", "b.gltf"]))).toThrow(UserAssetError);
  });

  it("rejects empty and bad URLs", () => {
    expect(classifyUri("  ", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("https://[bad", "", sel([])).kind).toBe("rejected");
    expect(classifyUri("javascript:alert(1)", "", sel([])).kind).toBe(
      "rejected",
    );
  });

  it("counts data URI bytes without base64", () => {
    const cls = classifyUri("data:text/plain,hello", "", sel([]));
    expect(cls.kind).toBe("data");
    if (cls.kind === "data") expect(cls.byteLength).toBe(5);
  });
});
