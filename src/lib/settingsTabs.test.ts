import { describe, expect, it } from "vitest";
import {
  centeredScrollLeft,
  resolveTabKeyIndex,
  resolveTablistBlurFocusIndex,
  tabStripScrollEdgeAttr,
  tabStripScrollEdges,
} from "@/lib/settingsTabs";

describe("resolveTabKeyIndex", () => {
  it("returns null for unknown keys, modifiers, and empty lists", () => {
    expect(resolveTabKeyIndex({ key: "Tab" }, 0, 5)).toBeNull();
    expect(resolveTabKeyIndex({ key: "Enter" }, 0, 5)).toBeNull();
    expect(resolveTabKeyIndex({ key: "ArrowRight", altKey: true }, 0, 5)).toBeNull();
    expect(resolveTabKeyIndex({ key: "ArrowRight", ctrlKey: true }, 0, 5)).toBeNull();
    expect(resolveTabKeyIndex({ key: "ArrowRight", metaKey: true }, 0, 5)).toBeNull();
    expect(resolveTabKeyIndex({ key: "ArrowRight" }, 0, 0)).toBeNull();
  });

  it("moves Right/Down and wraps from the last index", () => {
    expect(resolveTabKeyIndex({ key: "ArrowRight" }, 0, 5)).toBe(1);
    expect(resolveTabKeyIndex({ key: "ArrowDown" }, 2, 5)).toBe(3);
    expect(resolveTabKeyIndex({ key: "ArrowRight" }, 4, 5)).toBe(0);
    expect(resolveTabKeyIndex({ key: "ArrowDown" }, 4, 5)).toBe(0);
  });

  it("moves Left/Up and wraps from the first index", () => {
    expect(resolveTabKeyIndex({ key: "ArrowLeft" }, 2, 5)).toBe(1);
    expect(resolveTabKeyIndex({ key: "ArrowUp" }, 3, 5)).toBe(2);
    expect(resolveTabKeyIndex({ key: "ArrowLeft" }, 0, 5)).toBe(4);
    expect(resolveTabKeyIndex({ key: "ArrowUp" }, 0, 5)).toBe(4);
  });

  it("handles Home and End", () => {
    expect(resolveTabKeyIndex({ key: "Home" }, 3, 5)).toBe(0);
    expect(resolveTabKeyIndex({ key: "End" }, 1, 5)).toBe(4);
  });

  it("works with a single tab", () => {
    expect(resolveTabKeyIndex({ key: "ArrowRight" }, 0, 1)).toBe(0);
    expect(resolveTabKeyIndex({ key: "ArrowLeft" }, 0, 1)).toBe(0);
    expect(resolveTabKeyIndex({ key: "Home" }, 0, 1)).toBe(0);
    expect(resolveTabKeyIndex({ key: "End" }, 0, 1)).toBe(0);
  });
});

describe("centeredScrollLeft", () => {
  it("returns 0 when the strip does not overflow", () => {
    expect(
      centeredScrollLeft({
        tabLeft: 40,
        tabWidth: 80,
        stripClientWidth: 300,
        stripScrollWidth: 300,
      }),
    ).toBe(0);
  });

  it("centers a middle tab", () => {
    expect(
      centeredScrollLeft({
        tabLeft: 200,
        tabWidth: 100,
        stripClientWidth: 200,
        stripScrollWidth: 500,
      }),
    ).toBe(150);
  });

  it("clamps to the start", () => {
    expect(
      centeredScrollLeft({
        tabLeft: 0,
        tabWidth: 80,
        stripClientWidth: 200,
        stripScrollWidth: 500,
      }),
    ).toBe(0);
  });

  it("clamps to the end", () => {
    expect(
      centeredScrollLeft({
        tabLeft: 400,
        tabWidth: 100,
        stripClientWidth: 200,
        stripScrollWidth: 500,
      }),
    ).toBe(300);
  });
});

describe("resolveTablistBlurFocusIndex", () => {
  it("returns null when focus stays inside the tablist", () => {
    expect(resolveTablistBlurFocusIndex(true, 0)).toBeNull();
    expect(resolveTablistBlurFocusIndex(true, 2)).toBeNull();
  });

  it("returns selectedIndex when focus leaves the tablist", () => {
    expect(resolveTablistBlurFocusIndex(false, 3)).toBe(3);
    expect(resolveTablistBlurFocusIndex(false, 1)).toBe(1);
  });
});

describe("tabStripScrollEdges", () => {
  it("reports neither edge when content fits", () => {
    expect(
      tabStripScrollEdges({
        scrollLeft: 0,
        clientWidth: 300,
        scrollWidth: 300,
      }),
    ).toEqual({ left: false, right: false });
  });

  it("reports right-only at the start of an overflowing strip", () => {
    expect(
      tabStripScrollEdges({
        scrollLeft: 0,
        clientWidth: 200,
        scrollWidth: 500,
      }),
    ).toEqual({ left: false, right: true });
  });

  it("reports left-only at the end", () => {
    expect(
      tabStripScrollEdges({
        scrollLeft: 300,
        clientWidth: 200,
        scrollWidth: 500,
      }),
    ).toEqual({ left: true, right: false });
  });

  it("reports both edges in the middle", () => {
    expect(
      tabStripScrollEdges({
        scrollLeft: 100,
        clientWidth: 200,
        scrollWidth: 500,
      }),
    ).toEqual({ left: true, right: true });
  });
});

describe("tabStripScrollEdgeAttr", () => {
  it("joins active edges", () => {
    expect(tabStripScrollEdgeAttr({ left: false, right: false })).toBe("");
    expect(tabStripScrollEdgeAttr({ left: true, right: false })).toBe("left");
    expect(tabStripScrollEdgeAttr({ left: false, right: true })).toBe("right");
    expect(tabStripScrollEdgeAttr({ left: true, right: true })).toBe("left right");
  });
});
