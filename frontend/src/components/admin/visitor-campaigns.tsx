"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, Link2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { adminRequest } from "@/lib/admin";

export type VisitorCampaign = {
  code: string;
  public_code: string;
  label: string;
  created_at: string;
  sessions: number;
  last_visit: string | null;
};
const rootUrl = "https://loyvance.vercel.app/";
const toCode = (value: string) => value.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "");
const campaignUrl = (code: string) => rootUrl + "?ref=" + encodeURIComponent(code);
const iconButton = "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/60 transition hover:border-[#edbc62]/40 hover:text-[#edbc62] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#edbc62] disabled:cursor-not-allowed disabled:opacity-40";

export function VisitorCampaigns({ token, campaigns, days, onCreated }: {
  token: string;
  campaigns: VisitorCampaign[];
  days: number;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCode, setEditCode] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle"|"checking"|"available"|"taken"|"invalid"|"error">("idle");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const totalVisits = campaigns.reduce((sum, item) => sum + Number(item.sessions || 0), 0);
  const validCode = (value:string) => /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value);

  useEffect(() => {
    if (!editing) { setSlugStatus("idle"); return; }
    if (!validCode(editCode)) { setSlugStatus("invalid"); return; }
    const controller = new AbortController();
    setSlugStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const response=await adminRequest<{available:boolean}>(
          "visitors/campaigns/check?code="+encodeURIComponent(editCode)+"&exclude="+encodeURIComponent(editing),
          token,{signal:controller.signal,cache:"no-store"}
        );
        if(!controller.signal.aborted) setSlugStatus(response.available?"available":"taken");
      } catch {
        if(!controller.signal.aborted) setSlugStatus("error");
      }
    },350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  },[editing,editCode,token]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || acting) return;
    setCreating(true); setError(""); setNotice("");
    try {
      await adminRequest("visitors/campaigns", token, {
        method: "POST", body: JSON.stringify({ label: label.trim(), code: code.trim().toLowerCase() }),
      });
      setNotice(t("Campaign link created."));
      setLabel(""); setCode("");
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not create campaign."));
    } finally { setCreating(false); }
  }
  async function copy(codeToCopy: string) {
    try {
      await navigator.clipboard.writeText(campaignUrl(codeToCopy));
      setCopied(codeToCopy); setError("");
    } catch { setError(t("Could not copy. Select the link manually.")); }
  }
  function startEdit(c: VisitorCampaign) {
    setEditing(c.code); setEditLabel(c.label); setEditCode(c.public_code ?? c.code);
    setConfirmDelete(null); setError(""); setNotice("");
  }
  async function saveEdit(c: VisitorCampaign) {
    const updated = editLabel.trim();
    if (acting || creating || updated.length < 2 || updated.length > 100 || slugStatus!=="available") return;
    setActing(c.code); setError(""); setNotice("");
    try {
      await adminRequest("visitors/campaigns/" + encodeURIComponent(c.code), token, {
        method: "PATCH", body: JSON.stringify({ label: updated, public_code: editCode }),
      });
      setEditing(null);
      setNotice(t("Campaign updated. Previous links still work and are tracked."));
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not update campaign."));
    } finally { setActing(null); }
  }
  async function deleteCampaign(c: VisitorCampaign) {
    if (acting || creating) return;
    setActing(c.code); setError(""); setNotice("");
    try {
      await adminRequest("visitors/campaigns/" + encodeURIComponent(c.code), token, { method: "DELETE" });
      setConfirmDelete(null); setEditing(null);
      setNotice(t("Campaign removed. Historical analytics are retained."));
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not delete campaign."));
    } finally { setActing(null); }
  }

  return <section className="admin-panel min-w-0 rounded-2xl border border-[#edbc62]/20 bg-[#101318] p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#edbc62]"><Link2 className="size-4"/>{t("Campaign tracking")}</p>
        <h2 className="mt-2 text-lg font-semibold">{t("Outreach links for each business")}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">{t("Give each business its own link. Visits are approximate browser sessions, not identified people. Previously sent untagged links cannot be measured retroactively.")}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <div className="min-w-[105px] rounded-xl border border-white/15 bg-white/[.035] px-3 py-2 text-end">
          <p className="text-[10px] text-white/55">{t("Total campaigns")}</p>
          <p className="text-xl font-bold tabular-nums text-[#edbc62]">{campaigns.length}</p>
        </div>
        <div className="min-w-[105px] rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/10 px-3 py-2 text-end">
          <p className="text-[10px] text-white/55">{t("Tracked visits")} · {days} {t("days")}</p>
          <p className="text-xl font-bold tabular-nums text-[#edbc62]">{totalVisits}</p>
        </div>
      </div>
    </div>

    <form onSubmit={e => void create(e)} className="mt-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-xs text-white/60">
        {t("Business / campaign name")}
        <input value={label} required maxLength={100}
          onChange={e => { const value=e.target.value; setLabel(value); setCode(toCode(value)); }}
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
      <button type="submit" disabled={creating || acting!==null || label.trim().length<2 || code.length<3}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#edbc62] px-4 text-xs font-bold text-black transition hover:bg-[#f4ca81] disabled:opacity-50">
        <Plus className="size-4"/>{creating?t("Creating…"):t("Create link")}
      </button>
    </form>
    {error?<p role="alert" className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>:null}
    {notice?<p role="status" className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">{notice}</p>:null}

    {campaigns.length===0?
      <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-xs text-white/50">{t("No tracked business links yet. Create a campaign above, then share its unique URL.")}</p>:
      <div className="admin-visitors-ranking-scroll mt-4 max-h-[360px] space-y-2 overflow-y-auto overscroll-y-contain pe-1 sm:max-h-[400px]" role="region" aria-label={t("Campaign tracking")} tabIndex={0}>
        {campaigns.map(c => <article key={c.code} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              {editing===c.code ? <form onSubmit={e=>{e.preventDefault();void saveEdit(c);}} className="min-w-0 space-y-2">
                <label className="block text-[11px] text-white/60">
                  {t("Business / campaign name")}
                  <input value={editLabel} required minLength={2} maxLength={100} autoFocus
                    onChange={e=>setEditLabel(e.target.value)}
                    className="mt-1 block min-h-9 w-full min-w-0 rounded-lg border border-[#edbc62]/45 bg-[#090b0e] px-3 text-sm text-white focus:outline-none"/>
                </label>
                <label className="block text-[11px] text-white/60">
                  {t("Tracking URL code")}
                  <input value={editCode} required minLength={3} maxLength={48} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                    onChange={e=>setEditCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}
                    className="mt-1 block min-h-9 w-full min-w-0 rounded-lg border border-[#edbc62]/45 bg-[#090b0e] px-3 font-mono text-xs text-white focus:outline-none"/>
                </label>
                <p className="break-all font-mono text-[11px] text-[#edbc62]/75">{campaignUrl(editCode)}</p>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <p role="status" aria-live="polite" className={`flex min-w-0 items-center gap-1.5 text-xs ${slugStatus==="available"?"text-emerald-300":slugStatus==="taken"||slugStatus==="invalid"||slugStatus==="error"?"text-rose-300":"text-white/50"}`}>
                    {slugStatus==="available"?<Check className="size-3.5"/>:slugStatus==="taken"?<X className="size-3.5"/>:null}
                    {t(({available:"URL available",taken:"This tracking URL is already used",invalid:"Invalid URL code",checking:"Checking URL availability…",error:"Could not verify URL availability",idle:"Checking URL availability…"} as const)[slugStatus])}
                  </p>
                  <div className="flex gap-2">
                    <button type="submit" disabled={acting!==null||slugStatus!=="available"||editLabel.trim().length<2} className={iconButton} title={t("Save changes")} aria-label={t("Save changes")}><Save className="size-4"/></button>
                    <button type="button" disabled={acting!==null} onClick={()=>setEditing(null)} className={iconButton} title={t("Cancel")} aria-label={t("Cancel")}><X className="size-4"/></button>
                  </div>
                </div>
              </form>:
              <div className="flex min-w-0 items-center gap-2">
                <strong className="min-w-0 break-words text-sm font-semibold text-white">{c.label}</strong>
                <span className="shrink-0 rounded-md bg-[#edbc62]/10 px-2 py-0.5 text-xs font-bold tabular-nums text-[#edbc62]">{c.sessions}</span>
              </div>}
              <a href={campaignUrl(c.public_code ?? c.code)} target="_blank" rel="noopener noreferrer"
                className="mt-2 block w-full break-all font-mono text-[11px] leading-5 text-white/60 underline-offset-2 hover:text-[#edbc62] hover:underline"
                title={t("Open campaign link")+" "+c.label}>
                {campaignUrl(c.public_code ?? c.code)}
              </a>
              <p className="mt-1 text-[10px] text-white/40">{c.last_visit?t("Last visit")+": "+new Date(c.last_visit).toLocaleDateString():t("No visits yet")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
              <button type="button" onClick={()=>void copy(c.public_code ?? c.code)} className={iconButton} title={t("Copy link")} aria-label={t("Copy link")+" "+c.label}>
                {copied===(c.public_code ?? c.code)?<Check className="size-4 text-emerald-300"/>:<Copy className="size-4"/>}
              </button>
              <a target="_blank" rel="noopener noreferrer" href={campaignUrl(c.public_code ?? c.code)} title={t("Open campaign link")}
                aria-label={t("Open campaign link")+" "+c.label} className={iconButton}><ExternalLink className="size-4"/></a>
              <button type="button" onClick={()=>startEdit(c)} disabled={acting!==null} className={iconButton} title={t("Edit campaign")} aria-label={t("Edit campaign")+" "+c.label}><Pencil className="size-4"/></button>
              <button type="button" onClick={()=>{setEditing(null);setConfirmDelete(c.code);setError("");}} disabled={acting!==null} className={iconButton+" hover:border-rose-400/50 hover:text-rose-300"} title={t("Delete campaign")} aria-label={t("Delete campaign")+" "+c.label}><Trash2 className="size-4"/></button>
            </div>
          </div>
          {confirmDelete===c.code?<div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/25 bg-rose-400/5 p-3" role="group" aria-label={t("Confirm deletion")}>
            <p className="min-w-0 flex-1 text-xs leading-5 text-rose-200">{t("Remove this campaign? Its link will stop tracking new visits. Historical analytics will stay saved.")}</p>
            <button type="button" disabled={acting!==null} onClick={()=>setConfirmDelete(null)} className="min-h-9 rounded-lg border border-white/15 px-3 text-xs font-medium text-white/80">{t("Cancel")}</button>
            <button type="button" disabled={acting!==null} onClick={()=>void deleteCampaign(c)} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-rose-500/80 px-3 text-xs font-semibold text-white disabled:opacity-50"><Trash2 className="size-3.5"/>{acting===c.code?t("Deleting…"):t("Confirm delete")}</button>
          </div>:null}
        </article>)}
      </div>
    }
    <p className="mt-3 text-[11px] leading-5 text-white/40">{t("Tracking is first-party and respects Do Not Track, Global Privacy Control and opt-outs. Campaign codes only are stored; no URL query strings, GPS or raw IP addresses.")}</p>
  </section>;
}
