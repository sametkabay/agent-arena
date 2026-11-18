import { describe, expect, it } from "vitest";
import {
  UserAssetError,
  classifyUserAssetError,
  isUserAssetError,
} from "@/lib/userAssets/errors";

describe("UserAssetError helpers", () => {
  it("detects instances", () => {
    expect(isUserAssetError(new UserAssetError("quota"))).toBe(true);
    expect(isUserAssetError(new Error("x"))).toBe(false);
  });

  it("carries i18n key + params (no colon codes)", () => {
    const err = new UserAssetError("invalid", "errExtension", {
      ext: "KHR_draco_mesh_compression",
    });
    expect(err.key).toBe("errExtension");
    expect(err.params).toEqual({ ext: "KHR_draco_mesh_compression" });
    expect(err.message).not.toContain(":");
  });

  it("classifies abort / security / quota / unknown", () => {
    expect(
      classifyUserAssetError(new DOMException("aborted", "AbortError")).code,
    ).toBe("aborted");
    expect(
      classifyUserAssetError(new DOMException("sec", "SecurityError")).code,
    ).toBe("unavailable");
    expect(
      classifyUserAssetError(new DOMException("q", "QuotaExceededError")).code,
    ).toBe("quota");
    expect(classifyUserAssetError(new UserAssetError("invalid")).code).toBe(
      "invalid",
    );
    expect(classifyUserAssetError("nope").code).toBe("invalid");
    expect(
      classifyUserAssetError(new DOMException("bad", "InvalidStateError")).code,
    ).toBe("unavailable");
    expect(classifyUserAssetError(null).code).toBe("invalid");
  });
});
