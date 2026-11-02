"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useEffect,useState} from "react";
import {Copy,Users,Gift,Share2,CheckCircle2} from "lucide-react";
import {CustomerLayout} from "@/components/customer-app/customer-layout";
import {useCustomerAuth} from "@/components/customer-app/customer-auth-provider";
import {apiFetch} from "@/lib/api";
type LinkRow={business_id:string;business_name:string;code:string;invited:number;qualified:number};
export default function InviteFriendsPage(){
 const {token:customerToken}=useCustomerAuth();
 const {t:tr}=useI18n();const token=customerToken??undefined;const [links,setLinks]=useState<LinkRow[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[copied,setCopied]=useState("");
 useEffect(()=>{if(!token)return;let active=true;apiFetch<{links:LinkRow[]}>("/growth/referrals",{token,cache:"no-store"}).then(res=>{if(active)setLinks(res.links);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load invitation links.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[token]);
 const url=(link:LinkRow)=>typeof window==="undefined"?"":window.location.origin+"/register?invite="+encodeURIComponent(link.code)+"&join_business_id="+encodeURIComponent(link.business_id);
 const copy=async(l:LinkRow)=>{try{await navigator.clipboard.writeText(url(l));setCopied(l.code);}catch{setError("Your browser blocked clipboard access. Select and copy the link below.");}};
 return <CustomerLayout title={tr("Invite Friends & Earn Rewards")} subtitle="Bring a friend to a business loyalty program and both earn a bonus stamp after their first verified visit.">
 <div className="space-y-4">
 <div className="rounded-2xl border border-[#e7b354]/20 bg-[#12130f] p-5"><div className="flex items-center gap-3"><Gift className="size-6 text-[#e7b354]"/><h2 className="text-lg font-bold">{tr("How it works")}</h2></div><p className="mt-2 text-sm leading-6 text-white/65">Share the invitation for one of your loyalty cards. Your friend creates a new account, verifies their email, joins that business and makes their first QR-confirmed visit. You both receive one bonus stamp when your loyalty card has room. Pending stamps wait for available space.</p><p className="mt-2 text-xs text-white/45">{tr("These are customer-to-customer invitations, separate from business affiliate commissions. One qualified referral per new customer account. No bonus for signups alone.")}</p></div>
 {loading?<p className="text-sm text-white/50">Loading invitation links…</p>:error?<p role="alert" className="rounded-xl border border-red-400/20 p-3 text-sm text-red-300">{error}</p>:links.length===0?<div className="rounded-xl border border-white/10 p-5 text-sm text-white/60">{tr("Join a business loyalty program first to unlock a personal invitation link.")}</div>:<div className="grid gap-4 md:grid-cols-2">{links.map(l=><section key={l.business_id} className="min-w-0 rounded-2xl border border-[#e7b354]/20 bg-[#11130f] p-5">
  <div className="flex items-center gap-2"><Share2 className="size-5 text-[#e7b354]"/><h2 className="break-words font-semibold">{l.business_name}</h2></div>
  <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/25 p-3"><p className="text-2xl font-bold text-[#e7b354]">{l.invited}</p><p className="text-xs text-white/45">{tr("Invitations registered")}</p></div><div className="rounded-xl bg-black/25 p-3"><p className="text-2xl font-bold text-emerald-300">{l.qualified}</p><p className="text-xs text-white/45">{tr("First visits confirmed")}</p></div></div>
  <label className="mt-4 block text-xs text-white/55">{tr("Your invitation URL")}<input readOnly onFocus={e=>e.target.select()} className="mt-2 w-full min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/80" value={url(l)}/></label>
  <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f0bd57] px-4 py-3 text-sm font-bold text-[#11100a]" onClick={()=>void copy(l)}>{copied===l.code?<CheckCircle2 className="size-4"/>:<Copy className="size-4"/>}{copied===l.code?"Link copied":"Copy invitation"}</button>
 </section>)}</div>}
 <p className="flex items-start gap-2 text-xs text-white/45"><Users className="size-4 shrink-0"/>{tr("Referral bonuses respect each business&apos;s loyalty card limit. They do not count as purchases or new visits in Analytics.")}</p>
 </div></CustomerLayout>;
}