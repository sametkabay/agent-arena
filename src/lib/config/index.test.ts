import { describe, expect, it } from "vitest";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";
import { MAPS } from "@/lib/maps";

describe("barrel exports", () => {
  it("loads config and map index", () => {
    expect(appConfig.app.name).toBeTruthy();
    expect(DEFAULT_GRAPHICS.shadowQuality).toBeTruthy();
    expect(MAPS.length).toBeGreaterThan(0);
  });
});
