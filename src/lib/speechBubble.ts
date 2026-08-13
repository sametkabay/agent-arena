import { appConfig } from "@/lib/config";

/** Visible speech-bubble window: newest characters only. */
export const SPEECH_BUBBLE_MAX_CHARS = appConfig.speech.maxChars;

/**
 * Keep at most N characters of the newest text. Older content is hidden
 * behind an ellipsis so streaming continues to flow after "...".
 */
export function formatSpeechBubble(text: string): string {
  if (!text) return "…";
  if (text.length <= SPEECH_BUBBLE_MAX_CHARS) return text;
  return "…" + text.slice(-SPEECH_BUBBLE_MAX_CHARS);
}
