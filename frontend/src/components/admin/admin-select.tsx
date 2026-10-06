"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, CircleCheck, CircleSlash, SlidersHorizontal } from "lucide-react";

const statusOptions = [
  { value: "", label: "All statuses", description: "Every account", icon: SlidersHorizontal, color: "text-[#edbc62]" },
  { value: "active", label: "Active", description: "Accounts with access", icon: CircleCheck, color: "text-emerald-300" },
  { value: "suspended", label: "Suspended", description: "Access paused", icon: CircleSlash, color: "text-rose-300" },
];

const subscriptionOptions = [
 {value:"",label:"All subscriptions",description:"Every subscription",icon:SlidersHorizontal,color:"text-[#edbc62]"},
 {value:"trial",label:"Free trial",description:"14-day trial access",icon:CircleCheck,color:"text-[#edbc62]"},
 {value:"active",label:"Subscribed",description:"Paid period active",icon:CircleCheck,color:"text-emerald-300"},
 {value:"ending",label:"Ending in 3 days",description:"Renewal is due soon",icon:CircleSlash,color:"text-amber-200"},
 {value:"expired",label:"Expired",description:"Read-only access",icon:CircleSlash,color:"text-rose-300"},
];
export function AdminStatusSelect({ value, onChange, variant="account" }: { value: string; onChange: (value: string) => void; variant?: "account" | "subscription" }) {
 const options=variant==="subscription"?subscriptionOptions:statusOptions;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const [active, setActive] = useState(selected);
  const current = options[selected];
  const Icon = current.icon;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setActive(selected); setOpen(true); }
      else setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
      return;
    }
    if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault(); setActive(event.key === "Home" ? 0 : options.length - 1); return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else { setActive(selected); setOpen(true); }
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      search.current = { text: (now - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase(), time: now };
      const match = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text));
      if (match >= 0) { setActive(match); setOpen(true); }
    }
  }

  return (
    <div ref={root} className="relative w-full shrink-0 sm:w-48" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={trigger} type="button" role="combobox" aria-label={variant==="subscription"?"Filter by subscription":"Filter by account status"} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined} onKeyDown={onKeyDown} onClick={() => { setActive(selected); setOpen(currentOpen => !currentOpen); }} className={`flex h-11 w-full items-center gap-2.5 rounded-xl border bg-gradient-to-b from-[#191c22] to-[#101319] px-3 text-xs font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101319] motion-reduce:transition-none ${open ? "border-[#edbc62]/50" : "border-white/10 hover:border-[#edbc62]/30"}`}>
        <span className={`grid size-6 shrink-0 place-items-center rounded-lg bg-white/5 ${current.color}`}><Icon aria-hidden="true" className="size-3.5" /></span>
        <span className="truncate">{current.label}</span>
        <ChevronDown aria-hidden="true" className={`ml-auto size-3.5 shrink-0 text-[#edbc62]/70 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div id={`${id}-list`} role="listbox" aria-label={variant==="subscription"?"Subscription status":"Account status"} className="absolute right-0 top-full z-40 mt-2 w-full rounded-2xl border border-[#edbc62]/20 bg-[#15191f] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        {options.map((option, index) => {
          const OptionIcon = option.icon;
          return <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={index === selected} onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)} className={`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors motion-reduce:transition-none ${index === active ? "bg-[#edbc62]/10" : "hover:bg-white/5"}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg border border-white/[.06] bg-white/[.035] ${option.color}`}><OptionIcon aria-hidden="true" className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className={`text-xs font-semibold ${index === selected ? "text-[#edbc62]" : "text-white/85"}`}>{option.label}</p><p className="mt-0.5 text-[10px] text-white/40">{option.description}</p></div>
            {index === selected ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-[#edbc62]" /> : null}
          </div>;
        })}
      </div> : null}
    </div>
  );
}

