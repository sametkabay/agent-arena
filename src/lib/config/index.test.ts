import { describe, expect, it } from "vitest";
import { appConfig, DEFAULT_GRAPHICS } from "@/lib/config";
import { MAPS } from "@/lib/maps";

describe("barrel exports", () => {
  it("loads config and map index", () => {
    expect(appConfig.app.name).toBeTruthy();
    expect(DEFAULT_GRAPHICS.shadowQuality).toBeTruthy();
    expect(MAPS.length).toBeGreaterThan(0);
  });

  it("keeps crawler-facing title and description", () => {
    expect(appConfig.app.title).toContain("3D multi-agent playground");
    expect(appConfig.app.description).toMatch(
      /open-source, browser-native multi-agent playground/i,
    );
  });

  it("includes NVIDIA NIM as an OpenAI-compatible preset", () => {
    const nim = appConfig.providers.openai.compatiblePresets?.find((p) => p.id === "nvidia-nim");
    expect(nim?.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
  });
});
