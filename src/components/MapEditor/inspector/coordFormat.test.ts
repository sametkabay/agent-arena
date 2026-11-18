import { describe, expect, it } from "vitest";
import { formatCoordValue, parseCoordInput } from "./coordFormat";

describe("parseCoordInput", () => {
  it("rejects empty and whitespace", () => {
    expect(Number.isNaN(parseCoordInput(""))).toBe(true);
    expect(Number.isNaN(parseCoordInput("   "))).toBe(true);
    expect(Number.isNaN(parseCoordInput("\t"))).toBe(true);
  });

  it("accepts integers and decimals with period", () => {
    expect(parseCoordInput("0")).toBe(0);
    expect(parseCoordInput("1.5")).toBe(1.5);
    expect(parseCoordInput("-2.25")).toBe(-2.25);
  });

  it("accepts comma as decimal separator", () => {
    expect(parseCoordInput("1,5")).toBe(1.5);
    expect(parseCoordInput("-8,6")).toBe(-8.6);
  });

  it("trims surrounding whitespace", () => {
    expect(parseCoordInput("  3.14  ")).toBe(3.14);
  });

  it("rejects non-numeric text", () => {
    expect(Number.isNaN(parseCoordInput("-"))).toBe(true);
    expect(Number.isNaN(parseCoordInput("abc"))).toBe(true);
  });
});

describe("formatCoordValue", () => {
  it("formats to two decimal places with a period", () => {
    expect(formatCoordValue(1)).toBe("1.00");
    expect(formatCoordValue(1.5)).toBe("1.50");
    expect(formatCoordValue(-2.256)).toBe("-2.26");
  });
});
