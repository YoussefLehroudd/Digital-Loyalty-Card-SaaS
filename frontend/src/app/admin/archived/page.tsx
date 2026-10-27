"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, Building2, CheckCircle2, Clock3, Handshake, Loader2, RefreshCcw, Search, ShieldCheck, Users, X } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-shell";
import { adminRequest } from "@/lib/admin";

type Kind="all"|"business"|"customer"|"affiliate";
type ArchivedItem={
 id:string;type:Exclude<Kind,"all">;name:string;email:string|null;
 changed_at:string;created_at:string;state:"Suspended"|"Archived";related_count:number;
};
type ArchivedReport={
 data:ArchivedItem[];total:number;page:number;per_page:number;
 counts:{business:number;customer:number;affiliate:number};
};
const card="min-w-0 rounded-2xl border border-white/10 bg-[#101318] p-4 sm:p-5";
const categories=[
 {id:"all" as Kind,name:"All recoverable",icon:ArchiveRestore},
 {id:"business" as Kind,name:"Businesses",icon:Building2},
 {id:"customer" as Kind,name:"Customers",icon:Users},
 {id:"affiliate" as Kind,name:"Affiliates",icon:Handshake},
];
const describe=(item:ArchivedItem)=>item.type==="affiliate"
 ? "Restoring this partner re-enables affiliate access and their existing referral link. Commissions, referred businesses and payout records remain unchanged."
 : item.type==="business"
 ? "Reactivating this business restores access for its owner and keeps loyalty cards, rewards and transaction records. Expired subscriptions must still be renewed."
 : "Reactivating this customer restores account access and keeps their loyalty cards, stamps and reward history.";
