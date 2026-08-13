import { appConfig } from "@/lib/config";

export const LANGUAGES = appConfig.languages;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const LANGUAGE_CODES: readonly string[] = LANGUAGES.map((l) => l.code);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && LANGUAGE_CODES.includes(value);
}

export function languageEnglishName(language: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === language)?.englishName ?? "English";
}

export function applyDocumentLang(language: LanguageCode): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
}
