import { classifyStorageError } from "@/lib/storage";
import type { UserAssetErrorCode } from "@/lib/userAssets/types";

export type UserAssetErrorParams = Record<string, string | number>;

export class UserAssetError extends Error {
  readonly code: UserAssetErrorCode;
  /** i18n key under mapEditor.customAssets (e.g. "errExtension"). */
  readonly key: string;
  readonly params: UserAssetErrorParams;

  constructor(
    code: UserAssetErrorCode,
    keyOrMessage?: string,
    params?: UserAssetErrorParams,
  ) {
    // Prefer a stable key as message when the second arg looks like an i18n key.
    const key =
      keyOrMessage && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(keyOrMessage)
        ? keyOrMessage
        : code === "invalid"
          ? "errUnknown"
          : code === "aborted"
            ? "cancelled"
            : code === "quota"
              ? "errQuota"
              : code === "unavailable"
                ? "errUnavailable"
                : code;
    const message =
      keyOrMessage && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(keyOrMessage)
        ? keyOrMessage
        : key;
    super(message);
    this.name = "UserAssetError";
    this.code = code;
    this.key = key;
    this.params = params ?? {};
  }
}

export function isUserAssetError(err: unknown): err is UserAssetError {
  return err instanceof UserAssetError;
}

/** Map IDB / storage failures onto UserAssetError codes. */
export function classifyUserAssetError(err: unknown): UserAssetError {
  if (err instanceof UserAssetError) return err;
  if (err != null && typeof err === "object" && "name" in err) {
    const name = String((err as { name: unknown }).name);
    if (name === "AbortError") {
      return new UserAssetError("aborted", "cancelled");
    }
    if (name === "InvalidStateError" || name === "SecurityError") {
      return new UserAssetError("unavailable", "errUnavailable");
    }
  }
  const reason = classifyStorageError(err);
  if (reason === "quota") {
    return new UserAssetError("quota", "errQuota");
  }
  if (reason === "unavailable") {
    return new UserAssetError("unavailable", "errUnavailable");
  }
  return new UserAssetError(
    "invalid",
    "errUnknown",
    undefined,
  );
}
