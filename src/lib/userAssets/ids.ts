const USER_PREFIX = "user:";

/** UUID v4 (hex) — loose enough for crypto.randomUUID / our fallback. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUserAssetId(id: string): boolean {
  if (!id.startsWith(USER_PREFIX)) return false;
  return UUID_RE.test(id.slice(USER_PREFIX.length));
}

export function makeUserAssetId(uuid?: string): string {
  const id =
    uuid ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }));
  return `${USER_PREFIX}${id}`;
}

/** Short label for missing-asset placeholder when meta is gone. */
export function shortUserAssetLabel(id: string): string {
  if (!id.startsWith(USER_PREFIX)) return id;
  const rest = id.slice(USER_PREFIX.length);
  return rest.length <= 8 ? rest : `${rest.slice(0, 8)}…`;
}
