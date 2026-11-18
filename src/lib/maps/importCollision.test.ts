import { afterEach, describe, expect, it, vi } from "vitest";
import { blankMap } from "@/lib/maps/schema";
import {
  buildMapImportCopy,
  findMapIdCollision,
  newCustomMapId,
  prepareMapImport,
  resolveImportedMapId,
} from "@/lib/maps/importCollision";

function idFromRandom(r: number): string {
  return `custom_${r.toString(36).slice(2, 10)}`;
}

describe("importCollision", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("newCustomMapId uses the custom_ prefix", () => {
    expect(newCustomMapId().startsWith("custom_")).toBe(true);
  });

  it("keeps custom_ ids and rewrites builtin / other ids", () => {
    expect(resolveImportedMapId("custom_abc123")).toBe("custom_abc123");
    const rewritten = resolveImportedMapId("office");
    expect(rewritten.startsWith("custom_")).toBe(true);
    expect(rewritten).not.toBe("office");
  });

  it("findMapIdCollision returns the matching custom map", () => {
    const existing = blankMap({ id: "custom_hit", name: "Hit" });
    expect(findMapIdCollision("custom_hit", [existing])).toBe(existing);
    expect(findMapIdCollision("custom_miss", [existing])).toBeNull();
  });

  it("prepareMapImport reports no collision for a free custom id", () => {
    const parsed = blankMap({ id: "custom_new", name: "Fresh" });
    const prepared = prepareMapImport(parsed, [
      blankMap({ id: "custom_other", name: "Other" }),
    ]);
    expect(prepared.def.id).toBe("custom_new");
    expect(prepared.def.builtin).toBe(false);
    expect(prepared.collision).toBeNull();
  });

  it("prepareMapImport reports collision when custom id already exists", () => {
    const existing = blankMap({
      id: "custom_clash",
      name: "Mine",
      description: "keep me",
    });
    const parsed = blankMap({
      id: "custom_clash",
      name: "Imported",
      description: "overwrite candidate",
    });
    const prepared = prepareMapImport(parsed, [existing]);
    expect(prepared.def.id).toBe("custom_clash");
    expect(prepared.def.name).toBe("Imported");
    expect(prepared.collision).toEqual(existing);
  });

  it("prepareMapImport rewrites builtin ids so they do not collide by id", () => {
    const existing = blankMap({ id: "custom_x", name: "X" });
    const parsed = blankMap({ id: "office", name: "Office copy", builtin: true });
    const prepared = prepareMapImport(parsed, [existing]);
    expect(prepared.def.id.startsWith("custom_")).toBe(true);
    expect(prepared.def.id).not.toBe("office");
    expect(prepared.def.builtin).toBe(false);
    expect(prepared.collision).toBeNull();
  });

  it("prepareMapImport falls back to Imported map when name is blank", () => {
    const prepared = prepareMapImport(blankMap({ id: "custom_a", name: "  " }), []);
    expect(prepared.def.name).toBe("Imported map");
  });

  it("buildMapImportCopy retries until the id is unique", () => {
    const collide = 0.123456789;
    const free = 0.987654321;
    const collidingId = idFromRandom(collide);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(collide)
      .mockReturnValueOnce(free);

    const source = blankMap({ id: "custom_clash", name: "Mine" });
    const existing = [
      source,
      blankMap({ id: collidingId, name: "Mine (copy)" }),
    ];
    const copy = buildMapImportCopy(source, existing, "copy");
    expect(copy.id).toBe(idFromRandom(free));
    expect(copy.id).not.toBe(collidingId);
    expect(copy.name).toBe("Mine (copy 2)");
    expect(copy.builtin).toBe(false);
  });

  it("buildMapImportCopy skips names taken by existing (copy) and builtins", () => {
    const source = blankMap({ id: "custom_office_like", name: "Office" });
    const existing = [
      source,
      blankMap({ id: "custom_office_copy", name: "Office (copy)" }),
    ];
    const copy = buildMapImportCopy(source, existing, "copy", ["Office", "Nature"]);
    expect(copy.name).toBe("Office (copy 2)");
  });

  it("buildMapImportCopy leaves the source object untouched", () => {
    const source = blankMap({ id: "custom_clash", name: "Mine" });
    const before = structuredClone(source);
    buildMapImportCopy(source, [source], "copy");
    expect(source).toEqual(before);
  });
});