const related=(item:ArchivedItem)=>item.type==="affiliate"?"referred businesses":item.type==="business"?"loyalty cards":"business cards";
const origin=(item:ArchivedItem)=>item.type==="affiliate"?"/admin/affiliates":item.type==="business"?"/admin/businesses":"/admin/customers";
function date(value:string){
 try{return new Date(value).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
 catch{return value;}
}
export default function ArchivedAdminPage(){
 const {token}=useAdmin();
 const [kind,setKind]=useState<Kind>("all");
 const [search,setSearch]=useState("");
 const [query,setQuery]=useState("");
 const [page,setPage]=useState(1);
 const [report,setReport]=useState<ArchivedReport|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [pending,setPending]=useState<ArchivedItem|null>(null);
 const [working,setWorking]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const timer=window.setTimeout(()=>{setQuery(search.trim());setPage(1);},250);
  return()=>window.clearTimeout(timer);
 },[search]);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);
  const params=new URLSearchParams({type:kind,page:String(page)});
  if(query)params.set("q",query);
  void adminRequest<ArchivedReport>("archived?"+params.toString(),token,{signal:controller.signal,cache:"no-store"})
   .then(result=>{if(!controller.signal.aborted){setReport(result);setError("");}})
   .catch(cause=>{if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"Could not load the archived directory.");}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[token,kind,query,page,revision]);
 const totalPages=Math.max(1,Math.ceil((report?.total||0)/25));
 const counts=report?.counts;
 const totalRecoverable=counts?(counts.business+counts.customer+counts.affiliate):0;
 async function restore(){
  if(!pending||working)return;
  setWorking(true);setError("");setMessage("");
  try{
   if(pending.type==="affiliate"){
    await adminRequest(`affiliates/${pending.id}/restore`,token,{method:"POST"});
   }else{
    await adminRequest(`${pending.type==="business"?"businesses":"customers"}/${pending.id}`,token,{
     method:"PATCH",body:JSON.stringify({status:"active",reason:"Restored from central Archived workspace"})
    });
   }
   setMessage(`${pending.name} was restored successfully.`);
   setPending(null);
   setRevision(v=>v+1);
  }catch(e){
   setError(e instanceof Error?e.message:"Unable to restore this account.");
  }finally{setWorking(false);}
 }
 const items=report?.data||[];
 return <div className="min-w-0 space-y-5 text-white">
  <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
   <div className="min-w-0">
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#edbc62]"><ArchiveRestore className="size-4"/>Platform recovery</p>
    <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Archived & recoverable</h1>
    <p className="mt-2 max-w-2xl text-xs leading-6 text-white/50 sm:text-sm">Restore archived affiliate partners and suspended business or customer accounts in one place. Existing data stays intact.</p>
   </div>
   <button type="button" onClick={()=>setRevision(v=>v+1)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-[#edbc62] hover:bg-white/5 disabled:opacity-40"><RefreshCcw className={`size-4 ${loading?"animate-spin":""}`}/>Refresh</button>
  </div>

  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {categories.map(option=>{
    const Icon=option.icon;
    const count=option.id==="all"?totalRecoverable:counts?.[option.id]??0;
    return <button type="button" key={option.id} onClick={()=>{setKind(option.id);setPage(1);setMessage("");}}
      aria-pressed={kind===option.id}
      className={`min-w-0 rounded-xl border p-3 text-left transition sm:p-4 ${kind===option.id?"border-[#edbc62]/55 bg-[#edbc62]/10":"border-white/10 bg-[#101318] hover:border-[#edbc62]/30"}`}>
      <div className="flex items-center justify-between gap-2"><Icon className={`size-5 ${kind===option.id?"text-[#edbc62]":"text-white/45"}`}/><span className="text-lg font-bold tabular-nums text-white">{count}</span></div>
      <p className="mt-2 truncate text-xs font-semibold text-white/75 sm:text-sm">{option.name}</p>
    </button>;
   })}
  </div>

  <div className="rounded-xl border border-amber-400/15 bg-amber-400/[.04] px-4 py-3 text-xs leading-6 text-white/55">
   <ShieldCheck className="me-2 inline size-4 text-[#edbc62]"/>
   Affiliates are <strong className="text-white/75">archived</strong>; businesses and customers listed here are <strong className="text-white/75">suspended</strong>. Both are recoverable. Accounts permanently deleted in the past cannot be restored from this page.
  </div>

  <section className={card}>
   <label className="relative block min-w-0">
    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-white/40"/>
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or visible email..." aria-label="Search archived and suspended accounts"
      className="min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#0b0e12] ps-10 pe-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#edbc62]/55"/>
    {search&&<button type="button" onClick={()=>setSearch("")} aria-label="Clear search" className="absolute end-3 top-1/2 -translate-y-1/2 text-white/50"><X className="size-4"/></button>}
   </label>
   {error&&<p role="alert" className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
   {message&&<p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"><CheckCircle2 className="size-4 shrink-0"/>{message}</p>}
   <div className="mt-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{kind==="all"?"All recoverable accounts":categories.find(item=>item.id===kind)?.name}</h2><span className="text-xs text-white/40">{report?.total??0} results</span></div>
   {loading?<div className="flex min-h-44 items-center justify-center gap-2 text-xs text-white/50"><Loader2 className="size-4 animate-spin"/>Loading recoverable records...</div>:
     items.length?<div className="mt-3 space-y-2">{items.map(item=>{
      const Icon=item.type==="business"?Building2:item.type==="customer"?Users:Handshake;
      return <article key={item.type+item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
       <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#edbc62]/[.06]"><Icon className="size-4 text-[#edbc62]"/></span>
        <div className="min-w-0">
         <h3 className="break-words text-sm font-semibold">{item.name}</h3>
         {item.email?<p className="mt-0.5 break-all text-[11px] text-white/50">{item.email}</p>:null}
         <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-white/45">
          <span className="capitalize">{item.type}</span><span>·</span>
          <span className="text-amber-300">{item.state}</span><span>·</span>
          <Clock3 className="size-3"/>{date(item.changed_at)}
         </p>
         <p className="mt-1 text-[11px] text-white/35">{item.related_count} {related(item)} retained</p>
        </div>
       </div>
       <div className="flex shrink-0 items-center gap-2 ps-[52px] sm:ps-0">
        <Link href={origin(item)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-3 text-xs text-white/65 hover:text-white">Directory</Link>
        <button type="button" onClick={()=>setPending(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#edbc62] px-4 text-xs font-bold text-[#11120e] transition hover:bg-[#f5cd80]"><ArchiveRestore className="size-4"/>Restore</button>
       </div>
      </article>;
     })}</div>:
     <div className="mt-4 rounded-xl border border-dashed border-white/10 py-12 text-center"><ArchiveRestore className="mx-auto size-7 text-[#edbc62]/60"/><p className="mt-3 text-sm font-semibold text-white/70">Nothing recoverable in this view</p><p className="mt-1 text-xs text-white/40">Try another filter or search.</p></div>}
   <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
    <p className="text-[11px] text-white/40">Page {report?.page||page} of {totalPages}</p>
    <div className="flex gap-2">
     <button type="button" disabled={loading||page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 disabled:opacity-30">Previous</button>
     <button type="button" disabled={loading||page>=totalPages} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 disabled:opacity-30">Next</button>
    </div>
   </div>
  </section>

  {pending&&<div role="dialog" aria-modal="true" aria-label="Confirm restoration" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={()=>{if(!working)setPending(null);}}>
   <div className="w-full max-w-md rounded-t-2xl border border-white/15 bg-[#11151a] p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={e=>e.stopPropagation()}>
    <div className="flex items-start justify-between gap-3"><div><ArchiveRestore className="mb-2 size-7 text-[#edbc62]"/><h2 className="text-lg font-semibold">Restore {pending.name}?</h2></div><button type="button" aria-label="Cancel" disabled={working} onClick={()=>setPending(null)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 text-white/55"><X className="size-4"/></button></div>
    <p className="mt-3 text-sm leading-6 text-white/55">{describe(pending)}</p>
    <p className="mt-3 text-xs text-white/40">This only restores access and does not undo an expired subscription or alter previous financial transactions.</p>
    <div className="mt-5 flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
     <button type="button" disabled={working} onClick={()=>setPending(null)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm text-white/70 disabled:opacity-40">Cancel</button>
     <button type="button" disabled={working} onClick={()=>void restore()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#edbc62] px-5 text-sm font-bold text-black disabled:opacity-50">{working?<Loader2 className="size-4 animate-spin"/>:<ArchiveRestore className="size-4"/>}Confirm restoration</button>
    </div>
   </div>
  </div>}
 </div>;
}
