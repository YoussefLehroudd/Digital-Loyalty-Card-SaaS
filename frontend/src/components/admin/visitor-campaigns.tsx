"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, Link2, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { adminRequest } from "@/lib/admin";

export type VisitorCampaign = {
  code:string;
  label:string;
  created_at:string;
  sessions:number;
  last_visit:string|null;
};
const rootUrl = "https://loyvance.vercel.app/";
const toCode = (value:string) => value.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")
  .replace(/^-+|-+$/g,"").slice(0,48).replace(/-+$/,"");
const campaignUrl = (code:string) => rootUrl + "?ref=" + encodeURIComponent(code);

export function VisitorCampaigns({token,campaigns,days,onCreated}:{
  token:string;
  campaigns:VisitorCampaign[];
  days:number;
  onCreated:()=>void;
}) {
  const { t } = useI18n();
  const [label,setLabel] = useState("");
  const [code,setCode] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [created,setCreated] = useState("");
  const [copied,setCopied] = useState("");
  const total=campaigns.reduce((sum,item)=>sum+Number(item.sessions||0),0);
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError("");setCreated("");
    try {
      await adminRequest("visitors/campaigns",token,{
        method:"POST",
        body:JSON.stringify({label:label.trim(),code:code.trim().toLowerCase()})
      });
      setCreated(t("Campaign link created."));
      setLabel("");setCode("");
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not create campaign."));
    } finally { setBusy(false); }
  }
  async function copy(codeToCopy:string){
    try {
      await navigator.clipboard.writeText(campaignUrl(codeToCopy));
      setCopied(codeToCopy);
      setError("");
    } catch {
      setError(t("Could not copy. Select the link manually."));
    }
  }
  return <section className="admin-panel min-w-0 rounded-2xl border border-[#edbc62]/20 bg-[#101318] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#edbc62]"><Link2 className="size-4"/>{t("Campaign tracking")}</p>
        <h2 className="mt-2 text-lg font-semibold">{t("Outreach links for each business")}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">{t("Give each business its own link. Visits are approximate browser sessions, not identified people. Previously sent untagged links cannot be measured retroactively.")}</p>
      </div>
      <div className="shrink-0 rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/10 px-4 py-2 text-end">
        <p className="text-[10px] text-white/55">{t("Tracked visits")} · {days} {t("days")}</p>
        <p className="text-xl font-bold tabular-nums text-[#edbc62]">{total}</p>
      </div>
    </div>
    <form onSubmit={e=>void create(e)} className="mt-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-xs text-white/60">
        {t("Business / campaign name")}
        <input value={label} required maxLength={100}
          onChange={e=>{const value=e.target.value;setLabel(value);setCode(toCode(value));}}
          placeholder={t("Example: Maison Krena")}
          className="mt-1.5 block h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#090b0e] px-3 text-sm text-white outline-none focus:border-[#edbc62]/50"/>
      </label>
      <label className="min-w-0 flex-1 text-xs text-white/60">
        {t("Tracking code")}
        <input value={code} required minLength={3} maxLength={48} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          onChange={e=>setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}
          placeholder="maison-krena"
          className="mt-1.5 block h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#090b0e] px-3 font-mono text-xs text-white outline-none focus:border-[#edbc62]/50"/>
      </label>
      <button type="submit" disabled={busy||label.trim().length<2||code.length<3}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#edbc62] px-4 text-xs font-bold text-black transition hover:bg-[#f4ca81] disabled:opacity-50">
        <Plus className="size-4"/>{busy?t("Creating…"):t("Create link")}
      </button>
    </form>
    {error?<p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>:null}
    {created?<p role="status" className="mt-2 text-xs text-emerald-300">{created}</p>:null}
    {campaigns.length===0?
      <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-xs text-white/50">{t("No tracked business links yet. Create a campaign above, then share its unique URL.")}</p>:
      <div className="admin-visitors-ranking-scroll mt-4 max-h-[360px] space-y-2 overflow-y-auto overscroll-y-contain pe-1 sm:max-h-[400px]" role="region" aria-label={t("Campaign tracking")} tabIndex={0}>
        {campaigns.map(c=><div key={c.code} className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">{c.label}</span><span className="shrink-0 rounded-md bg-[#edbc62]/10 px-2 py-0.5 text-xs font-bold tabular-nums text-[#edbc62]">{c.sessions}</span></div>
            <input readOnly aria-label={t("Campaign link")+" "+c.label} value={campaignUrl(c.code)} onFocus={e=>e.currentTarget.select()}
              className="mt-1 block w-full min-w-0 cursor-text truncate bg-transparent font-mono text-[11px] text-white/50 outline-none"/>
            <p className="mt-1 text-[10px] text-white/35">{c.last_visit?t("Last visit")+": "+new Date(c.last_visit).toLocaleDateString():t("No visits yet")}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={()=>void copy(c.code)} type="button" aria-label={t("Copy link")+" "+c.label} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#edbc62]/30 px-3 text-xs font-semibold text-[#edbc62] hover:bg-[#edbc62]/10">
              {copied===c.code?<Check className="size-4"/>:<Copy className="size-4"/>}{copied===c.code?t("Copied"):t("Copy link")}
            </button>
            <a target="_blank" rel="noopener noreferrer" href={campaignUrl(c.code)} aria-label={t("Open campaign link")+" "+c.label} className="grid size-9 place-items-center rounded-lg border border-white/15 text-white/60 hover:text-white"><ExternalLink className="size-4"/></a>
          </div>
        </div>)}
      </div>
    }
    <p className="mt-3 text-[11px] leading-5 text-white/40">{t("Tracking is first-party and respects Do Not Track, Global Privacy Control and opt-outs. Campaign codes only are stored; no URL query strings, GPS or raw IP addresses.")}</p>
  </section>;
}
