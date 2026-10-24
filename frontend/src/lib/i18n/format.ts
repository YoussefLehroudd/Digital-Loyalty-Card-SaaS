// Safe in shared utilities: browser preference when present, English during SSR.
export function getFormattingLocale(): "en" | "fr" | "ar" {
  if (typeof document === "undefined") return "en";
  const language = document.documentElement.lang;
  return language === "fr" || language === "ar" ? language : "en";
}
