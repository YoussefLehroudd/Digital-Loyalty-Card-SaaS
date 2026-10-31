"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/admin-shell";
import { adminRequest } from "@/lib/admin";
import { OutreachSendQueue } from "@/components/admin/outreach-send-queue";
import { Check, CheckCheck, ChevronLeft, ChevronRight, Clock3, Copy, Eye, Filter, Mail, MailCheck, RefreshCw, Search, ShieldAlert, Trash2, X } from "lucide-react";

type Status = "prepared" | "sending" | "sent" | "delivered" | "failed" | "bounced" | "blocked" | "unsubscribed";
type OutreachRow = {
  campaign_code: string; business_name: string; contact_name: string | null; contact_email: string;
  business_city: string | null; sender_email: string; email_subject: string | null;
  email_body?: string | null; status: Status; consent_status: string; consent_source?: string | null;
  sent_at: string | null; delivered_at: string | null; failed_at?: string | null; error: string | null;
  created_at: string; content_origin: string; provider_message_id: string | null;
  provider?: string | null; public_code: string; visits?: number; source_url?: string | null;
};
type ListResponse = { data: OutreachRow[]; total: number; page: number; per_page: number; stats: Record<string, number>; ready_to_send: number; configured: boolean; configured_sender: string | null };
type DetailResponse = { data: OutreachRow };
const base = "https://loyvance.vercel.app/?ref=";
const panel = "rounded-2xl border border-white/10 bg-[#101318]";
const button = "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-white/75 transition hover:border-[#edbc62]/50 hover:text-[#edbc62] disabled:cursor-not-allowed disabled:opacity-40";
const input = "w-full min-w-0 rounded-xl border border-white/15 bg-[#090b0e] px-3 py-2.5 text-sm text-white outline-none focus:border-[#edbc62]";
const statusColors: Record<Status, string> = {
  prepared: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  sending: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  sent: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  delivered: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  failed: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  bounced: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  blocked: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  unsubscribed: "border-purple-400/25 bg-purple-400/10 text-purple-200"
};
const statusText: Record<Status, string> = {
  prepared: "Not sent", sending: "Sending", sent: "Accepted by provider", delivered: "Delivered",
  failed: "Failed", bounced: "Bounced", blocked: "Blocked", unsubscribed: "Opted out"
};
function Stamp({ status }: {status: Status}) {
  return <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold " + (statusColors[status] || statusColors.prepared)}>
    {status === "delivered" ? <CheckCheck className="size-3.5"/> : status === "sent" ? <Check className="size-3.5"/> : status === "sending" ? <Clock3 className="size-3.5 animate-pulse"/> : null}
    {statusText[status] || status}
  </span>;
}
function when(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "—"; }

