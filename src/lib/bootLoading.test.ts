import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APP_LOADING_MESSAGES,
  BOOT_LOADING_LOCALES,
  BOOT_STORAGE_KEY,
  bootLoadingMessage,
  resolveBootLoadingLocale,
} from "@/lib/bootLoading";
import { STORAGE_KEY } from "@/lib/storage";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const localeModules = import.meta.glob("../i18n/*.json", {
  eager: true,
  import: "default",
}) as Record<string, { app?: { loading?: string } }>;

describe("boot loading messages", () => {
  it("uses the same storage key as persisted settings", () => {
    expect(BOOT_STORAGE_KEY).toBe(STORAGE_KEY);
    expect(BOOT_STORAGE_KEY).toBe("agent-arena-data");
  });

  it("matches app.loading in every locale JSON", () => {
    expect(BOOT_LOADING_LOCALES.length).toBe(10);
    for (const code of BOOT_LOADING_LOCALES) {
      const locale = localeModules[`../i18n/${code}.json`];
      expect(locale?.app?.loading, code).toBe(APP_LOADING_MESSAGES[code]);
    }
  });

  it("keeps the inline index.html table in sync with the JSON messages", () => {
    const html = readFileSync(path.join(rootDir, "index.html"), "utf8");
    const match = html.match(
      /<script type="application\/json" id="aa-boot-loading-i18n">\s*([\s\S]*?)\s*<\/script>/,
    );
    expect(match, "missing #aa-boot-loading-i18n JSON block").toBeTruthy();
    const table = JSON.parse(match![1]!) as Record<string, string>;
    expect(Object.keys(table).sort()).toEqual([...BOOT_LOADING_LOCALES].sort());
    for (const code of BOOT_LOADING_LOCALES) {
      expect(table[code], code).toBe(APP_LOADING_MESSAGES[code]);
    }
  });
});

describe("resolveBootLoadingLocale", () => {
  it("prefers a valid stored language", () => {
    expect(
      resolveBootLoadingLocale({
        storedLanguage: "tr",
        navigatorLanguage: "en-US",
      }),
    ).toBe("tr");
  });

  it("falls back to navigator language / prefix", () => {
    expect(
      resolveBootLoadingLocale({
        storedLanguage: "nope",
        navigatorLanguage: "ja-JP",
      }),
    ).toBe("ja");
    expect(
      resolveBootLoadingLocale({
        navigatorLanguages: ["pt-BR", "en"],
      }),
    ).toBe("pt");
  });

  it("defaults to English", () => {
    expect(resolveBootLoadingLocale({})).toBe("en");
    expect(bootLoadingMessage("nope")).toBe(APP_LOADING_MESSAGES.en);
  });
});
