import { describe, expect, it } from "vitest";
import {
  canRestoreFocus,
  rememberRestoreFocusTarget,
  resolveFocusTrapWrapIndex,
} from "@/lib/focusTrap";

describe("resolveFocusTrapWrapIndex", () => {
  it("ignores non-Tab keys and empty focusable sets", () => {
    expect(resolveFocusTrapWrapIndex({ key: "Escape", shiftKey: false }, 2, 0)).toBeNull();
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: false }, 0, 0)).toBeNull();
  });

  it("keeps a single focusable trapped on Tab and Shift+Tab", () => {
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: false }, 1, 0)).toBe(0);
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: true }, 1, 0)).toBe(0);
  });

  it("wraps forward from the last item to the first", () => {
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: false }, 3, 2)).toBe(0);
  });

  it("wraps backward from the first item to the last", () => {
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: true }, 3, 0)).toBe(2);
  });

  it("lets the browser move Tab within the middle of the set", () => {
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: false }, 3, 0)).toBeNull();
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: false }, 3, 1)).toBeNull();
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: true }, 3, 1)).toBeNull();
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: true }, 3, 2)).toBeNull();
  });

  it("pulls focus back when activeIndex is outside the set", () => {
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: false }, 3, -1)).toBe(0);
    expect(resolveFocusTrapWrapIndex({ key: "Tab", shiftKey: true }, 3, -1)).toBe(2);
  });
});

describe("rememberRestoreFocusTarget", () => {
  it("captures the first candidate", () => {
    const opener = { focus() {} };
    expect(rememberRestoreFocusTarget(null, opener)).toBe(opener);
  });

  it("ignores later candidates after autoFocus moved focus", () => {
    const opener = { focus() {} };
    const closeBtn = { focus() {} };
    expect(rememberRestoreFocusTarget(opener, closeBtn)).toBe(opener);
  });

  it("returns null when nothing was active", () => {
    expect(rememberRestoreFocusTarget(null, null)).toBeNull();
  });
});

describe("canRestoreFocus", () => {
  it("allows focusing an attached element", () => {
    const el = { focus() {} };
    expect(canRestoreFocus(el, () => true)).toBe(true);
  });

  it("rejects null and detached nodes (e.g. unmounted Close button)", () => {
    const el = { focus() {} };
    expect(canRestoreFocus(null, () => true)).toBe(false);
    expect(canRestoreFocus(el, () => false)).toBe(false);
  });
});
