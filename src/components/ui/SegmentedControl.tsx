import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  estimateSegmentedLabelWidths,
  shouldStackSegmented,
} from "@/components/ui/segmentedLayout";

export type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  name: string;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Accessible segmented radios: native inputs inside a radiogroup so arrow keys
 * and the focus ring work without extra keyboard code.
 */
export function SegmentedControl({
  value,
  onChange,
  options,
  name,
  labelledBy,
  describedBy,
  className,
  disabled = false,
}: SegmentedControlProps) {
  const reactId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  const optionKey = options.map((o) => `${o.value}:${o.label}`).join("|");

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const style = getComputedStyle(root);
      const gapPx = Number.parseFloat(style.columnGap || style.gap || "4") || 4;
      const paddingX =
        (Number.parseFloat(style.paddingLeft) || 0) +
        (Number.parseFloat(style.paddingRight) || 0);
      const labels = root.querySelectorAll<HTMLElement>(".aa-segmented__label");
      // Measure off-root so ResizeObserver on `root` is not re-triggered.
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.cssText =
        "position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;";
      document.body.appendChild(host);
      const naturalWidths: number[] = [];
      for (const label of labels) {
        const clone = label.cloneNode(true) as HTMLElement;
        clone.style.cssText =
          "position:static;white-space:nowrap;width:auto;height:auto;";
        host.appendChild(clone);
        naturalWidths.push(clone.scrollWidth);
      }
      host.remove();
      const labelWidths = estimateSegmentedLabelWidths(naturalWidths);
      setStacked(
        shouldStackSegmented({
          containerWidth: root.clientWidth,
          labelWidths,
          gapPx,
          paddingX,
        }),
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [optionKey]);

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={[
        "aa-segmented",
        stacked ? "aa-segmented--stack" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((opt) => {
        const id = `${reactId}-${opt.value}`;
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={
              "aa-segmented__option" + (checked ? " is-selected" : "")
            }
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
            />
            <span className="aa-segmented__label">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
