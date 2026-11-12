import { describe, expect, it, vi } from "vitest";
import {
  consumeEscapeForOpenMenu,
  shouldDismissOnEscape,
} from "@/lib/overlayEscape";

describe("overlayEscape", () => {
  it("consumeEscapeForOpenMenu prevents and stops Escape only", () => {
    const escape = {
      key: "Escape",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    expect(consumeEscapeForOpenMenu(escape)).toBe(true);
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(escape.stopPropagation).toHaveBeenCalledOnce();

    const other = {
      key: "Tab",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    expect(consumeEscapeForOpenMenu(other)).toBe(false);
    expect(other.preventDefault).not.toHaveBeenCalled();
    expect(other.stopPropagation).not.toHaveBeenCalled();
  });

  it("shouldDismissOnEscape ignores defaultPrevented Escape", () => {
    expect(
      shouldDismissOnEscape({ key: "Escape", defaultPrevented: false }),
    ).toBe(true);
    expect(
      shouldDismissOnEscape({ key: "Escape", defaultPrevented: true }),
    ).toBe(false);
    expect(
      shouldDismissOnEscape({ key: "Tab", defaultPrevented: false }),
    ).toBe(false);
  });
});
