/** Visible speech-bubble window: newest characters only. */
export const SPEECH_BUBBLE_MAX_CHARS = 256;

/**
 * Keep at most 256 characters of the newest text. Older content is hidden
 * behind an ellipsis so streaming continues to flow after "...".
 */
export function formatSpeechBubble(text: string): string {
  if (!text) return "…";
  if (text.length <= SPEECH_BUBBLE_MAX_CHARS) return text;
  return "…" + text.slice(-SPEECH_BUBBLE_MAX_CHARS);
}
