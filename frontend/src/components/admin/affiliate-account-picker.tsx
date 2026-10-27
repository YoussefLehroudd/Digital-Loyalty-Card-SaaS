"use client";
import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Search, UserRound, Users, X } from "lucide-react";
import { adminRequest } from "@/lib/admin";

export type AffiliateCandidate = {
  id:string;name:string;role:"customer"|"business_owner";
  email:string|null;business_name:string|null;business_email:string|null;
  affiliate_code:string;archived_affiliate:boolean;contact_visible:boolean;
};
type Kind="all"|"business"|"customer";
export function AffiliateAccountPicker({token,selected,onSelect}:{
  token:string;selected:AffiliateCandidate|null;onSelect:(candidate:AffiliateCandidate|null)=>void;
}) {
  const [query,setQuery]=useState("");
  const [kind,setKind]=useState<Kind>("all");
  const [results,setResults]=useState<AffiliateCandidate[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    setError("");
    const handle=setTimeout(()=>{
      void adminRequest<{data:AffiliateCandidate[]}>(
        `affiliates/candidates?q=${encodeURIComponent(query.trim())}&type=${kind}`,
        token,{signal:controller.signal,cache:"no-store"}
      ).then(response=>{
        if(!controller.signal.aborted)setResults(response.data);
      }).catch(cause=>{
        if(!controller.signal.aborted){setResults([]);setError(cause instanceof Error?cause.message:"Could not search accounts.");}
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },300);
    return()=>{clearTimeout(handle);controller.abort();};
  },[query,kind,token]);
  const types:[Kind,string,typeof Users][]=[
    ["all","All",Users],["business","Businesses",Building2],["customer","Customers",UserRound]
  ];
  return <div className="w-full min-w-0 max-w-full space-y-3 overflow-hidden rounded-xl border border-[#efbd5d]/15 bg-black/15 p-3 sm:p-3.5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold text-white">Select an existing account</h3>
      {selected?<button type="button" aria-label="Clear selected account" onClick={()=>onSelect(null)} className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white"><X className="size-3"/>Clear</button>:null}
    </div>
    <div className="grid min-w-0 grid-cols-3 gap-1.5" role="group" aria-label="Account type filter">
      {types.map(([value,label,Icon])=><button key={value} type="button" aria-pressed={kind===value} onClick={()=>setKind(value)} className={`flex min-w-0 items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] font-semibold transition ${kind===value?"border-[#efbd5d]/45 bg-[#efbd5d]/15 text-[#efbd5d]":"border-white/10 text-white/55 hover:bg-white/5 hover:text-white"}`}><Icon className="size-3.5 shrink-0"/><span className="truncate">{label}</span></button>)}
    </div>
    <div className="relative min-w-0"><Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-white/35"/>
      <input type="search" className="block w-full min-w-0 rounded-xl border border-white/15 bg-[#0b0e12] py-2.5 pe-3 ps-9 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#efbd5d]/50"
        value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, business or email..." aria-label="Search registered accounts"/>
    </div>
    {selected?<div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-2.5 text-xs text-emerald-300"><Check className="size-4 shrink-0"/><span className="min-w-0 truncate">Selected: <strong>{selected.business_name||selected.name}</strong></span></div>:null}
    <div className="max-h-64 min-w-0 space-y-1.5 overflow-x-hidden overflow-y-auto pe-0.5" aria-label="Matching registered accounts" aria-busy={loading}>
      {loading?<p className="flex items-center justify-center gap-2 py-6 text-xs text-white/50"><Loader2 className="size-4 animate-spin"/>Searching accounts...</p>:error?<p role="alert" className="py-4 text-xs text-rose-300">{error}</p>:results.length===0?<p className="py-6 text-center text-xs text-white/45">No matching accounts found.</p>:
        results.map(account=>{
          const taken=Boolean(account.affiliate_code);
          const selectedNow=selected?.id===account.id;
          const business=account.role==="business_owner";
          return <button key={account.id} type="button" disabled={taken} onClick={()=>onSelect(selectedNow?null:account)}
            aria-pressed={selectedNow}
            className={`flex w-full min-w-0 items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${selectedNow?"border-[#efbd5d]/50 bg-[#efbd5d]/10":taken?"cursor-not-allowed border-white/5 opacity-55":"border-white/10 hover:border-[#efbd5d]/35 hover:bg-white/5"}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${business?"bg-[#efbd5d]/10 text-[#efbd5d]":"bg-blue-400/10 text-blue-300"}`}>{business?<Building2 className="size-4"/>:<UserRound className="size-4"/>}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">{business?account.business_name||account.name:account.name}</span>
              {business?<span className="mt-0.5 block truncate text-[11px] text-white/55">Owner: {account.name}</span>:null}
              <span className="mt-0.5 block truncate text-[11px] text-white/45">{account.email||account.business_email||"Contact details private"}</span>
              <span className={`mt-1 block text-[10px] ${taken?"text-amber-300":"text-white/35"}`}>{taken?account.archived_affiliate?"Archived affiliate — restore in partner list":"Already an affiliate":business?"Business owner account":"Customer account"}</span>
            </span>
            {selectedNow?<Check className="mt-1 size-4 shrink-0 text-[#efbd5d]"/>:null}
          </button>;
        })}
    </div>
    <p className="break-words text-[11px] leading-4 text-white/35">Search results show only registered accounts. Private customer contact information stays hidden; selecting an account uses its internal ID securely.</p>
  </div>;
}
