"use client";

import { useCallback, useEffect, useState } from "react";
import { ArchiveRestore, ArrowRight, Check, Copy, Handshake, Plus, RefreshCcw, Save, Trash2, Wallet } from "lucide-react";
import { AffiliateAccountPicker, type AffiliateCandidate } from "@/components/admin/affiliate-account-picker";
import { Modal } from "@/components/ui/modal";
import { adminRequest } from "@/lib/admin";
import { useAdmin } from "@/components/admin/admin-shell";
import { useI18n } from "@/components/i18n/language-provider";

type Partner = {
  id: string; name: string; email: string; code: string; is_active: boolean; archived_at?: string|null; user_id?: string|null; account_role?: string|null; account_email?: string|null;
  rate_1_bps: number; rate_3_bps: number; rate_6_bps: number; rate_12_bps: number;
  businesses?: number; earned_centimes?: string; unpaid_centimes?: string;
};
type Commission = { subscription_event_id:string; business_name:string; duration_months:number; amount_centimes:number;rate_bps:number;commission_centimes:number;paid_at:string;payout_id:string|null };
type Business = { id:string;name:string;created_at:string;attributed_at:string;paid_orders:number;earned_centimes:string };
type Payout = {id:string;month:string;amount_centimes:number;method:string;reference:string;paid_at:string};
type Report = {affiliate:Partner;summary:{referred_businesses:number;paid_orders:number;total_centimes:string;unpaid_centimes:string;month_centimes:string};commissions:Commission[];businesses:Business[];payouts:Payout[];history:{month:string;orders:number;earned_centimes:string;unpaid_centimes:string}[]};
const panel = "admin-panel w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#101319] p-3.5 sm:p-5";
const field = "admin-field block w-full min-w-0 max-w-full rounded-xl border border-white/15 bg-[#0b0e12] px-3 py-2.5 text-sm text-white outline-none focus:border-[#efbd5d]/60";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#efbd5d] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#f7cd7d] disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-40";
const formatMoney=(value:number|string|undefined)=>new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD"}).format(Number(value??0)/100);
const formatDate=(value:string)=>new Date(value).toLocaleDateString("fr-MA",{year:"numeric",month:"short",day:"numeric",timeZone:"Africa/Casablanca"});
const initialRates={1:15,3:18,6:20,12:22};
type Rates=Record<"1"|"3"|"6"|"12",number>;
const fromPartner=(p:Partner):Rates=>({"1":p.rate_1_bps/100,"3":p.rate_3_bps/100,"6":p.rate_6_bps/100,"12":p.rate_12_bps/100});

