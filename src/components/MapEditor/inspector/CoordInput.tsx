import { useState } from "react";
import {
  formatCoordValue,
  parseCoordInput,
} from "@/components/MapEditor/inspector/coordFormat";

/**
 * Editor coordinate field that always displays a period decimal, independent of
 * the browser/OS locale (Chromium `type=number` otherwise shows "8,6" under tr).
 *
 * While focused, local draft text is shown; when blurred, the displayed text is
 * always derived from the (possibly clamped) `value` prop — empty/whitespace
 * never commits as 0.
 */
export function CoordInput({
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  value: number;
  onChange: (n: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  // null ⇒ not focused; display comes from `value`. string ⇒ editing draft.
  const [draft, setDraft] = useState<string | null>(null);
  const focused = draft !== null;
  const text = focused ? draft : formatCoordValue(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      lang="en"
      autoComplete="off"
      spellCheck={false}
      value={text}
      onFocus={() => {
        setDraft(formatCoordValue(value));
        onFocus?.();
      }}
      onBlur={() => {
        const n = parseCoordInput(draft ?? "");
        if (Number.isFinite(n)) onChange(n);
        setDraft(null);
        onBlur?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = parseCoordInput(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
