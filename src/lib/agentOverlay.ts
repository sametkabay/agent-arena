/** Gap between the name label and the speech bubble in the stacked overlay (CSS px).
 *  Keep above the speech-bubble CSS tail (~5px) so the tip never covers the name. */
export const AGENT_OVERLAY_STACK_GAP_PX = 10;

/** World-space Y offset of the overlay stack anchor above character height. */
export const AGENT_LABEL_OFFSET_WORLD = 0.22;

/** Axis-aligned box in screen space (y grows downward). */
export type OverlayBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** World Y for the bottom-anchored agent name + speech stack. */
export function agentOverlayStackWorldY(characterHeight: number): number {
  return characterHeight + AGENT_LABEL_OFFSET_WORLD;
}

/**
 * Screen-space boxes for a bottom-anchored column (bubble above label).
 * The stack's bottom-center sits at `(anchorX, anchorBottomY)`.
 */
export function stackedAgentOverlayBoxes({
  anchorX,
  anchorBottomY,
  labelWidth,
  labelHeight,
  bubbleWidth,
  bubbleHeight,
  gapPx = AGENT_OVERLAY_STACK_GAP_PX,
}: {
  anchorX: number;
  anchorBottomY: number;
  labelWidth: number;
  labelHeight: number;
  bubbleWidth?: number;
  bubbleHeight?: number;
  gapPx?: number;
}): { label: OverlayBox; bubble: OverlayBox | null } {
  const label: OverlayBox = {
    x: anchorX - labelWidth / 2,
    y: anchorBottomY - labelHeight,
    width: labelWidth,
    height: labelHeight,
  };
  if (
    bubbleWidth === undefined ||
    bubbleHeight === undefined ||
    bubbleWidth <= 0 ||
    bubbleHeight <= 0
  ) {
    return { label, bubble: null };
  }
  const bubble: OverlayBox = {
    x: anchorX - bubbleWidth / 2,
    y: label.y - gapPx - bubbleHeight,
    width: bubbleWidth,
    height: bubbleHeight,
  };
  return { label, bubble };
}

/** True when two axis-aligned boxes share any positive area. */
export function overlayBoxesOverlap(a: OverlayBox, b: OverlayBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
