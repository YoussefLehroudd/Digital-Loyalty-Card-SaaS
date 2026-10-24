"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { languages, useI18n } from "./language-provider";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className="relative shrink-0" data-language-switcher>
    <button ref={button} type="button" aria-label={t("Change language")} aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[#e7b354]/25 bg-[#e7b354]/5 px-2.5 text-xs font-semibold text-[#f3bd55] transition hover:bg-[#e7b354]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]">
      <Globe2 className="size-4" aria-hidden="true"/><span>{languages.find(item => item.value === language)?.short}</span><ChevronDown className="size-3" aria-hidden="true"/>
    </button>
    {open ? <div role="group" aria-label={t("Language")} className="absolute end-0 top-full z-[200] mt-2 min-w-40 rounded-2xl border border-[#e7b354]/30 bg-[#10110e] p-1.5 text-white shadow-2xl">
      {languages.map(item => <button key={item.value} type="button" lang={item.value} dir={item.value === "ar" ? "rtl" : "ltr"} aria-pressed={item.value === language} onClick={() => { setLanguage(item.value); setOpen(false); button.current?.focus(); }} className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-start text-sm hover:bg-[#e7b354]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e7b354]">
        <span>{item.label}</span>{item.value === language ? <Check className="size-4 text-[#f3bd55]" aria-hidden="true"/> : null}
      </button>)}
    </div> : null}
  </div>;
}
