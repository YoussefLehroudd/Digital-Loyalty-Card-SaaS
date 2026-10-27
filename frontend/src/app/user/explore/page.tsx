"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, ExternalLink, Gift, Loader2, MapPin, RefreshCw, Search, Star, Store, X } from "lucide-react";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { useI18n } from "@/components/i18n/language-provider";
import { customerExploreBusinesses, customerGetBusinessCard, type DiscoverableBusiness } from "@/lib/customerAuth";

type Filter = "all" | "available" | "joined";
const panel="min-w-0 overflow-hidden rounded-2xl border border-[#e7b354]/20 bg-[linear-gradient(145deg,rgba(17,18,14,.96),rgba(9,10,8,.96))]";

function BusinessTile({business,onGetCard,busy}:{business:DiscoverableBusiness;onGetCard:(id:string)=>void;busy:boolean}){
 const {t:tr}=useI18n();
 const joined=business.has_card;
 const unavailable=!business.available && !joined;
 const color=/^#[0-9a-f]{6}$/i.test(business.primary_color||"")?business.primary_color!:"#e7b354";
 return <article className={`${panel} flex h-full min-w-0 flex-col transition-colors hover:border-[#e7b354]/40`}>
   <div className="relative h-32 w-full overflow-hidden border-b border-[#e7b354]/10 bg-[radial-gradient(ellipse_at_65%_25%,rgba(208,157,56,.22),transparent_60%),#171913] sm:h-40">
    {business.hero_image_url?<img src={business.hero_image_url} alt="" loading="lazy" className="h-full w-full object-cover opacity-85"/>:null}
    <span className="absolute end-3 top-3 rounded-full border border-white/15 bg-black/75 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
     {joined?<span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="size-3"/>{tr("Card added")}</span>:business.available?tr("Available"):tr("Currently unavailable")}
    </span>
   </div>
   <div className="relative flex min-w-0 flex-1 flex-col p-4">
    <div className="-mt-10 mb-3 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#26271c] bg-[#12150e] shadow-lg">
     {business.logo_url?<img src={business.logo_url} alt="" loading="lazy" className="size-full object-cover"/>:<Store className="size-6" style={{color}}/>}
    </div>
    <h3 className="min-w-0 break-words text-base font-semibold text-white">{business.name}</h3>
    {business.address?<p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-5 text-white/50"><MapPin className="mt-0.5 size-3.5 shrink-0"/><span className="min-w-0 break-words">{business.address}</span></p>:null}
    <div className="mt-4 flex min-w-0 flex-1 flex-col rounded-xl border border-[#e7b354]/15 bg-[#e7b354]/[.045] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#f1bd58]"><Gift className="size-4 shrink-0"/><span className="min-w-0 break-words">{business.reward_name}</span></div>
      <p className="mt-1 text-[11px] leading-5 text-white/55">{business.reward_description||tr("Collect stamps and unlock rewards.")}</p>
      <span className="mt-2 text-[11px] font-medium text-white/45">{business.required_stamps} {tr("stamps to collect")}</span>
    </div>
    {(business.google_maps_url || business.google_reviews_url) ?
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 min-[340px]:grid-cols-2">
        {business.google_maps_url ?
          <a href={business.google_maps_url} target="_blank" rel="noopener noreferrer"
            aria-label={tr("Open this business in Google Maps")}
            className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[.035] px-2.5 text-xs font-semibold text-white/80 transition hover:border-[#efbd5d]/50 hover:text-[#efbd5d]">
            <MapPin className="size-4 shrink-0 text-[#efbd5d]"/>{tr("Google Maps")}<ExternalLink className="size-3 shrink-0 opacity-60"/>
          </a> : null}
        {business.google_reviews_url ?
          <a href={business.google_reviews_url} target="_blank" rel="noopener noreferrer"
            aria-label={tr("Write a Google review for this business")}
            className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[#efbd5d]/25 bg-[#efbd5d]/[.07] px-2.5 text-xs font-semibold text-[#efbd5d] transition hover:bg-[#efbd5d]/15">
            <Star className="size-4 shrink-0"/>{tr("Write a review")}<ExternalLink className="size-3 shrink-0 opacity-60"/>
          </a> : null}
      </div> : null}
    {joined?
      <Link href={`/user/cards?selected=${encodeURIComponent(business.membership_id||"")}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e7b354]/30 bg-[#e7b354]/10 px-3 text-sm font-bold text-[#f1bd58] transition hover:bg-[#e7b354]/20"><CreditCard className="size-4"/>{tr("View my card")}<ArrowRight className="size-4"/></Link>:
      <button type="button" disabled={busy||unavailable} onClick={()=>onGetCard(business.id)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#efbd5d] px-3 text-sm font-bold text-[#10110e] transition hover:bg-[#f7cf82] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35">
       {busy?<Loader2 className="size-4 animate-spin"/>:<CreditCard className="size-4"/>}
       {busy?tr("Adding card..."):unavailable?tr("Program unavailable"):tr("Get loyalty card")}
      </button>
    }
   </div>
 </article>;
}

export default function UserExploreBusinessesPage(){
 const {t:tr}=useI18n();
 const {token}=useCustomerAuth();
 const router=useRouter();
 const [items,setItems]=useState<DiscoverableBusiness[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<Filter>("all");
 const [pending,setPending]=useState<string|null>(null);
 const load=useCallback(async()=>{
  if(!token){setLoading(false);return;}
  setLoading(true);
  try{
   const result=await customerExploreBusinesses(token);
   setItems(result.data||[]);
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load businesses.");}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>{
  const query=search.trim().toLocaleLowerCase();
  return items.filter(item=>
   (filter==="all" || (filter==="available"&&item.available&&!item.has_card) || (filter==="joined"&&item.has_card)) &&
   (!query||[item.name,item.address||"",item.reward_name,item.reward_description||""].some(text=>text.toLocaleLowerCase().includes(query)))
  );
 },[items,search,filter]);
 const joinedCount=items.filter(item=>item.has_card).length;
 const availableCount=items.filter(item=>item.available&&!item.has_card).length;
 async function getCard(businessId:string){
  if(!token||pending)return;
  setPending(businessId);setError("");
  try{
   const response=await customerGetBusinessCard(token,businessId);
   // Existing membership is reused; no new stamps or visits are granted.
   setItems(prev=>prev.map(item=>item.id===businessId?{...item,has_card:true,membership_id:response.membership_id}:item));
   router.push("/user/cards?selected="+encodeURIComponent(response.membership_id));
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to issue the loyalty card.");}
  finally{setPending(null);}
 }
 return <CustomerLayout title={tr("Explore Businesses")} subtitle={tr("Discover nearby loyalty programs and add a card online")}>
  <div className="space-y-5">
   <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
    <label className="relative block min-w-0 flex-1">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#efbd5d]/70"/>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr("Search businesses, addresses or rewards...")} aria-label={tr("Search businesses")} className="min-h-12 w-full min-w-0 rounded-xl border border-[#e7b354]/20 bg-[#0e110c] ps-10 pe-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#efbd5d]/60"/>
      {search?<button type="button" aria-label={tr("Clear search")} onClick={()=>setSearch("")} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-white/50"><X className="size-4"/></button>:null}
    </label>
    <button type="button" aria-label={tr("Refresh businesses")} onClick={()=>void load()} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e7b354]/20 bg-[#0e110c] px-4 text-sm font-medium text-[#efbd5d] transition hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`size-4 ${loading?"animate-spin":""}`}/>{tr("Refresh")}</button>
   </div>
   <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={tr("Business filters")}>
    {([{id:"all",label:"All businesses",count:items.length},{id:"available",label:"Get a card",count:availableCount},{id:"joined",label:"My cards",count:joinedCount}] as const).map(option=><button key={option.id} type="button" onClick={()=>setFilter(option.id)} aria-pressed={filter===option.id} className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition ${filter===option.id?"border-[#efbd5d] bg-[#efbd5d] text-[#11120e]":"border-[#e7b354]/20 bg-[#11140f] text-white/65 hover:text-white"}`}>{tr(option.label)} <span className="ms-1 opacity-70">{option.count}</span></button>)}
   </div>
   {error?<div role="alert" className="rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>:null}
   {loading?<div className="flex min-h-48 items-center justify-center gap-2 text-sm text-white/60"><Loader2 className="size-5 animate-spin text-[#efbd5d]"/>{tr("Loading businesses...")}</div>:
    filtered.length?<div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map(item=><BusinessTile key={item.id} business={item} busy={pending===item.id} onGetCard={getCard}/>)}</div>:
    <div className={`${panel} flex flex-col items-center p-8 text-center`}><Store className="size-9 text-[#efbd5d]/70"/><h2 className="mt-3 text-sm font-semibold text-white">{tr("No businesses found")}</h2><p className="mt-2 max-w-sm text-xs leading-5 text-white/45">{tr("Try another search or select All businesses. New stores will appear here as they join LOYVANCE.")}</p><button type="button" className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-xs text-white/70" onClick={()=>{setSearch("");setFilter("all");}}>{tr("Show all businesses")}</button></div>
   }
  </div>
 </CustomerLayout>;
}