export default function AdminAffiliatesPage(){
 const { token }=useAdmin();
 const {t:tr}=useI18n();
 const [partners,setPartners]=useState<Partner[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [linkEmail,setLinkEmail]=useState("");
 const [email,setEmail]=useState("");
 const [selectedCandidate,setSelectedCandidate]=useState<AffiliateCandidate|null>(null);
 const [showArchived,setShowArchived]=useState(false);
 const [pendingRemove,setPendingRemove]=useState<Partner|null>(null);
 const [confirmRemoveCode,setConfirmRemoveCode]=useState("");
 const [code,setCode]=useState("");
 const [createRates,setCreateRates]=useState<Rates>(initialRates);
 const [editRates,setEditRates]=useState<Rates>(initialRates);
 const [editName,setEditName]=useState("");
 const [tempPassword,setTempPassword]=useState("");
 const [payoutMonth,setPayoutMonth]=useState(new Date().toISOString().slice(0,7));
 const [payoutMethod,setPayoutMethod]=useState("Bank transfer");
 const [payoutReference,setPayoutReference]=useState("");
 const [copied,setCopied]=useState("");
 const load=useCallback(async ()=>{
  try { const res=await adminRequest<{data:Partner[]}>(`affiliates?archived=${showArchived}`,token);setPartners(res.data); }
  catch(e){setError(e instanceof Error?e.message:"Unable to load affiliates.");}
 },[token,showArchived]);
 const loadDetail=useCallback(async (id:string)=>{
  try{const res=await adminRequest<Report>(`affiliates/${id}`,token);setReport(res);setEditName(res.affiliate.name);setEditRates(fromPartner(res.affiliate));}
  catch(e){setError(e instanceof Error?e.message:"Unable to load affiliate.");}
 },[token]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(selected)void loadDetail(selected);else setReport(null);},[selected,loadDetail]);
 const referralUrl=(code:string)=>typeof window==="undefined"?"":`${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
 const affiliateUrl=(partner?:Partner)=>typeof window==="undefined"?"":`${window.location.origin}${partner?.account_role==="customer"?"/user/affiliate":partner?.account_role==="business_owner"?"/dashboard/affiliate":"/affiliate"}`;
 const copy=async(value:string,label:string)=>{
  try{await navigator.clipboard.writeText(value);setCopied(label);window.setTimeout(()=>setCopied(""),2000);}
  catch{setError("Could not copy. Select the text manually.");}
 };
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");setTempPassword("");
  try{
   const res=await adminRequest<{affiliate:Partner;linked_existing?:boolean;matched_business_contact?:boolean;resolved_login_email?:string}>("affiliates",token,{
    method:"POST",body:JSON.stringify({user_id:selectedCandidate?.id,user_email:email,code:code||undefined,rates:createRates})
   });
   setMessage(res.linked_existing?"Existing affiliate earnings preserved and account linked.":res.matched_business_contact?`Affiliate granted to the business owner account (${res.resolved_login_email}). Their login is different from the business contact email.`:"Affiliate permission granted to the existing account.");setEmail("");setCode("");setSelectedCandidate(null);
   await load();setSelected(res.affiliate.id);
  }catch(e){setError(e instanceof Error?e.message:"Could not create affiliate.");}
  finally{setBusy(false);}
 }
 async function removePartner(e:React.FormEvent){
  e.preventDefault();
  if(!pendingRemove || confirmRemoveCode!==pendingRemove.code || busy)return;
  setBusy(true);setError("");setMessage("");
  try {
    const result=await adminRequest<{message:string}>(`affiliates/${pendingRemove.id}`,token,{method:"DELETE"});
    setMessage(result.message);setPendingRemove(null);setConfirmRemoveCode("");
    setSelected(null);setReport(null);await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to remove affiliate.");}
  finally{setBusy(false);}
 }
 async function restorePartner(p:Partner){
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
    const result=await adminRequest<{message:string}>(`affiliates/${p.id}/restore`,token,{method:"POST"});
    setMessage(result.message);setSelected(null);await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to restore affiliate.");}
  finally{setBusy(false);}
 }
 async function save(isActive:boolean){
  if(!report)return;setBusy(true);setError("");setMessage("");
  try{
   await adminRequest(`affiliates/${report.affiliate.id}`,token,{method:"PATCH",body:JSON.stringify({name:editName,is_active:isActive,rates:editRates})});
   setMessage("Affiliate updated. Previous commission rates remain unchanged on recorded payments.");await Promise.all([load(),loadDetail(report.affiliate.id)]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to update affiliate.");}
  finally{setBusy(false);}
 }
 async function linkAccount(){
  if(!report || !linkEmail.trim())return;
  setBusy(true);setError("");setMessage("");
  try{
   await adminRequest(`affiliates/${report.affiliate.id}/link-account`,token,{method:"POST",body:JSON.stringify({user_email:linkEmail.trim()})});
   setMessage("Existing partner linked to the normal LOYVANCE account. All historical commissions and referrals are preserved.");
   setLinkEmail("");await Promise.all([load(),loadDetail(report.affiliate.id)]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to link account.");}
  finally{setBusy(false);}
 }
 async function resetPassword(){
  if(!report || !confirm("Generate a new temporary password? This immediately signs out the affiliate from all devices."))return;
  setBusy(true);setError("");setTempPassword("");
  try{
   const res=await adminRequest<{temporary_password:string}>(`affiliates/${report.affiliate.id}/reset-password`,token,{method:"POST"});
   setTempPassword(res.temporary_password);setMessage("Password reset. Securely share the one-time password with the partner.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to reset password.");}
  finally{setBusy(false);}
 }
 async function pay(){
  if(!report)return; if(!confirm(`Confirm you ALREADY sent payment for outstanding ${payoutMonth} commissions to ${report.affiliate.name}?`))return;
  setBusy(true);setError("");setMessage("");
  try{
   const res=await adminRequest<{payout:{amount_centimes:number}}>(`affiliates/${report.affiliate.id}/payouts`,token,{
    method:"POST",body:JSON.stringify({request_id:crypto.randomUUID(),month:payoutMonth,method:payoutMethod,reference:payoutReference})
   });
   setMessage(`${formatMoney(res.payout.amount_centimes)} recorded as paid. This does not transfer funds.`);setPayoutReference("");
   await Promise.all([load(),loadDetail(report.affiliate.id)]);
  }catch(e){setError(e instanceof Error?e.message:"Could not record payout.");}
  finally{setBusy(false);}
 }
 return <div className="admin-affiliates w-full min-w-0 max-w-full space-y-5 overflow-x-clip text-white sm:space-y-6">
  <header className="min-w-0"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#efbd5d] sm:text-xs sm:tracking-[.2em]">{tr("Partner program")}</p><h1 className="flex min-w-0 items-center gap-2.5 text-2xl font-semibold sm:gap-3 sm:text-3xl"><Handshake className="size-6 shrink-0 text-[#efbd5d] sm:size-7"/><span className="min-w-0 break-words">{tr("Affiliate partners")}</span></h1>
  <p className="mt-2 text-sm text-white/50">{tr("Referral links, confirmed subscriptions, commission earnings and monthly settlements.")}</p></header>
  {error&&<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{tr(error)}</p>}
  {message&&<p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}
  {tempPassword&&<section className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5"><h2 className="font-semibold text-amber-200">One-time login password — copy now</h2><p className="mt-1 text-xs text-white/60">For security this password is never displayed again. The affiliate should change it after login.</p><div className="mt-3 flex flex-wrap gap-2"><code className="break-all rounded-lg bg-black/40 px-4 py-3 text-amber-100">{tempPassword}</code><button className={secondary} onClick={()=>void copy(tempPassword,"password")}><Copy className="size-4"/>Copy password</button><button className={secondary} onClick={()=>void copy(affiliateUrl(),"portal")}>Copy legacy partner login</button></div></section>}
  <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,350px)_minmax(0,1fr)]">
   <div className="min-w-0 space-y-4 sm:space-y-5">
    <form onSubmit={e=>void create(e)} className={`${panel} space-y-4`}>
     <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4 text-[#efbd5d]"/> {tr("Grant affiliate access")}</h2>
     <AffiliateAccountPicker token={token} selected={selectedCandidate} onSelect={candidate=>{setSelectedCandidate(candidate);setEmail(candidate?.email||candidate?.business_email||"");}}/>
     <label className="block text-xs text-white/60">Or enter a login / business contact email manually
       <input type="email" className={`${field} mt-2`} placeholder="person@example.com" value={email} onChange={e=>{setEmail(e.target.value);setSelectedCandidate(null);}} required={!selectedCandidate}/>
     </label>
     <label className="block text-xs text-white/60">{tr("Custom referral code (optional)")}<input className={`${field} mt-2`} placeholder="mohamed-sales" pattern="[a-z0-9][a-z0-9-]{2,39}" value={code} onChange={e=>setCode(e.target.value.toLowerCase())}/></label>
     <p className="text-[11px] leading-5 text-white/45">{tr("Leave empty to generate a unique code automatically.")}</p>
     <RateFields rates={createRates} setRates={setCreateRates}/>
     <button className={`${primary} min-h-11 w-full min-w-0 px-2.5 text-center text-xs sm:px-4 sm:text-sm`} disabled={busy||(!selectedCandidate&&!email.trim())}><Plus className="size-4 shrink-0"/><span className="min-w-0 break-words">Grant Affiliate & generate link</span></button>
    </form>
    <section className={panel}>
     <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-semibold">{showArchived?"Archived partners":"All partners"} ({partners.length})</h2>
      <button type="button" aria-label="Reload partners" title="Refresh list" className={secondary} onClick={()=>void load()}><RefreshCcw className="size-4"/></button>
     </div>
     <button type="button" className="mb-4 text-xs font-medium text-[#efbd5d] underline-offset-4 hover:underline" onClick={()=>{setShowArchived(v=>!v);setSelected(null);setReport(null);}}>
       {showArchived?"Back to active partners":"View archived partners"}
     </button>
     {partners.length===0?<p className="text-xs text-white/45">{showArchived?"No archived partners.":"No active affiliate partners yet."}</p>:
     <div className="space-y-2">{partners.map(p=>
       <div key={p.id} className={`flex min-w-0 items-stretch gap-1 rounded-xl border p-1 transition ${selected===p.id?"border-[#efbd5d]/40 bg-[#efbd5d]/10":"border-white/10 hover:border-white/25"}`}>
        <button type="button" onClick={()=>{setSelected(p.id);setTempPassword("");setMessage("");}} className="min-w-0 flex-1 rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efbd5d]/70">
         <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{p.name}</span>
          <span className={`shrink-0 text-[11px] ${p.archived_at?"text-amber-300":p.is_active?"text-emerald-400":"text-rose-300"}`}>{p.archived_at?"Archived":p.is_active?"Active":"Paused"}</span>
         </div>
         <p className="mt-1 truncate text-xs text-white/45">{p.code} · {p.businesses} businesses · {p.account_role?p.account_role==="customer"?"Customer":"Business":"Legacy"}</p>
         <p className="mt-2 text-xs text-[#efbd5d]">Outstanding: {formatMoney(p.unpaid_centimes)}</p>
        </button>
        <button type="button" disabled={busy} title={p.archived_at?"Restore affiliate":"Remove affiliate"} aria-label={p.archived_at?`Restore ${p.name}`:`Remove ${p.name}`}
          onClick={()=>{if(p.archived_at){void restorePartner(p);}else{setPendingRemove(p);setConfirmRemoveCode("");}}}
          className={`my-auto grid size-10 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efbd5d] disabled:opacity-40 ${p.archived_at?"border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10":"border-rose-400/20 text-rose-300 hover:bg-rose-400/10"}`}>
          {p.archived_at?<ArchiveRestore className="size-4" aria-hidden="true"/>:<Trash2 className="size-4" aria-hidden="true"/>}
        </button>
       </div>)}</div>}
    </section>
   </div>
   <div className="min-w-0 space-y-4 sm:space-y-5">
    {!report?<section className={`${panel} flex min-h-56 items-center justify-center text-sm text-white/45`}>Select a partner to inspect their business referrals and earnings.</section>:<>
     <section className={panel}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 sm:gap-4"><div className="min-w-0 max-w-full"><h2 className="break-words text-xl font-semibold sm:text-2xl">{report.affiliate.name}</h2><p className="mt-1 break-all text-xs leading-5 text-white/45 sm:text-sm">{report.affiliate.account_email||report.affiliate.email} · {report.affiliate.account_role||"Not linked to a platform account"}</p></div><span className="max-w-full break-all rounded-lg border border-[#efbd5d]/30 bg-[#efbd5d]/10 px-3 py-1 text-xs text-[#efbd5d]">{report.affiliate.code}</span></div>
      <p className="mt-5 text-xs text-white/50">Business referral link</p><div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row"><input readOnly value={referralUrl(report.affiliate.code)} aria-label="Referral link" className={`${field} min-w-0 sm:flex-1`}/><button className={`${secondary} min-h-10 w-full sm:w-auto`} onClick={()=>void copy(referralUrl(report.affiliate.code),"ref")}><Copy className="size-4 shrink-0"/>{copied==="ref"?"Copied":"Copy"}</button></div>
      <div className="mt-2 flex min-w-0 gap-2"><button className={`${secondary} w-full min-w-0 text-xs sm:w-auto sm:text-sm`} onClick={()=>void copy(affiliateUrl(report.affiliate),"portal")}><ArrowRight className="size-4 shrink-0"/><span className="min-w-0 break-words">Copy partner dashboard URL</span></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Referred businesses" value={String(report.summary.referred_businesses)}/><Mini label="Earned total" value={formatMoney(report.summary.total_centimes)}/><Mini label="Unpaid balance" value={formatMoney(report.summary.unpaid_centimes)}/></div>
     </section>
     <section className={panel}><h3 className="mb-4 text-lg font-semibold">Partner settings</h3><label className="text-xs text-white/60">Display name<input className={`${field} mt-2 mb-4`} value={editName} onChange={e=>setEditName(e.target.value)}/></label><RateFields rates={editRates} setRates={setEditRates}/><div className="mt-4 flex min-w-0 flex-wrap gap-2"><button className={`${primary} min-w-0 flex-1 text-xs sm:flex-none sm:text-sm`} disabled={busy||Boolean(report.affiliate.archived_at)} onClick={()=>void save(report.affiliate.is_active)}><Save className="size-4"/>Save changes</button><button className={`${secondary} min-w-0 flex-1 text-xs sm:flex-none sm:text-sm`} disabled={busy||Boolean(report.affiliate.archived_at)} onClick={()=>void save(!report.affiliate.is_active)}>{report.affiliate.is_active?"Pause partner":"Reactivate partner"}</button><button type="button" disabled={busy} title={report.affiliate.archived_at?"Restore affiliate":"Remove affiliate"} aria-label={report.affiliate.archived_at?"Restore affiliate":"Remove affiliate"} onClick={()=>{if(report.affiliate.archived_at){void restorePartner(report.affiliate);}else{setPendingRemove(report.affiliate);setConfirmRemoveCode("");}}} className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/5 text-rose-300 transition hover:bg-rose-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efbd5d] disabled:opacity-40">{report.affiliate.archived_at?<ArchiveRestore className="size-4"/>:<Trash2 className="size-4"/>}</button></div>{!report.affiliate.user_id?<div className="mt-4 space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="text-sm font-semibold text-amber-200">Link this existing affiliate to a normal account</p><p className="text-xs text-white/55">Preserves all previous referrals, commissions and payouts. The account must register in LOYVANCE first.</p><input type="email" value={linkEmail} onChange={e=>setLinkEmail(e.target.value)} placeholder="Registered LOYVANCE email" aria-label="Account email to link" className={field}/><button className={primary} disabled={busy||!linkEmail.trim()} onClick={()=>void linkAccount()}>Grant access to account</button><button className={secondary} disabled={busy} onClick={()=>void resetPassword()}>Reset legacy portal password</button></div>:<p className="mt-3 text-xs text-emerald-300">Linked account · Sign in normally using the original customer or business password.</p>}<p className="mt-3 text-xs text-white/40">Pausing prevents new referrals, login and future commission accrual. Existing earnings stay in the ledger.</p></section>
     <section className={panel}><h3 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Wallet className="size-5 text-[#efbd5d]"/>Record monthly payout</h3><p className="mb-4 text-xs text-white/45">Only mark paid after you really transfer the money. Unpaid commissions for the selected Morocco month are settled together.</p>
       <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-white/60">Commission month<input type="month" className={`${field} mt-2`} value={payoutMonth} onChange={e=>setPayoutMonth(e.target.value)}/></label><label className="text-xs text-white/60">Payment method<input className={`${field} mt-2`} value={payoutMethod} onChange={e=>setPayoutMethod(e.target.value)} placeholder="Bank transfer"/></label><label className="text-xs text-white/60">Transfer reference<input className={`${field} mt-2`} value={payoutReference} onChange={e=>setPayoutReference(e.target.value)} placeholder="Transaction ID"/></label></div><button className={`${primary} mt-4 min-h-11 w-full min-w-0 px-2 text-xs sm:w-auto sm:px-4 sm:text-sm`} disabled={busy||!payoutReference.trim()} onClick={()=>void pay()}><Check className="size-4 shrink-0"/><span className="min-w-0 break-words">Confirm money sent & record payout</span></button>
      
      <div className="mt-5 space-y-2 md:hidden">
       {report.payouts.map(p=><article key={p.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><p className="text-xs font-semibold text-white/85">{formatDate(p.paid_at)}</p><p className="text-sm font-semibold text-[#efbd5d]">{formatMoney(p.amount_centimes)}</p></div>
        <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-xs min-[350px]:grid-cols-2"><div className="min-w-0"><dt className="text-white/40">Commission month</dt><dd className="mt-1 break-words">{p.month}</dd></div><div className="min-w-0"><dt className="text-white/40">Transfer reference</dt><dd className="mt-1 break-all">{p.reference}</dd></div></dl>
       </article>)}
       {!report.payouts.length&&<p className="py-4 text-xs text-white/45">No payouts recorded yet.</p>}
      </div>
<div className="mt-5 hidden min-w-0 max-w-full overflow-x-auto md:block"><table className="w-full min-w-[410px] text-left text-xs"><thead><tr className="text-white/40"><th className="py-2">Paid date</th><th>Month</th><th>Amount</th><th>Reference</th></tr></thead><tbody>{report.payouts.map(p=><tr className="border-t border-white/10" key={p.id}><td className="py-2">{formatDate(p.paid_at)}</td><td>{p.month}</td><td>{formatMoney(p.amount_centimes)}</td><td className="max-w-52 break-all">{p.reference}</td></tr>)}</tbody></table></div>
     </section>
     <section className={panel}><h3 className="mb-4 text-lg font-semibold">Businesses brought by this partner</h3>
      <div className="space-y-2 md:hidden">
       {report.businesses.map(b=><article key={b.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="break-words text-sm font-semibold">{b.name}</p>
        <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 text-xs"><div className="min-w-0"><dt className="text-white/40">Joined</dt><dd className="mt-1 break-words">{formatDate(b.attributed_at)}</dd></div><div className="min-w-0"><dt className="text-white/40">Paid orders</dt><dd className="mt-1 font-medium">{b.paid_orders}</dd></div><div className="col-span-2 min-w-0"><dt className="text-white/40">Commissions</dt><dd className="mt-1 break-words font-semibold text-[#efbd5d]">{formatMoney(b.earned_centimes)}</dd></div></dl>
       </article>)}
       {!report.businesses.length&&<p className="py-4 text-xs text-white/45">No referred businesses yet.</p>}
      </div>
<div className="hidden min-w-0 max-w-full overflow-x-auto md:block"><table className="w-full min-w-[470px] text-left text-xs"><thead><tr className="text-white/40"><th className="py-2">Business</th><th>Joined</th><th>Paid orders</th><th>Commissions</th></tr></thead><tbody>{report.businesses.map(b=><tr key={b.id} className="border-t border-white/10"><td className="max-w-52 break-words py-3 font-semibold">{b.name}</td><td>{formatDate(b.attributed_at)}</td><td>{b.paid_orders}</td><td>{formatMoney(b.earned_centimes)}</td></tr>)}</tbody></table>{!report.businesses.length&&<p className="py-5 text-sm text-white/35">No referred businesses yet.</p>}</div></section>
     <section className={panel}><h3 className="mb-4 text-lg font-semibold">Confirmed payment commissions</h3>
      <div className="space-y-2 md:hidden">
       {report.commissions.map(c=><article key={c.subscription_event_id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{c.business_name}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${c.payout_id?"bg-emerald-400/10 text-emerald-300":"bg-amber-400/10 text-amber-300"}`}>{c.payout_id?"Paid":"Unpaid"}</span></div>
        <p className="mt-1 text-[11px] text-white/45">{formatDate(c.paid_at)}</p>
        <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 text-xs"><div className="min-w-0"><dt className="text-white/40">Plan</dt><dd className="mt-1">{c.duration_months} months</dd></div><div className="min-w-0"><dt className="text-white/40">Rate</dt><dd className="mt-1">{c.rate_bps/100}%</dd></div><div className="min-w-0"><dt className="text-white/40">Received</dt><dd className="mt-1 break-words">{formatMoney(c.amount_centimes)}</dd></div><div className="min-w-0"><dt className="text-white/40">Commission</dt><dd className="mt-1 break-words font-semibold text-[#efbd5d]">{formatMoney(c.commission_centimes)}</dd></div></dl>
       </article>)}
       {!report.commissions.length&&<p className="py-4 text-xs text-white/45">No confirmed paid subscriptions yet.</p>}
      </div>
