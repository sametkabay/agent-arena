import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";
import { loadPersisted } from "@/lib/storage";

const persisted = loadPersisted();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: persisted.language || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
