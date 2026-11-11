import { describe, expect, it } from "vitest";
import {
  estimateSegmentedLabelWidths,
  segmentedHighlightMatchesValue,
  shouldStackSegmented,
} from "@/components/ui/segmentedLayout";

describe("shouldStackSegmented", () => {
  it("stacks below the narrow breakpoint", () => {
    expect(
      shouldStackSegmented({
        containerWidth: 360,
        labelWidths: [40, 40, 40],
        gapPx: 4,
        paddingX: 8,
      }),
    ).toBe(true);
  });

  it("stays horizontal when labels fit on a wide row", () => {
    expect(
      shouldStackSegmented({
        containerWidth: 480,
        labelWidths: [40, 80, 90],
        gapPx: 4,
        paddingX: 8,
      }),
    ).toBe(false);
  });

  it("stacks when nowrap labels overflow even above the breakpoint", () => {
    expect(
      shouldStackSegmented({
        containerWidth: 420,
        labelWidths: [160, 160, 160],
        gapPx: 4,
        paddingX: 8,
      }),
    ).toBe(true);
  });
});

describe("estimateSegmentedLabelWidths", () => {
  it("adds option horizontal padding to each natural width", () => {
    expect(estimateSegmentedLabelWidths([10, 20, 30], 12)).toEqual([
      22, 32, 42,
    ]);
  });

  it("clamps negative naturals to zero before padding", () => {
    expect(estimateSegmentedLabelWidths([-4, 0], 12)).toEqual([12, 12]);
  });
});

describe("segmentedHighlightMatchesValue", () => {
  const optionValues = ["off", "idle", "conversation"];

  it("is true when selected index matches the value", () => {
    expect(
      segmentedHighlightMatchesValue({
        value: "conversation",
        optionValues,
        selectedIndex: 2,
      }),
    ).toBe(true);
  });

  it("is false when highlight lags on another option", () => {
    expect(
      segmentedHighlightMatchesValue({
        value: "conversation",
        optionValues,
        selectedIndex: 0,
      }),
    ).toBe(false);
  });

  it("is false for unknown values", () => {
    expect(
      segmentedHighlightMatchesValue({
        value: "nope",
        optionValues,
        selectedIndex: 0,
      }),
    ).toBe(false);
  });
});
