import de from "@/i18n/de.json";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import fr from "@/i18n/fr.json";
import ja from "@/i18n/ja.json";
import ko from "@/i18n/ko.json";
import pt from "@/i18n/pt.json";
import ru from "@/i18n/ru.json";
import tr from "@/i18n/tr.json";
import zh from "@/i18n/zh.json";

/** Persisted settings blob key (must match agent-arena.yaml / index.html). */
export const BOOT_STORAGE_KEY = "agent-arena-data";

/** Locale → `app.loading` (kept in sync with src/i18n/*.json via unit tests). */
export const APP_LOADING_MESSAGES: Readonly<Record<string, string>> = {
  en: en.app.loading,
  tr: tr.app.loading,
  es: es.app.loading,
  zh: zh.app.loading,
  pt: pt.app.loading,
  fr: fr.app.loading,
  de: de.app.loading,
  ja: ja.app.loading,
  ko: ko.app.loading,
  ru: ru.app.loading,
};

export const BOOT_LOADING_LOCALES = Object.keys(APP_LOADING_MESSAGES);

/**
 * Prefer the persisted UI language, then navigator.language / languages.
 * Falls back to English when nothing matches a known locale.
 */
export function resolveBootLoadingLocale({
  storedLanguage,
  navigatorLanguage,
  navigatorLanguages = [],
}: {
  storedLanguage?: unknown;
  navigatorLanguage?: string | null;
  navigatorLanguages?: readonly string[];
}): string {
  if (typeof storedLanguage === "string" && storedLanguage in APP_LOADING_MESSAGES) {
    return storedLanguage;
  }
  const candidates = [
    ...(typeof navigatorLanguage === "string" ? [navigatorLanguage] : []),
    ...navigatorLanguages,
  ];
  for (const raw of candidates) {
    const lower = raw.trim().toLowerCase();
    if (!lower) continue;
    const exact = lower.split("-")[0] ?? lower;
    if (exact in APP_LOADING_MESSAGES) return exact;
  }
  return "en";
}

export function bootLoadingMessage(locale: string): string {
  return APP_LOADING_MESSAGES[locale] ?? APP_LOADING_MESSAGES.en;
}

/** Fade out and remove the inline `#app-loading` splash from index.html. */
export function dismissBootLoading(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("app-loading");
  if (!el) return;
  if (el.classList.contains("is-done")) return;
  el.classList.add("is-done");
  el.removeAttribute("data-loading");
  el.setAttribute("aria-busy", "false");
  el.setAttribute("aria-hidden", "true");
  const remove = () => {
    el.remove();
  };
  el.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 500);
}