export default function AdminOutreachPage() {
  const { token } = useAdmin();
  const [rows, setRows] = useState<OutreachRow[]>([]);
  const [counts, setCounts] = useState<Record<string,number>>({});
  const [total,setTotal] = useState(0);
  const [readyToSend,setReadyToSend] = useState(0);
  const [configured,setConfigured] = useState(false);
  const [configuredSender,setConfiguredSender] = useState<string|null>(null);
  const [page,setPage] = useState(1);
  const [filter,setFilter] = useState("all");
  const [query,setQuery] = useState("");
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [detail,setDetail] = useState<OutreachRow|null>(null);
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState({ contact_name: "", email_subject: "", email_body: "", consent_status: "unverified", consent_source: "" });
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [deleteAll,setDeleteAll] = useState(false);
  const [deleteAllText,setDeleteAllText] = useState("");
  const load = useCallback(async (signal?:AbortSignal) => {
    try {
      const data = await adminRequest<ListResponse>("outreach?page="+page+"&status="+encodeURIComponent(filter)+"&q="+encodeURIComponent(search), token, { signal, cache:"no-store" });
      if(signal?.aborted)return;
      setRows(data.data);
      setTotal(data.total);
      setCounts(data.stats);
      setReadyToSend(data.ready_to_send);
      setConfigured(data.configured);
      setConfiguredSender(data.configured_sender);
      setError("");
    } catch (e) {
      if(!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load outreach.");
    } finally {
      if(!signal?.aborted) setLoading(false);
    }
  },[token,page,filter,search]);
  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal);
    const id=window.setInterval(()=>{ if(!document.hidden && !busy)void load(controller.signal); },5000);
    return ()=>{controller.abort();window.clearInterval(id);};
  },[load,busy]);
  useEffect(()=>{const id=window.setTimeout(()=>{setPage(1);setSearch(query);},350);return()=>window.clearTimeout(id);},[query]);
  const totalPages=Math.max(1,Math.ceil(total/25));
  const totalAll=Object.values(counts).reduce((a,b)=>a+b,0);
  async function openRow(code:string) {
    setError("");setEditing(false);setDetail(null);
    try {
      const response=await adminRequest<DetailResponse>("outreach/"+encodeURIComponent(code),token,{cache:"no-store"});
      setDetail(response.data);
      setDraft({contact_name: response.data.contact_name || "",email_subject: response.data.email_subject || "",
        email_body: response.data.email_body || "",consent_status:response.data.consent_status || "unverified",consent_source:response.data.consent_source || ""});
    } catch(e){setError(e instanceof Error?e.message:"Could not open the message.");}
  }
  async function save() {
    if(!detail || busy)return;
    setBusy(true);setError("");setNotice("");
    try {
      await adminRequest("outreach/"+encodeURIComponent(detail.campaign_code),token,{method:"PATCH",body:JSON.stringify(draft)});
      setNotice("Message and consent details saved.");
      setEditing(false);await openRow(detail.campaign_code);await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save.");}
    finally{setBusy(false);}
  }
  async function remove(code:string) {
    if(busy||!window.confirm("Remove this outreach record? Historical tracking will be preserved."))return;
    setBusy(true);
    try{await adminRequest("outreach/"+encodeURIComponent(code),token,{method:"DELETE"});setDetail(null);setNotice("Record removed. Tracking data preserved.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Deletion failed.");}
    finally{setBusy(false);}
  }
  async function removeAll() {
    if(busy||deleteAllText!=="DELETE ALL")return;
    setBusy(true);setError("");
    try{const result=await adminRequest<{deleted:number}>("outreach",token,{method:"DELETE",body:JSON.stringify({confirm:deleteAllText})});setDeleteAll(false);setDetail(null);setNotice(result.deleted+" records hidden; tracking visits remain intact.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Could not delete records.");}
    finally{setBusy(false);}
  }
  async function copy(url:string){try{await navigator.clipboard.writeText(url);setNotice("Link copied.");}catch{setError("Clipboard unavailable.");}}
  return <div className="min-w-0 space-y-5 text-white">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#edbc62]">Campaign tracking / Outreach</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold sm:text-3xl"><Mail className="size-7 text-[#edbc62]"/>Outreach Inbox</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">Review business contacts, unique tracking URLs and saved emails. Sending requires documented permission. Status refreshes every 5 seconds.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={()=>void load()} className={button}><RefreshCw className="size-4"/>Refresh</button>
        <button type="button" onClick={()=>{setDeleteAll(true);setDeleteAllText("");}} className={button+" hover:!border-rose-400/50 hover:!text-rose-300"}><Trash2 className="size-4"/>Delete all</button>
      </div>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        {name:"All contacts",value:totalAll,icon:Mail},
        {name:"Not sent",value:counts.prepared||0,icon:Clock3},
        {name:"Accepted / delivered",value:(counts.sent||0)+(counts.delivered||0),icon:MailCheck},
        {name:"Blocked / failed / bounced",value:(counts.blocked||0)+(counts.failed||0)+(counts.bounced||0),icon:ShieldAlert}
      ].map(s=><div key={s.name} className={panel+" p-4"}><div className="flex justify-between gap-2 text-xs text-white/50"><span>{s.name}</span><s.icon className="size-4 text-[#edbc62]"/></div><p className="mt-3 text-2xl font-bold">{s.value.toLocaleString()}</p></div>)}
    </div>
    <div className={panel+" space-y-3 p-4"}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
        <ShieldAlert className="size-4 text-[#edbc62]"/>
        {configured?"Verified sender configured: "+configuredSender:"Sending inactive: configure RESEND_API_KEY and a verified OUTREACH_FROM_EMAIL. Draft previews and tracking still work."}
      </div>
      <p className="text-xs leading-5 text-white/45">Previously sent Gmail messages are marked as accepted, not confirmed delivered. Delivery is shown only when the email provider confirms it. Never re-send blocked or opted-out emails.</p>
    </div>
    {error?<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>:null}
    {notice?<p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>:null}
    <OutreachSendQueue token={token} ready={readyToSend} unsent={counts.prepared||0} configured={configured} sender={configuredSender} onProgress={()=>{void load();}}/>
    <section className={panel+" p-3 sm:p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[190px] flex-1"><Search className="absolute left-3 top-3 size-4 text-white/40"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search business, email, tracking code..." aria-label="Search outreach" className={input+" ps-9"}/></label>
        <label className="flex items-center gap-2 text-xs text-white/60"><Filter className="size-4"/><select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}} aria-label="Filter status" className={input}>
          {["all","prepared","sending","sent","delivered","failed","bounced","blocked","unsubscribed"].map(x=><option value={x} key={x}>{x==="all"?"All statuses":x==="prepared"?"Not sent":statusText[x as Status]}</option>)}
        </select></label>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead className="border-b border-white/10 text-white/45"><tr><th className="p-3">Business</th><th className="p-3">Email / sender</th><th className="p-3">Status</th><th className="p-3">Campaign</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.campaign_code} className="border-b border-white/[.06] hover:bg-white/[.025]">
            <td className="p-3"><p className="font-semibold">{r.business_name}</p><p className="mt-1 text-white/40">{r.business_city||"—"}{r.contact_name?" · "+r.contact_name:""}</p></td>
            <td className="p-3"><p className="break-all text-[#edbc62]">{r.contact_email}</p><p className="mt-1 break-all text-white/35">From: {r.sender_email}</p></td>
            <td className="p-3"><Stamp status={r.status}/><p className="mt-1 text-[10px] text-white/40">Consent: {r.consent_status}</p></td>
            <td className="p-3"><p className="font-mono text-white/70">{r.public_code}</p><p className="mt-1 text-white/40">{r.visits||0} sessions</p></td>
            <td className="p-3"><div className="flex gap-2"><button type="button" onClick={()=>void openRow(r.campaign_code)} className={button} title="View message"><Eye className="size-4"/>Details</button><button type="button" disabled={busy} onClick={()=>void remove(r.campaign_code)} className={button} aria-label={"Delete "+r.business_name}><Trash2 className="size-4"/></button></div></td>
          </tr>)}</tbody>
        </table>
        {loading&&!rows.length?<p className="p-8 text-center text-white/50">Loading outreach...</p>:!rows.length?<p className="p-8 text-center text-white/50">No matching contacts.</p>:null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-white/50"><span>{total} matching records · page {page} of {totalPages}</span><div className="flex gap-2">
        <button aria-label="Previous page" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className={button}><ChevronLeft className="size-4"/></button>
        <button aria-label="Next page" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className={button}><ChevronRight className="size-4"/></button></div></div>
    </section>
    {detail?<div className="fixed inset-0 z-[100] flex justify-end bg-black/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Outreach message details">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#101318] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0"><p className="text-[11px] uppercase tracking-widest text-[#edbc62]">Message details</p><h2 className="mt-1 break-words text-xl font-semibold">{detail.business_name}</h2><p className="mt-1 break-all text-xs text-white/45">{detail.campaign_code}</p></div>
          <button type="button" onClick={()=>setDetail(null)} aria-label="Close" className={button}><X className="size-4"/></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <Stamp status={detail.status}/>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            {[
              ["Business",detail.business_name],["Contact",detail.contact_name||"Not provided"],
              ["Recipient",detail.contact_email],["Sender",detail.sender_email],
              ["Sent",when(detail.sent_at)],["Delivered",when(detail.delivered_at)],
              ["Provider ID",detail.provider_message_id||"—"],["Content",detail.content_origin]
            ].map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-white/[.03] p-3"><dt className="text-white/40">{label}</dt><dd className="mt-1 break-all font-medium text-white/85">{value}</dd></div>)}
          </dl>
          {detail.error?<p className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300">{detail.error}</p>:null}
          {detail.content_origin==="reconstructed_historical"?<p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">Historical Gmail content was reconstructed from the outreach template; this is not an exact Gmail archive copy.</p>:null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>void copy(base+encodeURIComponent(detail.public_code))} className={button}><Copy className="size-4"/>Copy tracking URL</button>
            <a href={base+encodeURIComponent(detail.public_code)} target="_blank" rel="noreferrer" className={button}>Open tracking link</a>
          </div>
          <p className="break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-[#edbc62]">{base+encodeURIComponent(detail.public_code)}</p>
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Saved email</h3>{["prepared","failed","blocked","unsubscribed"].includes(detail.status)?<button type="button" onClick={()=>setEditing(v=>!v)} className={button}>{editing?"Cancel edit":"Edit details"}</button>:null}</div>
          {editing?<div className="space-y-3">
            <label className="block text-xs text-white/60">Contact name<input value={draft.contact_name} onChange={e=>setDraft(v=>({...v,contact_name:e.target.value}))} className={input+" mt-1"}/></label>
            <label className="block text-xs text-white/60">Subject<input value={draft.email_subject} onChange={e=>setDraft(v=>({...v,email_subject:e.target.value}))} className={input+" mt-1"}/></label>
            <label className="block text-xs text-white/60">Message<textarea rows={12} value={draft.email_body} onChange={e=>setDraft(v=>({...v,email_body:e.target.value}))} className={input+" mt-1 resize-y"}/></label>
            <label className="block text-xs text-white/60">Contact permission<select value={draft.consent_status} onChange={e=>setDraft(v=>({...v,consent_status:e.target.value}))} className={input+" mt-1"}>
              <option value="unverified">Not verified — no sending</option><option value="opted_in">Opted in (evidence required)</option><option value="unsubscribed">Opted out</option>
            </select></label>
            <label className="block text-xs text-white/60">Consent evidence (business request, signup source or other proof)<input value={draft.consent_source} onChange={e=>setDraft(v=>({...v,consent_source:e.target.value}))} className={input+" mt-1"} placeholder="e.g. demo form reference and date"/></label>
            <button type="button" onClick={()=>void save()} disabled={busy} className="rounded-xl bg-[#edbc62] px-5 py-2.5 text-xs font-bold text-black disabled:opacity-40">Save message</button>
          </div>:<div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Subject</p><p className="break-words text-sm font-semibold">{detail.email_subject||"Not prepared"}</p>
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-white/40">Body</p><p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/80">{detail.email_body||"No email content stored."}</p>
          </div>}
        </div>
      </div>
    </div>:null}
    {deleteAll?<div className="fixed inset-0 z-[110] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Delete all outreach records">
      <div className={panel+" w-full max-w-md p-6"}><h2 className="text-lg font-semibold text-rose-300">Delete all outreach contacts?</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">This hides ALL outreach contact records, including saved messages. Tracking campaigns and historical analytics remain. This action cannot be undone from this panel.</p>
        <label className="mt-4 block text-xs text-white/60">Type DELETE ALL to confirm<input value={deleteAllText} onChange={e=>setDeleteAllText(e.target.value)} className={input+" mt-2"} placeholder="DELETE ALL"/></label>
        <div className="mt-5 flex justify-end gap-2"><button type="button" className={button} onClick={()=>setDeleteAll(false)}>Cancel</button>
          <button type="button" disabled={busy||deleteAllText!=="DELETE ALL"} onClick={()=>void removeAll()} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Delete all</button>
        </div>
      </div>
    </div>:null}
  </div>;
}
