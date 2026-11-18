import { describe, expect, it } from "vitest";
import { builtinDisplayText } from "@/lib/maps/builtinText";

describe("builtinDisplayText", () => {
  const enName = "Office";
  const deName = "Büro";

  it("returns the translation when stored equals the built-in default", () => {
    expect(
      builtinDisplayText({
        stored: enName,
        builtinDefault: enName,
        translated: deName,
      }),
    ).toBe(deName);
  });

  it("keeps an edited value as written", () => {
    expect(
      builtinDisplayText({
        stored: "My Office",
        builtinDefault: enName,
        translated: deName,
      }),
    ).toBe("My Office");
  });

  it("keeps custom / imported maps as written (no builtin default)", () => {
    expect(
      builtinDisplayText({
        stored: "Workshop",
        builtinDefault: null,
        translated: deName,
      }),
    ).toBe("Workshop");
    expect(
      builtinDisplayText({
        stored: "Workshop",
        translated: deName,
      }),
    ).toBe("Workshop");
  });

  it("falls back to stored when the translation is missing", () => {
    expect(
      builtinDisplayText({
        stored: enName,
        builtinDefault: enName,
        translated: null,
      }),
    ).toBe(enName);
    expect(
      builtinDisplayText({
        stored: enName,
        builtinDefault: enName,
        translated: "",
      }),
    ).toBe(enName);
  });

  it("works the same for descriptions", () => {
    const en =
      "Open-plan office on warm oak tile under soft indoor daylight.";
    const ru = "Открытый офис на тёплой дубовой плитке.";
    expect(
      builtinDisplayText({
        stored: en,
        builtinDefault: en,
        translated: ru,
      }),
    ).toBe(ru);
    expect(
      builtinDisplayText({
        stored: "Edited blurb",
        builtinDefault: en,
        translated: ru,
      }),
    ).toBe("Edited blurb");
  });
});
