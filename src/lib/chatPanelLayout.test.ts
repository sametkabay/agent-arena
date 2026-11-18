import { describe, expect, it } from "vitest";
import { dockClearanceFor } from "@/lib/chatPanelLayout";

/** Mirrors ChatPanel.defaultLayout desktop left/width for the default 380px panel. */
function desktopPanel(viewportWidth: number, panelWidth = 380) {
  const width = Math.min(panelWidth, Math.max(280, viewportWidth - 24));
  const left = Math.max(8, viewportWidth - width - 18);
  return { left, width };
}

describe("dockClearanceFor", () => {
  it("uses dock clearance when the panel overlaps the dock at tablet width", () => {
    const { left, width } = desktopPanel(768);
    expect(dockClearanceFor({ panelLeft: left, panelWidth: width, viewportWidth: 768 })).toBe(
      112,
    );
  });

  it("uses the desktop edge clearance when there is no overlap at 1440", () => {
    const { left, width } = desktopPanel(1440);
    expect(dockClearanceFor({ panelLeft: left, panelWidth: width, viewportWidth: 1440 })).toBe(
      18,
    );
  });

  it("switches near the 1316px boundary", () => {
    const below = desktopPanel(1315);
    expect(
      dockClearanceFor({
        panelLeft: below.left,
        panelWidth: below.width,
        viewportWidth: 1315,
      }),
    ).toBe(112);

    const at = desktopPanel(1316);
    expect(
      dockClearanceFor({
        panelLeft: at.left,
        panelWidth: at.width,
        viewportWidth: 1316,
      }),
    ).toBe(18);
  });
});
