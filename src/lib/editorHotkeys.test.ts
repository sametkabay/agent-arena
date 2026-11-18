import { describe, expect, it } from "vitest";
import { shouldSkipEditorHotkey } from "@/lib/editorHotkeys";

describe("shouldSkipEditorHotkey", () => {
  it("skips when suspended (conflict / close dialog open)", () => {
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: false },
        { suspended: true, targetTagName: "BUTTON" },
      ),
    ).toBe(true);
  });

  it("skips when Escape (or any key) was already preventDefault'd", () => {
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: true },
        { suspended: false, targetTagName: "BUTTON" },
      ),
    ).toBe(true);
  });

  it("skips when focus is in an input-like control", () => {
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: false },
        { suspended: false, targetTagName: "INPUT" },
      ),
    ).toBe(true);
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: false },
        { suspended: false, targetTagName: "textarea" },
      ),
    ).toBe(true);
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: false },
        { suspended: false, targetTagName: "SELECT" },
      ),
    ).toBe(true);
  });

  it("allows hotkeys on buttons / canvas when not suspended", () => {
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: false },
        { suspended: false, targetTagName: "BUTTON" },
      ),
    ).toBe(false);
    expect(
      shouldSkipEditorHotkey(
        { defaultPrevented: false },
        { suspended: false, targetTagName: "DIV" },
      ),
    ).toBe(false);
  });
});
