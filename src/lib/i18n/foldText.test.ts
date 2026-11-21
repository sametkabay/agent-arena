import { describe, expect, it } from "vitest";
import { foldText } from "@/lib/i18n/foldText";

describe("foldText", () => {
  it("lowercases and strips combining marks", () => {
    expect(foldText("Café")).toBe("cafe");
    expect(foldText("GROSS")).toBe("gross");
    expect(foldText("naïve")).toBe("naive");
  });

  it("leaves CJK unchanged aside from casing", () => {
    expect(foldText("デスク")).toBe("デスク");
  });

  it("folds Turkish dotted/dotless i so ışık variants match", () => {
    expect(foldText("ışık")).toBe("isik");
    expect(foldText("Işık")).toBe("isik");
    expect(foldText("İşık")).toBe("isik");
    expect(foldText("isik")).toBe("isik");
    expect(foldText("IŞIK")).toBe("isik");
  });
});
