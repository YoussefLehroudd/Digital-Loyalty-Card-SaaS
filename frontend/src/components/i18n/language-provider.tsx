"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { dictionaries, type Language } from "@/lib/i18n/catalog";

const normalizedDictionaries = Object.fromEntries(Object.entries(dictionaries).map(([language, entries]) => [language, Object.fromEntries(Object.entries(entries).map(([key, value]) => [key.toLowerCase().replace(/[.!?:…]+$/, ""), value]))])) as Record<"fr" | "ar", Record<string, string>>;

const messageTemplates = Object.fromEntries(Object.entries(dictionaries).map(([language, entries]) => [language, Object.entries(entries).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const indices: string[] = [];
  const pattern = key.split(/(\{\d+\})/).map(part => {
    const parameter = part.match(/^\{(\d+)\}$/);
    if (parameter) { indices.push(parameter[1]); return "(.*?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { expression: new RegExp("^" + pattern + "$"), indices, value };
})])) as Record<"fr" | "ar", { expression: RegExp; indices: string[]; value: string }[]>;

const STORAGE_KEY = "loyvance.language";
export const languages: { value: Language; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "fr", label: "Français", short: "FR" },
  { value: "ar", label: "العربية", short: "ع" },
];
export const isLanguage = (value: unknown): value is Language => value === "en" || value === "fr" || value === "ar";
export function getFormattingLocale() {
  return typeof document !== "undefined" && isLanguage(document.documentElement.lang) ? document.documentElement.lang : "en";
}
export function translate<T>(value: T, language: Language, params?: Record<string, unknown>): T {
  if (typeof value !== "string") return value;
  const key = value.trim().replace(/\s+/g, " ");
  if (!key) return value;
  let translated = language === "en" ? key : dictionaries[language][key] ?? normalizedDictionaries[language][key.toLowerCase().replace(/[.!?:…]+$/, "")] ?? key;
  if (!params && language !== "en" && translated === key && key.length < 3000) {
    for (const template of messageTemplates[language]) {
      const match = key.match(template.expression);
      if (!match) continue;
      const parameters = Object.fromEntries(template.indices.map((index, i) => [index, match[i + 1]]));
      translated = template.value.replace(/\{(\d+)\}/g, (placeholder, index: string) => parameters[index] ?? placeholder);
      break;
    }
  }
  if (params) translated = translated.replace(/\{(\d+)\}/g, (match, index: string) => String(params[index] ?? match));
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return (leading + translated + trailing) as T;
}
type I18nValue = { language: Language; ready: boolean; setLanguage: (language: Language) => void; t: typeof translateForLanguage };
function translateForLanguage<T>(value: T, params?: Record<string, unknown>): T { return translate(value, "en", params); }
const I18nContext = createContext<I18nValue>({ language: "en", ready: false, setLanguage: () => {}, t: translateForLanguage });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [language, updateLanguage] = useState<Language>("en");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Storage can be disabled. */ }
    const route = pathname === "/fr" ? "fr" : pathname === "/ar" ? "ar" : null;
    const next = route ?? (isLanguage(saved) ? saved : "en");
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    updateLanguage(next);
    setReady(true);
    // Read the preference once; subsequent changes are driven by the selector or storage event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (pathname === "/fr") updateLanguage("fr");
    if (pathname === "/ar") updateLanguage("ar");
  }, [pathname]);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Preference still works in memory. */ }
    document.cookie = `loyvance_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
  }, [language, ready]);
  useEffect(() => {
    if (!ready || !["/", "/fr", "/ar"].includes(pathname)) return;
    const titles = { en: "Loyvance — Digital Loyalty Cards for Your Business", fr: "Loyvance — Carte de fidélité digitale pour votre commerce", ar: "Loyvance — بطاقات ولاء رقمية لنشاطك التجاري" };
    const descriptions = { en: "Create digital loyalty cards and QR code loyalty programs for coffee shops, restaurants, retail stores and salons. Customize stamps and rewards with Loyvance.", fr: "Créez des cartes de fidélité digitales avec QR code pour cafés, restaurants, boutiques et salons. Personnalisez vos tampons et récompenses avec Loyvance.", ar: "أنشئ بطاقات ولاء رقمية برمز QR للمقاهي والمطاعم والمتاجر والصالونات. خصّص الطوابع والمكافآت مع Loyvance." };
    document.title = titles[language];
    document.querySelector('meta[name="description"]')?.setAttribute("content", descriptions[language]);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", titles[language]);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", descriptions[language]);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) { const url = new URL(canonical.href); url.pathname = language === "en" ? "/" : `/${language}`; canonical.href = url.href; }
  }, [language, ready, pathname]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY && isLanguage(event.newValue)) updateLanguage(event.newValue); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const setLanguage = useCallback((next: Language) => {
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    updateLanguage(next);
    setReady(true);
    // Native history updates preserve mounted components and form state, with no document reload.
    const path = window.location.pathname;
    if (["/", "/fr", "/ar"].includes(path)) {
      const nextPath = next === "en" ? "/" : `/${next}`;
      window.history.replaceState(null, "", nextPath + window.location.search + window.location.hash);
    }
  }, []);
  const t = useCallback(<T,>(value: T, params?: Record<string, unknown>): T => translate(value, language, params), [language]);
  const context = useMemo(() => ({ language, ready, setLanguage, t }), [language, ready, setLanguage, t]);
  return <I18nContext.Provider value={context}>{children}</I18nContext.Provider>;
}
export function useI18n() { return useContext(I18nContext); }
export function LocalizedText({ text }: { text: string }) { const { t } = useI18n(); return <>{t(text)}</>; }
