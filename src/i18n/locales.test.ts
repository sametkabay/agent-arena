import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/config";

const localeModules = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<
  string,
  Record<string, unknown>
>;

const REQUIRED_KEYS = [
  "app.loading",
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
  "settings.agents.personality",
  "settings.agents.personalityHint",
  "settings.agents.temperament",
  "settings.agents.temperamentAgreeable",
  "settings.agents.temperamentAggressive",
  "settings.agents.temperamentValueText",
  "settings.agents.exportRoster",
  "settings.agents.exportRosterAria",
  "settings.agents.exported",
  "settings.agents.exportEmpty",
  "settings.agents.exportFailed",
  "settings.agents.importRoster",
  "settings.agents.importRosterAria",
  "settings.agents.imported_one",
  "settings.agents.imported_other",
  "settings.agents.importDialog.title",
  "settings.agents.importDialog.summary_one",
  "settings.agents.importDialog.summary_other",
  "settings.agents.importDialog.skipped_one",
  "settings.agents.importDialog.skipped_other",
  "settings.agents.importDialog.applyAll",
  "settings.agents.importDialog.modelFor",
  "settings.agents.importDialog.confirm_one",
  "settings.agents.importDialog.confirm_other",
  "settings.agents.importDialog.cancel",
  "settings.agents.importDialog.errors.tooLarge",
  "settings.agents.importDialog.errors.invalidJson",
  "settings.agents.importDialog.errors.wrongFormat",
  "settings.agents.importDialog.errors.unsupportedVersion",
  "settings.agents.importDialog.errors.empty",
  "settings.agents.importDialog.errors.tooMany",
  "settings.agents.importDialog.errors.tooManyTotal",
  "settings.models.showKey",
  "settings.models.hideKey",
  "settings.models.exportConfigs",
  "settings.models.exportConfigsAria",
  "settings.models.importConfigs",
  "settings.models.importConfigsAria",
  "settings.models.exportDialog.title",
  "settings.models.exportDialog.includeKeys",
  "settings.models.exportDialog.keysWarning",
  "settings.models.exportDialog.confirm",
  "settings.models.exportDialog.confirmWithKeys",
  "settings.models.exportDialog.cancel",
  "settings.models.exported",
  "settings.models.exportEmpty",
  "settings.models.exportFailed",
  "settings.models.imported_one",
  "settings.models.imported_other",
  "settings.models.importedSkipped_one",
  "settings.models.importedSkipped_other",
  "settings.models.allDuplicates",
  "settings.models.invalidSkipped_one",
  "settings.models.invalidSkipped_other",
  "settings.models.emptyHeadersHint",
  "settings.models.importKeysNotice.title",
  "settings.models.importKeysNotice.body",
  "settings.models.importKeysNotice.confirm",
  "settings.models.errors.tooLarge",
  "settings.models.errors.invalidJson",
  "settings.models.errors.wrongFormat",
  "settings.models.errors.unsupportedVersion",
  "settings.models.errors.empty",
  "settings.models.errors.tooMany",
  "settings.models.errors.tooManyTotal",
  "settings.map.propCount_other",
  "settings.map.importConflict.title",
  "settings.map.importConflict.body",
  "settings.map.importConflict.unsavedWarning",
  "settings.map.importConflict.overwrite",
  "settings.map.importConflict.copy",
  "settings.map.importConflict.cancel",
  "settings.map.importedAsCopy",
  "settings.map.overwritten",
  "settings.map.presetsTitle",
  "settings.map.presetsHint",
  "settings.map.presetCreateAria",
  "settings.map.presets.starter_camp.name",
  "settings.map.presets.starter_camp.description",
  "settings.map.presets.space_outpost.name",
  "settings.map.presets.space_outpost.description",
  "settings.map.presets.office_lounge.name",
  "settings.map.presets.office_lounge.description",
  "settings.map.presets.blank_concrete.name",
  "settings.map.presets.blank_concrete.description",
  "settings.general.chatterMode",
  "settings.general.chatterModeHint",
  "settings.general.chatterModeOff",
  "settings.general.chatterModeIdle",
  "settings.general.chatterModeConversation",
  "settings.general.chatterModeOffHint",
  "settings.general.chatterModeIdleHint",
  "settings.general.chatterModeConversationHint_one",
  "settings.general.chatterModeConversationHint_other",
  "settings.general.reset.title",
  "settings.general.reset.hint",
  "settings.general.reset.action",
  "settings.general.reset.confirmTitle",
  "settings.general.reset.confirmBody",
  "settings.general.reset.keeps",
  "settings.general.reset.backupTitle",
  "settings.general.reset.backupHint",
  "settings.general.reset.backupAgents",
  "settings.general.reset.backupModels",
  "settings.general.reset.backupMaps",
  "settings.general.reset.backupMapsHint",
  "settings.general.reset.keepModels",
  "settings.general.reset.keepModelsHint",
  "settings.general.reset.confirm",
  "settings.general.reset.done",
  "chat.arena.conversationWaiting",
  "storage.quotaExceeded",
  "storage.unavailable",
  "storage.writeFailed",
  "mapEditor.saveFailed",
  "mapEditor.saveFailedUnavailable",
  "mapEditor.saveFailedUnknown",
  "mapEditor.dismissSaveError",
  "mapEditor.toolZone",
  "mapEditor.toolLight",
  "mapEditor.toolbarMore",
  "mapEditor.zoneMode",
  "mapEditor.lightMode",
  "mapEditor.zone",
  "mapEditor.light",
  "mapEditor.zoneName",
  "mapEditor.zoneDefaultName",
  "mapEditor.zoneNameStem",
  "mapEditor.zoneKind",
  "mapEditor.zoneRadius",
  "mapEditor.zoneWidth",
  "mapEditor.zoneDepth",
  "mapEditor.zoneConvertToRect",
  "mapEditor.zoneKinds.camp",
  "mapEditor.zoneKinds.yard",
  "mapEditor.zoneKinds.indoor",
  "mapEditor.zoneKinds.path",
  "mapEditor.zoneKinds.platform",
  "mapEditor.zoneKinds.custom",
  "mapEditor.lightColor",
  "mapEditor.lightIntensity",
  "mapEditor.lightRange",
  "mapEditor.lightHeight",
  "mapEditor.deleteZone",
  "mapEditor.deleteLight",
  "mapEditor.zonesList",
  "mapEditor.lightsList",
  "mapEditor.lightListItem",
  "mapEditor.zoneLimit",
  "mapEditor.lightLimit",
  "mapEditor.zoneSelectedBanner",
  "mapEditor.lightSelectedBanner",
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
  it("lists exactly 190 required keys", () => {
    expect(REQUIRED_KEYS).toHaveLength(191);
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

  it("provides Russian few/many plurals for the conversation turn hint", () => {
    const ru = localeModules["./ru.json"]!;
    for (const form of ["few", "many"] as const) {
      const value = getByPath(ru, `settings.general.chatterModeConversationHint_${form}`);
      expect(typeof value).toBe("string");
      expect(placeholders(value as string)).toEqual(["count"]);
    }
  });

  it("provides Russian few/many plurals for agent roster import copy", () => {
    const ru = localeModules["./ru.json"]!;
    for (const key of [
      "settings.agents.imported",
      "settings.agents.importDialog.summary",
      "settings.agents.importDialog.skipped",
      "settings.agents.importDialog.confirm",
    ] as const) {
      for (const form of ["few", "many"] as const) {
        const value = getByPath(ru, `${key}_${form}`);
        expect(typeof value, `ru:${key}_${form}`).toBe("string");
        expect(placeholders(value as string)).toEqual(["count"]);
      }
    }
  });

  it("provides Russian few/many plurals for model config import copy", () => {
    const ru = localeModules["./ru.json"]!;
    for (const key of [
      "settings.models.imported",
      "settings.models.invalidSkipped",
    ] as const) {
      for (const form of ["few", "many"] as const) {
        const value = getByPath(ru, `${key}_${form}`);
        expect(typeof value, `ru:${key}_${form}`).toBe("string");
        expect(placeholders(value as string)).toEqual(["count"]);
      }
    }
    for (const form of ["one", "few", "many", "other"] as const) {
      const value = getByPath(ru, `settings.models.importedSkipped_${form}`);
      expect(typeof value, `ru:importedSkipped_${form}`).toBe("string");
      expect(placeholders(value as string)).toEqual(["count", "skipped"]);
    }
  });

  it("English one/other forms differ for importedSkipped counts", () => {
    const en = localeModules["./en.json"]!;
    const one = getByPath(en, "settings.models.importedSkipped_one") as string;
    const other = getByPath(en, "settings.models.importedSkipped_other") as string;
    expect(one).toContain("{{count}} config");
    expect(other).toContain("{{count}} configs");
    expect(one).toContain("duplicates skipped: {{skipped}}");
    expect(other).toContain("duplicates skipped: {{skipped}}");
    expect(one).not.toBe(other);
  });

  it("English one/other forms differ for a single turn vs many", () => {
    const en = localeModules["./en.json"]!;
    const one = getByPath(en, "settings.general.chatterModeConversationHint_one") as string;
    const other = getByPath(en, "settings.general.chatterModeConversationHint_other") as string;
    expect(one).toContain("{{count}} turn ");
    expect(other).toContain("{{count}} turns ");
    expect(one).not.toBe(other);
  });

  it("English one/other forms differ for imported agent counts", () => {
    const en = localeModules["./en.json"]!;
    const one = getByPath(en, "settings.agents.imported_one") as string;
    const other = getByPath(en, "settings.agents.imported_other") as string;
    expect(one).toContain("{{count}} agent");
    expect(other).toContain("{{count}} agents");
    expect(one).not.toBe(other);
  });

  it("English one/other forms differ for imported model counts", () => {
    const en = localeModules["./en.json"]!;
    const one = getByPath(en, "settings.models.imported_one") as string;
    const other = getByPath(en, "settings.models.imported_other") as string;
    expect(one).toContain("{{count}} model");
    expect(other).toContain("{{count}} models");
    expect(one).not.toBe(other);
  });
});
