"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BarChart3, Check, Copy, ExternalLink, Eye, EyeOff, Handshake, Loader2, LockKeyhole, LogOut, RefreshCw, TrendingUp, Users, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

type Affiliate = { id:string;name:string;email:string;code:string;rate_1_bps:number;rate_3_bps:number;rate_6_bps:number;rate_12_bps:number };
type Summary = {referred_businesses:number;paid_orders:number;total_centimes:string;unpaid_centimes:string;month_centimes:string};
type Commission={subscription_event_id:string;business_name:string;duration_months:number;amount_centimes:number;rate_bps:number;commission_centimes:number;paid_at:string;payout_id:string|null};
type Report={affiliate:Affiliate;summary:Summary;businesses:{id:string;name:string;attributed_at:string;paid_orders:number;earned_centimes:string}[];commissions:Commission[];payouts:{id:string;month:string;amount_centimes:number;paid_at:string;reference:string;method:string}[];history:{month:string;orders:number;earned_centimes:string;unpaid_centimes:string}[]};
const TOKEN_KEY="loyvance_affiliate_token";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-[#efbd5d] px-5 py-3 text-sm font-bold text-[#14120e] transition hover:bg-[#f6cf87] disabled:opacity-50";
const secondary="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/75 hover:border-[#efbd5d]/30 hover:bg-white/5";
const input="w-full rounded-xl border border-white/15 bg-[#0c1015] px-4 py-3 text-sm text-white outline-none focus:border-[#efbd5d]";
const panel="rounded-2xl border border-white/10 bg-[#11151b] p-5 sm:p-6";
const money=(cents:number|string|undefined)=>new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD"}).format(Number(cents??0)/100);
const date=(value:string)=>new Date(value).toLocaleDateString("fr-MA",{year:"numeric",month:"short",day:"numeric",timeZone:"Africa/Casablanca"});

export default function AffiliatePortal(){
 const [token,setToken]=useState<string|null>(null);
 const [ready,setReady]=useState(false);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [tab,setTab]=useState<"orders"|"businesses"|"months"|"payouts">("orders");
 const [currentPassword,setCurrentPassword]=useState("");
 const [newPassword,setNewPassword]=useState("");
 const [showChange,setShowChange]=useState(false);
 const [copied,setCopied]=useState(false);
 const load=useCallback(async (value:string)=>{
  try{
   const result=await apiFetch<Report>("/affiliate/report",{token:value,cache:"no-store"});
   setReport(result);setError("");return true;
  }catch(e){
   setError(e instanceof Error?e.message:"Unable to load affiliate dashboard.");
   if((e as {status?:number}).status===401){localStorage.removeItem(TOKEN_KEY);setToken(null);}
   return false;
  }
 },[]);
 useEffect(()=>{
  const existing=localStorage.getItem(TOKEN_KEY);setReady(true);
  if(existing){setToken(existing);void load(existing);}
 },[load]);
 async function login(e:FormEvent){
  e.preventDefault();setError("");setBusy(true);
  try{
   const res=await apiFetch<{token:string}>("/affiliate/login",{method:"POST",body:JSON.stringify({email,password})});
   localStorage.setItem(TOKEN_KEY,res.token);setToken(res.token);setPassword("");
   await load(res.token);
  }catch(e){setError(e instanceof Error?e.message:"Sign-in failed.");}
  finally{setBusy(false);}
 }
 async function logout(){
  if(token)try{await apiFetch("/affiliate/logout",{method:"POST",token});}catch{}
  localStorage.removeItem(TOKEN_KEY);setToken(null);setReport(null);setSuccess("");setError("");
 }
 async function changePassword(e:FormEvent){
  e.preventDefault();if(!token)return;setBusy(true);setError("");setSuccess("");
  try{
   await apiFetch("/affiliate/password",{method:"POST",token,body:JSON.stringify({current_password:currentPassword,new_password:newPassword})});
   setCurrentPassword("");setNewPassword("");setShowChange(false);await logout();setSuccess("Password changed. Sign in with the new password.");
  }catch(e){setError(e instanceof Error?e.message:"Password update failed.");}
  finally{setBusy(false);}
 }
 const referralUrl=report&&typeof window!=="undefined"?`${window.location.origin}/register?ref=${encodeURIComponent(report.affiliate.code)}`:"";
 async function copy(){try{await navigator.clipboard.writeText(referralUrl);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{setError("Unable to copy. Select the link manually.");}}
 if(!ready)return <main className="min-h-dvh bg-[#090b0f] p-12 text-center text-white/50">Loading partner portal...</main>;
 if(!token)return <main className="flex min-h-dvh items-center justify-center bg-[#090b0f] px-4 py-12 text-white">
   <div className="w-full max-w-md space-y-6">
     <Link href="/" className="mx-auto flex w-fit items-center gap-3 text-xl font-black tracking-[.12em]"><img src="/brand/icon.png" alt="" className="size-12 object-contain"/>LOYVANCE</Link>
     <div className={`${panel} space-y-6`}>
       <div className="text-center"><span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-[#efbd5d]/30 bg-[#efbd5d]/10"><Handshake className="size-6 text-[#efbd5d]"/></span><h1 className="text-2xl font-semibold">Affiliate Partner Portal</h1><p className="mt-2 text-sm text-white/45">Legacy partner portal. New partners sign in with their existing LOYVANCE account.</p></div>
       <div className="grid grid-cols-2 gap-2"><Link href="/login" className={secondary}>Business sign in</Link><Link href="/user/login" className={secondary}>Customer sign in</Link></div>
       <p className="text-xs text-center text-white/40">After signing in normally, open the Affiliate tab in your dashboard.</p>
       {error&&<p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
       {success&&<p role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p>}
       <form onSubmit={e=>void login(e)} className="space-y-4"><label className="block text-xs text-white/65">Your login email<input type="email" required className={`${input} mt-2`} value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></label>
        <label className="block text-xs text-white/65">Password<span className="relative mt-2 block"><input type={showPassword?"text":"password"} required className={`${input} pe-12`} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute end-3 top-3 text-white/50" aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff className="size-5"/>:<Eye className="size-5"/>}</button></span></label>
        <button type="submit" className={`${primary} w-full`} disabled={busy}>{busy?<Loader2 className="size-4 animate-spin"/>:<ArrowRight className="size-4"/>}Sign in</button>
       </form>
       <p className="text-center text-xs text-white/35">Accounts are created by LOYVANCE administrators. Your referral link does not grant dashboard access.</p>
     </div>
     <Link href="/" className="block text-center text-sm text-white/45 hover:text-[#efbd5d]">Back to LOYVANCE</Link>
   </div>
  </main>;
 return <main className="min-h-dvh bg-[#090b0f] pb-12 text-white">
  <header className="border-b border-white/10 bg-[#0e1117]"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"><Link href="/" className="flex items-center gap-3 text-lg font-black tracking-[.12em]"><img src="/brand/icon.png" alt="" className="size-10"/>LOYVANCE <span className="hidden text-xs font-normal tracking-normal text-[#efbd5d] sm:inline">/ Partners</span></Link><div className="flex items-center gap-2"><button className={secondary} onClick={()=>token&&void load(token)} aria-label="Refresh dashboard"><RefreshCw className="size-4"/>Refresh</button><button className={secondary} onClick={()=>void logout()}><LogOut className="size-4"/>Sign out</button></div></div></header>
  <div className="mx-auto max-w-6xl space-y-6 px-4 pt-8 sm:px-6">
   {error&&<p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
   {success&&<p role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p>}
   {!report?<section className={`${panel} flex items-center gap-3`}><Loader2 className="size-5 animate-spin text-[#efbd5d]"/>Loading your earnings...</section>:<>
   <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#efbd5d]">Partner earnings</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {report.affiliate.name}</h1><p className="mt-2 text-sm text-white/45">Only paid subscriptions verified by LOYVANCE generate a commission.</p></div><button className={secondary} onClick={()=>setShowChange(!showChange)}><LockKeyhole className="size-4"/>Change password</button></div>
   {showChange&&<form onSubmit={e=>void changePassword(e)} className={`${panel} max-w-xl space-y-3`}><h2 className="font-semibold">Update partner password</h2><input className={input} aria-label="Current password" type="password" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/><input className={input} aria-label="New password" type="password" placeholder="New password (12+ characters, Aa1)" minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><button className={primary} disabled={busy}>Update password</button></form>}
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon={Users} title="Businesses referred" value={String(report.summary.referred_businesses)}/><Metric icon={BarChart3} title="This month's commissions" value={money(report.summary.month_centimes)}/><Metric icon={TrendingUp} title="Lifetime earned" value={money(report.summary.total_centimes)}/><Metric icon={Wallet} title="Awaiting payout" value={money(report.summary.unpaid_centimes)}/></div>
   <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Your personal referral link</h2><p className="mt-1 text-xs text-white/45">Share this with business owners. They must register as a Business via this link.</p></div><span className="rounded-xl border border-[#efbd5d]/25 bg-[#efbd5d]/10 px-3 py-1.5 text-xs font-bold text-[#efbd5d]">Code: {report.affiliate.code}</span></div><div className="mt-4 flex flex-wrap gap-2"><input readOnly aria-label="Affiliate referral link" className={`${input} min-w-0 flex-1`} value={referralUrl}/><button className={primary} onClick={()=>void copy()}>{copied?<Check className="size-4"/>:<Copy className="size-4"/>}{copied?"Copied!":"Copy link"}</button><a className={secondary} href={referralUrl} target="_blank" rel="noopener noreferrer" aria-label="Open referral link"><ExternalLink className="size-4"/></a></div>
    <p className="mt-4 text-xs text-white/40">Rates for future verified payments: 1 month {report.affiliate.rate_1_bps/100}%, 3 months {report.affiliate.rate_3_bps/100}%, 6 months {report.affiliate.rate_6_bps/100}%, 1 year {report.affiliate.rate_12_bps/100}%. Historical earnings are never recalculated.</p>
   </section>
   <section className={panel}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your business and commission details</h2><span className="text-xs text-white/40">{report.summary.paid_orders} recorded paid subscriptions</span></div>
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Earnings view">{([{id:"orders",label:"Commissions"},{id:"businesses",label:"Businesses"},{id:"months",label:"By month"},{id:"payouts",label:"Payouts"}] as const).map(x=><button key={x.id} onClick={()=>setTab(x.id)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${tab===x.id?"bg-[#efbd5d] text-black":"border border-white/10 text-white/60"}`}>{x.label}</button>)}</div>
    <div className="overflow-x-auto">{tab==="orders"?<table className="w-full min-w-[680px] text-left text-xs"><thead className="text-white/45"><tr><th className="pb-3">Confirmed payment</th><th>Business</th><th>Plan</th><th>Amount paid</th><th>Your rate</th><th>Your earnings</th><th>Status</th></tr></thead><tbody>{report.commissions.map(c=><tr key={c.subscription_event_id} className="border-t border-white/10"><td className="py-4">{date(c.paid_at)}</td><td>{c.business_name}</td><td>{c.duration_months} month{c.duration_months===1?"":"s"}</td><td>{money(c.amount_centimes)}</td><td>{c.rate_bps/100}%</td><td className="font-semibold text-[#efbd5d]">{money(c.commission_centimes)}</td><td className={c.payout_id?"text-emerald-300":"text-amber-300"}>{c.payout_id?"Paid out":"Awaiting payout"}</td></tr>)}</tbody></table>:null}
     {tab==="businesses"?<table className="w-full min-w-[430px] text-left text-xs"><thead className="text-white/45"><tr><th className="pb-3">Business</th><th>Referred on</th><th>Paid subscriptions</th><th>Commission earned</th></tr></thead><tbody>{report.businesses.map(b=><tr key={b.id} className="border-t border-white/10"><td className="py-4 font-semibold">{b.name}</td><td>{date(b.attributed_at)}</td><td>{b.paid_orders}</td><td className="text-[#efbd5d]">{money(b.earned_centimes)}</td></tr>)}</tbody></table>:null}
     {tab==="months"?<table className="w-full min-w-[420px] text-left text-xs"><thead className="text-white/45"><tr><th className="pb-3">Month (Morocco)</th><th>Paid subscriptions</th><th>Earned</th><th>Awaiting payout</th></tr></thead><tbody>{report.history.map(h=><tr key={h.month} className="border-t border-white/10"><td className="py-4">{h.month}</td><td>{h.orders}</td><td className="text-[#efbd5d]">{money(h.earned_centimes)}</td><td>{money(h.unpaid_centimes)}</td></tr>)}</tbody></table>:null}
     {tab==="payouts"?<table className="w-full min-w-[470px] text-left text-xs"><thead className="text-white/45"><tr><th className="pb-3">Date</th><th>Month settled</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>{report.payouts.map(p=><tr key={p.id} className="border-t border-white/10"><td className="py-4">{date(p.paid_at)}</td><td>{p.month}</td><td className="font-semibold text-emerald-300">{money(p.amount_centimes)}</td><td>{p.method}</td><td>{p.reference}</td></tr>)}</tbody></table>:null}
     {((tab==="orders"&&!report.commissions.length)||(tab==="businesses"&&!report.businesses.length)||(tab==="months"&&!report.history.length)||(tab==="payouts"&&!report.payouts.length))&&<div className="py-12 text-center text-sm text-white/40">No records for this section yet.</div>}
    </div>
   </section>
   <p className="text-center text-xs text-white/35">Earnings reflect payments recorded by the administrator, not clicks or free trials. Payouts are registered only after payment is sent.</p>
   </>}
  </div>
 </main>;
}
function Metric({icon:Icon,title,value}:{icon:typeof Users;title:string;value:string}){return <div className={panel}><div className="flex items-center justify-between gap-2"><p className="text-xs text-white/50">{title}</p><Icon className="size-5 text-[#efbd5d]"/></div><p className="mt-5 break-words text-xl font-semibold tracking-tight text-[#efbd5d] sm:text-2xl">{value}</p></div>;}
