export const LANGUAGES = [
  { code: "en", label: "English", englishName: "English" },
  { code: "tr", label: "Türkçe", englishName: "Turkish" },
  { code: "es", label: "Español", englishName: "Spanish" },
  { code: "zh", label: "简体中文", englishName: "Chinese" },
  { code: "pt", label: "Português", englishName: "Portuguese" },
  { code: "fr", label: "Français", englishName: "French" },
  { code: "de", label: "Deutsch", englishName: "German" },
  { code: "ja", label: "日本語", englishName: "Japanese" },
  { code: "ko", label: "한국어", englishName: "Korean" },
  { code: "ru", label: "Русский", englishName: "Russian" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((l) => l.code);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function languageEnglishName(language: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === language)?.englishName ?? "English";
}

export function applyDocumentLang(language: LanguageCode): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
}
