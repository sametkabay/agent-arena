import { describe, expect, it } from "vitest";
import {
  TOAST_BLOCKING_DIALOG_SELECTOR,
  resolveToastPlacement,
  toastPlacementClassName,
} from "@/lib/toastPlacement";

describe("resolveToastPlacement", () => {
  it("keeps the standard anchor when no action modal is open", () => {
    expect(resolveToastPlacement({ modalWithActionsOpen: false })).toBe(
      "standard",
    );
  });

  it("moves the toast above the sheet while an action modal is open", () => {
    expect(resolveToastPlacement({ modalWithActionsOpen: true })).toBe(
      "above-modal",
    );
  });
});

describe("toastPlacementClassName", () => {
  it("returns no modifier for the standard placement", () => {
    expect(toastPlacementClassName("standard")).toBe("");
  });

  it("returns the above-modal modifier when elevated", () => {
    expect(toastPlacementClassName("above-modal")).toBe("toast--above-modal");
  });
});

describe("TOAST_BLOCKING_DIALOG_SELECTOR", () => {
  it("targets the shared confirm-dialog root used by action sheets", () => {
    expect(TOAST_BLOCKING_DIALOG_SELECTOR).toBe(".confirm-dialog");
  });
});
