import { describe, expect, it } from "vitest";
import {
  isUserAssetId,
  makeUserAssetId,
  shortUserAssetLabel,
} from "@/lib/userAssets/ids";

const SAMPLE = "user:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("user asset ids", () => {
  it("requires user: + uuid format", () => {
    expect(isUserAssetId(SAMPLE)).toBe(true);
    expect(isUserAssetId("user:abc")).toBe(false);
    expect(isUserAssetId("user:")).toBe(false);
    expect(isUserAssetId("chair")).toBe(false);
  });

  it("makes uuid ids", () => {
    expect(makeUserAssetId("fixed")).toBe("user:fixed");
    expect(isUserAssetId(makeUserAssetId())).toBe(true);
    const real = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    });
    expect(isUserAssetId(makeUserAssetId())).toBe(true);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: real,
    });
  });

  it("shortens labels", () => {
    expect(shortUserAssetLabel("user:abcd")).toBe("abcd");
    expect(shortUserAssetLabel("user:abcdefghijklmnop")).toMatch(/…$/);
    expect(shortUserAssetLabel("chair")).toBe("chair");
  });
});
