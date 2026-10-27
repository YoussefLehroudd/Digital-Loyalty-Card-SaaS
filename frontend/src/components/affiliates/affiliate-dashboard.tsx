"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CalendarClock, Check, Copy, Eye, Handshake, Loader2, RefreshCcw, TrendingUp, Users, Wallet } from "lucide-react";
import { AffiliateReferralTracking, type ReferredBusiness } from "@/components/affiliates/affiliate-referral-tracking";
import { apiFetch, ApiError } from "@/lib/api";

type Affiliate = { id:string;name:string;email:string;code:string;rate_1_bps:number;rate_3_bps:number;rate_6_bps:number;rate_12_bps:number };
type Commission = { subscription_event_id:string;business_name:string;duration_months:number;amount_centimes:number;rate_bps:number;commission_centimes:number;paid_at:string;payout_id:string|null };
type PartnerReport = {
  affiliate:Affiliate;
  summary:{referred_businesses:number;link_visits:number;last_link_visit:string|null;active_trials:number;active_subscriptions:number;paid_orders:number;total_centimes:string;unpaid_centimes:string;month_centimes:string};
  businesses:ReferredBusiness[];
  commissions:Commission[];
  history:{month:string;orders:number;earned_centimes:string;unpaid_centimes:string}[];
  payouts:{id:string;month:string;amount_centimes:number;method:string;reference:string;paid_at:string}[];
};
const money = (cents:number|string|undefined) => new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD"}).format(Number(cents??0)/100);
const date = (value:string) => new Date(value).toLocaleDateString("fr-MA",{year:"numeric",month:"short",day:"numeric",timeZone:"Africa/Casablanca"});
const box = "rounded-2xl border border-[#efbd5d]/15 bg-[#10130e]/90 p-5 sm:p-6";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-[#efbd5d]/25 bg-[#efbd5d]/10 px-4 py-2.5 text-xs font-semibold text-[#efbd5d] transition hover:bg-[#efbd5d]/20";
type Tab="tracking"|"commissions"|"businesses"|"months"|"payouts";

export function AffiliateDashboard({token}:{token:string|null}){
 const [report,setReport] = useState<PartnerReport|null>(null);
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState("");
 const [copied,setCopied] = useState(false);
 const [tab,setTab] = useState<Tab>("tracking");
 const refresh = useCallback(async ()=>{
   if(!token){setLoading(false);return;}
   setLoading(true);
   try{
     const data=await apiFetch<PartnerReport>("/affiliate/report",{token,cache:"no-store"});
     setReport(data);setError("");
   }catch(e){
     setReport(null);
     setError(e instanceof ApiError&&e.status===401?
       "Affiliate access is not enabled for this account. Contact the platform administrator.":
       e instanceof Error?e.message:"Could not load affiliate earnings.");
   }finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void refresh();},[refresh]);
 const url=typeof window==="undefined"?"":report?`${window.location.origin}/register?ref=${encodeURIComponent(report.affiliate.code)}`:"";
 async function copyLink(){
   try{await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}
   catch{setError("Copy failed. Select the URL and copy it manually.");}
 }
 if(loading) return <div className={`${box} flex min-h-48 items-center justify-center gap-3 text-sm text-white/55`}><Loader2 className="size-5 animate-spin text-[#efbd5d]"/>Loading your affiliate activity…</div>;
 if(!report) return <div className={box}><h2 className="text-lg font-semibold text-white">Affiliate workspace unavailable</h2><p role="alert" className="mt-3 text-sm text-amber-200">{error}</p><button onClick={()=>void refresh()} className={`${button} mt-4`}><RefreshCcw className="size-4"/>Retry</button></div>;
 const a=report.affiliate;
 return <div className="space-y-5 pb-8 text-white">
  <div className="flex flex-wrap items-start justify-between gap-4">
   <div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-[#efbd5d]"><Handshake className="size-4"/>Partner workspace</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Affiliate Program</h1><p className="mt-2 text-sm text-white/55">Your normal LOYVANCE account, with a private referral and commission dashboard.</p></div>
   <button className={button} onClick={()=>void refresh()}><RefreshCcw className="size-4"/>Refresh</button>
  </div>
  {error?<p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200" role="alert">{error}</p>:null}
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
   <Kpi icon={Eye} label="Link opens" value={String(report.summary.link_visits??0)}/>
   <Kpi icon={Users} label="Businesses signed up" value={String(report.summary.referred_businesses)}/>
   <Kpi icon={CalendarClock} label="Active trials" value={String(report.summary.active_trials??0)}/>
   <Kpi icon={TrendingUp} label="This month" value={money(report.summary.month_centimes)}/>
   <Kpi icon={Handshake} label="Total earned" value={money(report.summary.total_centimes)}/>
   <Kpi icon={Wallet} label="Awaiting payout" value={money(report.summary.unpaid_centimes)}/>
  </div>
  <section className={box}>
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Your personal business referral link</h2><p className="mt-1 text-xs text-white/45">Share with business owners. Commissions start only after a confirmed paid subscription.</p></div><span className="rounded-full border border-[#efbd5d]/25 px-3 py-1.5 text-xs text-[#efbd5d]">{a.code}</span></div>
   <div className="mt-4 flex flex-wrap gap-2"><input aria-label="Your business referral link" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white/85" readOnly value={url}/><button onClick={()=>void copyLink()} className={button}>{copied?<Check className="size-4"/>:<Copy className="size-4"/>}{copied?"Copied":"Copy link"}</button><a href={url} target="_blank" rel="noreferrer" className={button} aria-label="Open referral link"><ArrowUpRight className="size-4"/></a></div>
   <p className="mt-4 text-xs leading-5 text-white/50">Your current rates: <strong className="text-[#efbd5d]">{a.rate_1_bps/100}%</strong> (1 month), <strong className="text-[#efbd5d]">{a.rate_3_bps/100}%</strong> (3 months), <strong className="text-[#efbd5d]">{a.rate_6_bps/100}%</strong> (6 months), <strong className="text-[#efbd5d]">{a.rate_12_bps/100}%</strong> (1 year). Rates are fixed per confirmed payment and may be adjusted by an admin for future payments.</p>
  </section>
  <section className={box}>
   <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Referral tracking & earnings</h2><span className="text-xs text-white/40">{report.summary.paid_orders} confirmed subscription payments</span></div>
   <div className="mb-4 flex flex-wrap gap-2">{([["tracking","Referral tracking"],["commissions","Commissions"],["businesses","Businesses"],["months","Monthly earnings"],["payouts","Payouts"]] as [Tab,string][]).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${tab===key?"bg-[#efbd5d] text-[#15120c]":"border border-white/10 text-white/60 hover:text-white"}`}>{label}</button>)}</div>
   {tab==="tracking"&&<AffiliateReferralTracking visits={report.summary.link_visits??0} signups={report.summary.referred_businesses} activePaid={report.summary.active_subscriptions??0} lastVisit={report.summary.last_link_visit} businesses={report.businesses}/>}
   <div className={tab==="tracking"?"hidden":"overflow-x-auto"}>
    {tab==="commissions"&&<table className="w-full min-w-[675px] text-left text-xs"><thead className="text-white/40"><tr><th className="pb-3">Payment</th><th>Business</th><th>Plan</th><th>Paid amount</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>{report.commissions.map(c=><tr key={c.subscription_event_id} className="border-t border-white/10"><td className="py-4">{date(c.paid_at)}</td><td>{c.business_name}</td><td>{c.duration_months} months</td><td>{money(c.amount_centimes)}</td><td>{c.rate_bps/100}%</td><td className="font-semibold text-[#efbd5d]">{money(c.commission_centimes)}</td><td className={c.payout_id?"text-emerald-300":"text-amber-300"}>{c.payout_id?"Settled":"Unpaid"}</td></tr>)}</tbody></table>}
    {tab==="businesses"&&<table className="w-full min-w-[420px] text-left text-xs"><thead className="text-white/40"><tr><th className="pb-3">Business</th><th>Referred</th><th>Paid subscriptions</th><th>Your earnings</th></tr></thead><tbody>{report.businesses.map(b=><tr key={b.id} className="border-t border-white/10"><td className="py-4">{b.name}</td><td>{date(b.attributed_at)}</td><td>{b.paid_orders}</td><td className="font-semibold text-[#efbd5d]">{money(b.earned_centimes)}</td></tr>)}</tbody></table>}
    {tab==="months"&&<table className="w-full min-w-[390px] text-left text-xs"><thead className="text-white/40"><tr><th className="pb-3">Month</th><th>Paid orders</th><th>Earned</th><th>Unpaid</th></tr></thead><tbody>{report.history.map(h=><tr key={h.month} className="border-t border-white/10"><td className="py-4">{h.month}</td><td>{h.orders}</td><td className="font-semibold text-[#efbd5d]">{money(h.earned_centimes)}</td><td>{money(h.unpaid_centimes)}</td></tr>)}</tbody></table>}
    {tab==="payouts"&&<table className="w-full min-w-[455px] text-left text-xs"><thead className="text-white/40"><tr><th className="pb-3">Payout date</th><th>Month</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>{report.payouts.map(p=><tr key={p.id} className="border-t border-white/10"><td className="py-4">{date(p.paid_at)}</td><td>{p.month}</td><td className="font-semibold text-emerald-300">{money(p.amount_centimes)}</td><td>{p.method}</td><td>{p.reference}</td></tr>)}</tbody></table>}
    {(tab==="commissions"&&!report.commissions.length||tab==="businesses"&&!report.businesses.length||tab==="months"&&!report.history.length||tab==="payouts"&&!report.payouts.length)&&<p className="py-10 text-center text-sm text-white/40">No data in this section yet.</p>}
   </div>
  </section>
  <p className="text-center text-xs text-white/40">Referral data covers businesses registered through your link. Earnings are generated from real payments confirmed by the platform administrator. Payout entries are recorded after transfers are sent.</p>
 </div>;
}
function Kpi({icon:Icon,label,value}:{icon:typeof Users;label:string;value:string}){return <div className={box}><div className="flex items-center justify-between gap-2"><span className="text-xs text-white/50">{label}</span><Icon className="size-5 shrink-0 text-[#efbd5d]"/></div><p className="mt-4 break-words text-xl font-semibold text-[#efbd5d] sm:text-2xl">{value}</p></div>}
