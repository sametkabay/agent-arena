import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { applyDocumentLang, isLanguageCode } from "@/i18n/languages";
import { appConfig } from "@/lib/config";
import { loadPersisted } from "@/lib/storage";

const localeModules = import.meta.glob("./*.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const [path, data] of Object.entries(localeModules)) {
  const code = path.match(/\/([a-z]{2})\.json$/)?.[1];
  if (code && isLanguageCode(code)) {
    resources[code] = { translation: data };
  }
}

const persisted = loadPersisted();
const lng = isLanguageCode(persisted.language)
  ? persisted.language
  : appConfig.defaults.language;

void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: appConfig.defaults.language,
  interpolation: { escapeValue: false },
});

applyDocumentLang(lng);

export default i18n;
