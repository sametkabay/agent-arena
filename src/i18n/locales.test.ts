import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";

const localeModules = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<
  string,
  Record<string, unknown>
>;

const REQUIRED_KEYS = [
  "hud.help",
  "agentList.emptyNoModel",
  "onboarding.title",
  "onboarding.intro",
  "onboarding.step1",
  "onboarding.step2",
  "onboarding.step3",
  "onboarding.open",
  "onboarding.alive",
  "onboarding.dontShowAgain",
  "controlsHelp.title",
  "controlsHelp.action",
  "controlsHelp.how",
  "controlsHelp.mouse",
  "controlsHelp.touch",
  "controlsHelp.rows.chat.action",
  "controlsHelp.rows.chat.mouse",
  "controlsHelp.rows.chat.touch",
  "controlsHelp.rows.walk.action",
  "controlsHelp.rows.walk.mouse",
  "controlsHelp.rows.walk.touch",
  "controlsHelp.rows.camera.action",
  "controlsHelp.rows.camera.mouse",
  "controlsHelp.rows.camera.touch",
  "controlsHelp.rows.arena.action",
  "controlsHelp.rows.arena.how",
  "controlsHelp.rows.mention.action",
  "controlsHelp.rows.mention.how",
  "controlsHelp.rows.dayNight.action",
  "controlsHelp.rows.dayNight.how",
  "controlsHelp.rows.editMap.action",
  "controlsHelp.rows.editMap.how",
  "controlsHelp.rows.idle.action",
  "controlsHelp.rows.idle.how",
  "settings.agents.duplicate",
  "settings.agents.duplicateAria",
  "settings.agents.duplicated",
  "settings.agents.copyLabel",
] as const;

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]!.trim()).sort();
}

describe("onboarding locale keys", () => {
  it("lists exactly 38 required keys", () => {
    expect(REQUIRED_KEYS).toHaveLength(38);
  });

  it("includes every configured language with matching placeholders", () => {
    const codes = appConfig.languages.map((l) => l.code);
    expect(codes.length).toBeGreaterThanOrEqual(10);

    const en = localeModules["./en.json"];
    expect(en).toBeTruthy();

    for (const code of codes) {
      const locale = localeModules[`./${code}.json`];
      expect(locale, `missing locale file for ${code}`).toBeTruthy();

      for (const key of REQUIRED_KEYS) {
        const value = getByPath(locale!, key);
        expect(typeof value, `${code}:${key}`).toBe("string");
        expect((value as string).trim().length, `${code}:${key} empty`).toBeGreaterThan(0);

        const enValue = getByPath(en!, key);
        expect(placeholders(value as string)).toEqual(placeholders(enValue as string));
      }
    }
  });
});