<div className="hidden min-w-0 max-w-full overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="text-white/40"><th className="py-2">Payment date</th><th>Business</th><th>Plan</th><th>Received</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>{report.commissions.map(c=><tr className="border-t border-white/10" key={c.subscription_event_id}><td className="py-3">{formatDate(c.paid_at)}</td><td className="max-w-48 break-words">{c.business_name}</td><td>{c.duration_months} mo.</td><td>{formatMoney(c.amount_centimes)}</td><td>{c.rate_bps/100}%</td><td className="font-semibold text-[#efbd5d]">{formatMoney(c.commission_centimes)}</td><td className={c.payout_id?"text-emerald-300":"text-amber-300"}>{c.payout_id?"Paid":"Unpaid"}</td></tr>)}</tbody></table>{!report.commissions.length&&<p className="py-5 text-sm text-white/35">No confirmed paid subscriptions yet.</p>}</div></section>
    </>}
   </div>
  </div>
  <Modal isOpen={!!pendingRemove} onClose={()=>{if(!busy){setPendingRemove(null);setConfirmRemoveCode("");}}} closeDisabled={busy}
    title="Remove affiliate partner" description={pendingRemove?.name} icon={<Trash2 className="size-6 text-rose-300"/>}>
    <form className="space-y-4" onSubmit={e=>void removePartner(e)}>
      <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs leading-6 text-white/70">
        Removing a partner immediately disables their referral link and affiliate dashboard. The profile disappears from the active list. Businesses, payment commissions, pending earnings and payout history remain securely recorded in Archived partners. Their normal LOYVANCE account stays active.
      </p>
      <label className="block text-xs font-medium text-white/70">
        Type the referral code <strong className="text-[#efbd5d]">{pendingRemove?.code}</strong> to confirm
        <input autoComplete="off" spellCheck={false} className={`${field} mt-2`} value={confirmRemoveCode} onChange={e=>setConfirmRemoveCode(e.target.value)}/>
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={secondary} disabled={busy} onClick={()=>{setPendingRemove(null);setConfirmRemoveCode("");}}>Cancel</button>
        <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40" disabled={busy||!pendingRemove||confirmRemoveCode!==pendingRemove.code}>
          <Trash2 className="size-4"/>Remove affiliate
        </button>
      </div>
    </form>
  </Modal>
 </div>;
}
function Mini({label,value}:{label:string;value:string}){return <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/45">{label}</p><p className="mt-2 break-all text-xl font-semibold text-[#efbd5d]">{value}</p></div>;}
function RateFields({rates,setRates}:{rates:Rates;setRates:(value:Rates)=>void}){
 return <fieldset><legend className="mb-2 text-xs font-semibold text-white/65">Commission rates by subscription (%)</legend><div className="grid min-w-0 grid-cols-1 gap-3 min-[340px]:grid-cols-2">{(["1","3","6","12"] as const).map(m=><label key={m} className="block min-w-0 text-xs text-white/50">{m==="12"?"1 year":`${m} month${m==="1"?"":"s"}`}<input className={`${field} mt-1`} type="number" min="0" max="50" step="0.01" value={rates[m]} onChange={e=>setRates({...rates,[m]:Number(e.target.value)})}/></label>)}</div></fieldset>;
}
