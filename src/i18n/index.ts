import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";
import es from "@/i18n/es.json";
import zh from "@/i18n/zh.json";
import pt from "@/i18n/pt.json";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import ja from "@/i18n/ja.json";
import ko from "@/i18n/ko.json";
import ru from "@/i18n/ru.json";
import { applyDocumentLang, isLanguageCode } from "@/i18n/languages";
import { loadPersisted } from "@/lib/storage";

const persisted = loadPersisted();
const lng = isLanguageCode(persisted.language) ? persisted.language : "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
    es: { translation: es },
    zh: { translation: zh },
    pt: { translation: pt },
    fr: { translation: fr },
    de: { translation: de },
    ja: { translation: ja },
    ko: { translation: ko },
    ru: { translation: ru },
  },
  lng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

applyDocumentLang(lng);

export default i18n;
