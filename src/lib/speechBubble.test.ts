import { describe, expect, it } from "vitest";
import { SPEECH_BUBBLE_MAX_CHARS, formatSpeechBubble } from "@/lib/speechBubble";

describe("formatSpeechBubble", () => {
  it("shows ellipsis for empty text and keeps short lines", () => {
    expect(formatSpeechBubble("")).toBe("…");
    expect(formatSpeechBubble("hi")).toBe("hi");
  });

  it("keeps the newest characters when over the limit", () => {
    const long = "a".repeat(SPEECH_BUBBLE_MAX_CHARS + 10);
    const out = formatSpeechBubble(long);
    expect(out.startsWith("…")).toBe(true);
    expect(out.slice(1)).toBe(long.slice(-SPEECH_BUBBLE_MAX_CHARS));
  });
});
