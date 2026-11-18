/** Stack when the container is narrow or nowrap labels would overflow the row. */
export function shouldStackSegmented(opts: {
  containerWidth: number;
  labelWidths: number[];
  gapPx: number;
  paddingX: number;
  narrowBelowPx?: number;
}): boolean {
  const narrowBelow = opts.narrowBelowPx ?? 400;
  if (opts.containerWidth < narrowBelow) return true;
  if (opts.labelWidths.length === 0) return false;
  const gaps = Math.max(0, opts.labelWidths.length - 1) * opts.gapPx;
  const needed =
    opts.labelWidths.reduce((sum, w) => sum + w, 0) + gaps + opts.paddingX;
  return needed > opts.containerWidth + 0.5;
}

/** Horizontal padding added to natural label width when estimating option size. */
export const SEGMENTED_OPTION_PAD_X = 12;

/**
 * Natural nowrap widths for option labels (plus horizontal padding).
 * Pure helper so measurement stays testable without DOM layout.
 */
export function estimateSegmentedLabelWidths(
  naturalLabelWidths: number[],
  optionPadX: number = SEGMENTED_OPTION_PAD_X,
): number[] {
  return naturalLabelWidths.map((w) => Math.max(0, w) + optionPadX);
}

/** True when the highlight styles belong on the checked option. */
export function segmentedHighlightMatchesValue(opts: {
  value: string;
  optionValues: string[];
  selectedIndex: number;
}): boolean {
  const checkedIndex = opts.optionValues.indexOf(opts.value);
  if (checkedIndex < 0 || opts.selectedIndex < 0) return false;
  return checkedIndex === opts.selectedIndex;
}
