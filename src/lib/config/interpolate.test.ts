import { describe, expect, it } from "vitest";
import { interpolate, interpolateLines } from "@/lib/config/interpolate";

describe("interpolate", () => {
  it("replaces placeholders and treats missing keys as empty", () => {
    expect(interpolate("Hello {{ name }}!", { name: "Samet" })).toBe("Hello Samet!");
    expect(interpolate("n={{n}}", { n: 3 })).toBe("n=3");
    expect(interpolate("go-{{who}}-now", {})).toBe("go--now");
    expect(interpolate("{{ a }}-{{ b }}", { a: "1", b: undefined })).toBe("1-");
  });
});

describe("interpolateLines", () => {
  it("maps interpolate over each line", () => {
    expect(interpolateLines(["{{a}}", "keep"], { a: "ok" })).toEqual(["ok", "keep"]);
  });
});
