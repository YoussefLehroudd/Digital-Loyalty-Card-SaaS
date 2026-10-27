"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Handshake, Loader2, Plus, RefreshCcw, Save, Wallet } from "lucide-react";
import { adminRequest } from "@/lib/admin";
import { useAdmin } from "@/components/admin/admin-shell";
import { useI18n } from "@/components/i18n/language-provider";

type Partner = {
  id: string; name: string; email: string; code: string; is_active: boolean; user_id?: string|null; account_role?: string|null; account_email?: string|null;
  rate_1_bps: number; rate_3_bps: number; rate_6_bps: number; rate_12_bps: number;
  businesses?: number; earned_centimes?: string; unpaid_centimes?: string;
};
type Commission = { subscription_event_id:string; business_name:string; duration_months:number; amount_centimes:number;rate_bps:number;commission_centimes:number;paid_at:string;payout_id:string|null };
type Business = { id:string;name:string;created_at:string;attributed_at:string;paid_orders:number;earned_centimes:string };
type Payout = {id:string;month:string;amount_centimes:number;method:string;reference:string;paid_at:string};
type Report = {affiliate:Partner;summary:{referred_businesses:number;paid_orders:number;total_centimes:string;unpaid_centimes:string;month_centimes:string};commissions:Commission[];businesses:Business[];payouts:Payout[];history:{month:string;orders:number;earned_centimes:string;unpaid_centimes:string}[]};
const panel = "rounded-2xl border border-white/10 bg-[#101319] p-5";
const field = "w-full rounded-xl border border-white/15 bg-[#0b0e12] px-3 py-2.5 text-sm text-white outline-none focus:border-[#efbd5d]/60";
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
  try { const res=await adminRequest<{data:Partner[]}>("affiliates",token);setPartners(res.data); }
  catch(e){setError(e instanceof Error?e.message:"Unable to load affiliates.");}
 },[token]);
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
   const res=await adminRequest<{affiliate:Partner;linked_existing?:boolean}>("affiliates",token,{
    method:"POST",body:JSON.stringify({user_email:email,code:code||undefined,rates:createRates})
   });
   setMessage(res.linked_existing?"Existing affiliate earnings preserved and account linked.":"Affiliate permission granted to the existing account.");setEmail("");setCode("");
   await load();setSelected(res.affiliate.id);
  }catch(e){setError(e instanceof Error?e.message:"Could not create affiliate.");}
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
 return <div className="space-y-6 text-white">
  <header><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#efbd5d]">{tr("Partner program")}</p><h1 className="flex items-center gap-3 text-3xl font-semibold"><Handshake className="size-7 text-[#efbd5d]"/>{tr("Affiliate partners")}</h1>
  <p className="mt-2 text-sm text-white/50">{tr("Referral links, confirmed subscriptions, commission earnings and monthly settlements.")}</p></header>
  {error&&<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
  {message&&<p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p>}
  {tempPassword&&<section className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5"><h2 className="font-semibold text-amber-200">One-time login password — copy now</h2><p className="mt-1 text-xs text-white/60">For security this password is never displayed again. The affiliate should change it after login.</p><div className="mt-3 flex flex-wrap gap-2"><code className="break-all rounded-lg bg-black/40 px-4 py-3 text-amber-100">{tempPassword}</code><button className={secondary} onClick={()=>void copy(tempPassword,"password")}><Copy className="size-4"/>Copy password</button><button className={secondary} onClick={()=>void copy(affiliateUrl(),"portal")}>Copy legacy partner login</button></div></section>}
  <div className="grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
   <div className="space-y-5">
    <form onSubmit={e=>void create(e)} className={`${panel} space-y-4`}>
     <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4 text-[#efbd5d]"/> {tr("Grant affiliate access")}</h2>
     <p className="text-xs leading-5 text-white/50">The person first creates a normal Business or Customer account. Enter their registered email to unlock Affiliate inside their own workspace. Their normal role, data and password stay unchanged.</p>
     <label className="block text-xs text-white/60">Existing LOYVANCE account email<input type="email" className={`${field} mt-2`} placeholder="person@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
     <label className="block text-xs text-white/60">Custom referral code (optional)<input className={`${field} mt-2`} placeholder="mohamed-sales" pattern="[a-z0-9][a-z0-9-]{2,39}" value={code} onChange={e=>setCode(e.target.value.toLowerCase())}/></label>
     <RateFields rates={createRates} setRates={setCreateRates}/>
     <button className={`${primary} w-full`} disabled={busy}><Plus className="size-4"/>Grant Affiliate & generate link</button>
    </form>
    <section className={panel}>
     <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">All partners ({partners.length})</h2><button aria-label="Reload partners" className={secondary} onClick={()=>void load()}><RefreshCcw className="size-4"/></button></div>
     {partners.length===0?<p className="text-xs text-white/45">No affiliate partners yet.</p>:<div className="space-y-2">{partners.map(p=><button key={p.id} onClick={()=>{setSelected(p.id);setTempPassword("");setMessage("");}} className={`w-full rounded-xl border p-3 text-left transition ${selected===p.id?"border-[#efbd5d]/40 bg-[#efbd5d]/10":"border-white/10 hover:border-white/25"}`}>
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{p.name}</span><span className={`text-xs ${p.is_active?"text-emerald-400":"text-rose-300"}`}>{p.is_active?"Active":"Paused"}</span></div>
      <p className="mt-1 text-xs text-white/45">{p.code} · {p.businesses} businesses · {p.account_role?p.account_role==="customer"?"Customer account":"Business account":"Legacy / not linked"}</p><p className="mt-2 text-sm text-[#efbd5d]">Outstanding: {formatMoney(p.unpaid_centimes)}</p></button>)}</div>}
    </section>
   </div>
   <div className="space-y-5">
    {!report?<section className={`${panel} flex min-h-56 items-center justify-center text-sm text-white/45`}>Select a partner to inspect their business referrals and earnings.</section>:<>
     <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{report.affiliate.name}</h2><p className="mt-1 text-sm text-white/45">{report.affiliate.account_email||report.affiliate.email} · {report.affiliate.account_role||"Not linked to a platform account"}</p></div><span className="rounded-lg border border-[#efbd5d]/30 bg-[#efbd5d]/10 px-3 py-1 text-xs text-[#efbd5d]">{report.affiliate.code}</span></div>
      <p className="mt-5 text-xs text-white/50">Business referral link</p><div className="mt-2 flex flex-wrap gap-2"><input readOnly value={referralUrl(report.affiliate.code)} aria-label="Referral link" className={`${field} min-w-0 flex-1`}/><button className={secondary} onClick={()=>void copy(referralUrl(report.affiliate.code),"ref")}><Copy className="size-4"/>{copied==="ref"?"Copied":"Copy"}</button></div>
      <div className="mt-2 flex gap-2"><button className={secondary} onClick={()=>void copy(affiliateUrl(report.affiliate),"portal")}><ArrowRight className="size-4"/>Copy partner dashboard URL</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Referred businesses" value={String(report.summary.referred_businesses)}/><Mini label="Earned total" value={formatMoney(report.summary.total_centimes)}/><Mini label="Unpaid balance" value={formatMoney(report.summary.unpaid_centimes)}/></div>
     </section>
     <section className={panel}><h3 className="mb-4 text-lg font-semibold">Partner settings</h3><label className="text-xs text-white/60">Display name<input className={`${field} mt-2 mb-4`} value={editName} onChange={e=>setEditName(e.target.value)}/></label><RateFields rates={editRates} setRates={setEditRates}/><div className="mt-4 flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={()=>void save(report.affiliate.is_active)}><Save className="size-4"/>Save changes</button><button className={secondary} disabled={busy} onClick={()=>void save(!report.affiliate.is_active)}>{report.affiliate.is_active?"Pause partner":"Reactivate partner"}</button></div>{!report.affiliate.user_id?<div className="mt-4 space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="text-sm font-semibold text-amber-200">Link this existing affiliate to a normal account</p><p className="text-xs text-white/55">Preserves all previous referrals, commissions and payouts. The account must register in LOYVANCE first.</p><input type="email" value={linkEmail} onChange={e=>setLinkEmail(e.target.value)} placeholder="Registered LOYVANCE email" aria-label="Account email to link" className={field}/><button className={primary} disabled={busy||!linkEmail.trim()} onClick={()=>void linkAccount()}>Grant access to account</button><button className={secondary} disabled={busy} onClick={()=>void resetPassword()}>Reset legacy portal password</button></div>:<p className="mt-3 text-xs text-emerald-300">Linked account · Sign in normally using the original customer or business password.</p>}<p className="mt-3 text-xs text-white/40">Pausing prevents new referrals, login and future commission accrual. Existing earnings stay in the ledger.</p></section>
     <section className={panel}><h3 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Wallet className="size-5 text-[#efbd5d]"/>Record monthly payout</h3><p className="mb-4 text-xs text-white/45">Only mark paid after you really transfer the money. Unpaid commissions for the selected Morocco month are settled together.</p>
       <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-white/60">Commission month<input type="month" className={`${field} mt-2`} value={payoutMonth} onChange={e=>setPayoutMonth(e.target.value)}/></label><label className="text-xs text-white/60">Payment method<input className={`${field} mt-2`} value={payoutMethod} onChange={e=>setPayoutMethod(e.target.value)} placeholder="Bank transfer"/></label><label className="text-xs text-white/60">Transfer reference<input className={`${field} mt-2`} value={payoutReference} onChange={e=>setPayoutReference(e.target.value)} placeholder="Transaction ID"/></label></div><button className={`${primary} mt-4`} disabled={busy||!payoutReference.trim()} onClick={()=>void pay()}><Check className="size-4"/>Confirm money sent & record payout</button>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[410px] text-left text-xs"><thead><tr className="text-white/40"><th className="py-2">Paid date</th><th>Month</th><th>Amount</th><th>Reference</th></tr></thead><tbody>{report.payouts.map(p=><tr className="border-t border-white/10" key={p.id}><td className="py-2">{formatDate(p.paid_at)}</td><td>{p.month}</td><td>{formatMoney(p.amount_centimes)}</td><td>{p.reference}</td></tr>)}</tbody></table></div>
     </section>
     <section className={panel}><h3 className="mb-4 text-lg font-semibold">Businesses brought by this partner</h3><div className="overflow-x-auto"><table className="w-full min-w-[470px] text-left text-xs"><thead><tr className="text-white/40"><th className="py-2">Business</th><th>Joined</th><th>Paid orders</th><th>Commissions</th></tr></thead><tbody>{report.businesses.map(b=><tr key={b.id} className="border-t border-white/10"><td className="py-3 font-semibold">{b.name}</td><td>{formatDate(b.attributed_at)}</td><td>{b.paid_orders}</td><td>{formatMoney(b.earned_centimes)}</td></tr>)}</tbody></table>{!report.businesses.length&&<p className="py-5 text-sm text-white/35">No referred businesses yet.</p>}</div></section>
     <section className={panel}><h3 className="mb-4 text-lg font-semibold">Confirmed payment commissions</h3><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="text-white/40"><th className="py-2">Payment date</th><th>Business</th><th>Plan</th><th>Received</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>{report.commissions.map(c=><tr className="border-t border-white/10" key={c.subscription_event_id}><td className="py-3">{formatDate(c.paid_at)}</td><td>{c.business_name}</td><td>{c.duration_months} mo.</td><td>{formatMoney(c.amount_centimes)}</td><td>{c.rate_bps/100}%</td><td className="font-semibold text-[#efbd5d]">{formatMoney(c.commission_centimes)}</td><td className={c.payout_id?"text-emerald-300":"text-amber-300"}>{c.payout_id?"Paid":"Unpaid"}</td></tr>)}</tbody></table>{!report.commissions.length&&<p className="py-5 text-sm text-white/35">No confirmed paid subscriptions yet.</p>}</div></section>
    </>}
   </div>
  </div>
 </div>;
}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/45">{label}</p><p className="mt-2 break-all text-xl font-semibold text-[#efbd5d]">{value}</p></div>;}
function RateFields({rates,setRates}:{rates:Rates;setRates:(value:Rates)=>void}){
 return <fieldset><legend className="mb-2 text-xs font-semibold text-white/65">Commission rates by subscription (%)</legend><div className="grid grid-cols-2 gap-3">{(["1","3","6","12"] as const).map(m=><label key={m} className="text-xs text-white/50">{m==="12"?"1 year":`${m} month${m==="1"?"":"s"}`}<input className={`${field} mt-1`} type="number" min="0" max="50" step="0.01" value={rates[m]} onChange={e=>setRates({...rates,[m]:Number(e.target.value)})}/></label>)}</div></fieldset>;
}
