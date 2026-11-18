import { describe, expect, it } from "vitest";
import {
  AGENT_LABEL_OFFSET_WORLD,
  AGENT_OVERLAY_STACK_GAP_PX,
  agentOverlayStackWorldY,
  overlayBoxesOverlap,
  stackedAgentOverlayBoxes,
} from "@/lib/agentOverlay";

describe("agentOverlayStackWorldY", () => {
  it("offsets the stack above character height", () => {
    expect(agentOverlayStackWorldY(1.6)).toBe(1.6 + AGENT_LABEL_OFFSET_WORLD);
    expect(agentOverlayStackWorldY(0)).toBe(AGENT_LABEL_OFFSET_WORLD);
  });
});

describe("stackedAgentOverlayBoxes", () => {
  it("places the label flush with the bottom anchor", () => {
    const { label, bubble } = stackedAgentOverlayBoxes({
      anchorX: 100,
      anchorBottomY: 400,
      labelWidth: 50,
      labelHeight: 36,
    });
    expect(bubble).toBeNull();
    expect(label).toEqual({ x: 75, y: 364, width: 50, height: 36 });
  });

  it("stacks a multi-line bubble fully above the label with the gap", () => {
    const { label, bubble } = stackedAgentOverlayBoxes({
      anchorX: 200,
      anchorBottomY: 500,
      labelWidth: 50,
      labelHeight: 36,
      bubbleWidth: 144,
      bubbleHeight: 45,
      gapPx: AGENT_OVERLAY_STACK_GAP_PX,
    });
    expect(bubble).not.toBeNull();
    expect(label.y).toBe(464);
    expect(bubble!.y + bubble!.height + AGENT_OVERLAY_STACK_GAP_PX).toBe(label.y);
    expect(overlayBoxesOverlap(label, bubble!)).toBe(false);
  });

  it("never overlaps for short and tall bubbles at phone and desktop anchors", () => {
    const cases = [
      { anchorX: 195, anchorBottomY: 480, labelW: 50, labelH: 36, bubbleW: 144, bubbleH: 28 },
      { anchorX: 195, anchorBottomY: 480, labelW: 50, labelH: 36, bubbleW: 144, bubbleH: 72 },
      { anchorX: 720, anchorBottomY: 500, labelW: 44, labelH: 29, bubbleW: 144, bubbleH: 45 },
      { anchorX: 720, anchorBottomY: 500, labelW: 44, labelH: 29, bubbleW: 200, bubbleH: 90 },
    ];
    for (const c of cases) {
      const { label, bubble } = stackedAgentOverlayBoxes({
        anchorX: c.anchorX,
        anchorBottomY: c.anchorBottomY,
        labelWidth: c.labelW,
        labelHeight: c.labelH,
        bubbleWidth: c.bubbleW,
        bubbleHeight: c.bubbleH,
      });
      expect(bubble).not.toBeNull();
      expect(overlayBoxesOverlap(label, bubble!)).toBe(false);
      expect(bubble!.y + bubble!.height).toBeLessThanOrEqual(label.y);
    }
  });

  it("ignores non-positive bubble sizes", () => {
    expect(
      stackedAgentOverlayBoxes({
        anchorX: 0,
        anchorBottomY: 10,
        labelWidth: 10,
        labelHeight: 10,
        bubbleWidth: 0,
        bubbleHeight: 20,
      }).bubble,
    ).toBeNull();
  });
});

describe("overlayBoxesOverlap", () => {
  it("detects overlap and separation", () => {
    expect(
      overlayBoxesOverlap(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 },
      ),
    ).toBe(true);
    expect(
      overlayBoxesOverlap(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 0, width: 10, height: 10 },
      ),
    ).toBe(false);
  });
});
