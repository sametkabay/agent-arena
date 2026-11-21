/** Compact edit / duplicate / delete glyphs for settings card action buttons. */

export function EditActionIcon() {
  return (
    <svg
      className="card-item__action-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5.5 12.5 2.5 13.5l1-3z" />
    </svg>
  );
}

export function DuplicateActionIcon() {
  return (
    <svg
      className="card-item__action-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
      <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </svg>
  );
}

export function DeleteActionIcon() {
  return (
    <svg
      className="card-item__action-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M3 4.5h10M6 4.5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4.5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-8" />
    </svg>
  );
}
