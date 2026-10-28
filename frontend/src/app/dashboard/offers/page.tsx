"use client";
import {useI18n} from "@/components/i18n/language-provider";
import { useCallback,useEffect,useState,type FormEvent } from "react";
import { CalendarDays, Gift, Loader2, Plus, RefreshCcw, ToggleLeft, ToggleRight, Trash2, Zap } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/components/auth/auth-guard";
import { apiFetch } from "@/lib/api";

type Offer={id:string;title:string;description:string;kind:"weekday_double"|"first_visit_double";weekday:number|null;starts_at:string;ends_at:string;max_uses:number;uses_count:number;is_active:boolean};
const weekdays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const field="w-full rounded-xl border border-white/15 bg-[#090b09] px-3 py-3 text-sm text-white outline-none focus:border-[#e7b354]/60";
const formatDate=(date:string)=>new Date(date).toLocaleString("fr-MA",{dateStyle:"medium",timeStyle:"short"});
export default function SpecialOffersPage(){
 const {token}=useAuth();
 const {t:trI18n}=useI18n();
 const [offers,setOffers]=useState<Offer[]>([]);
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [kind,setKind]=useState<Offer["kind"]>("weekday_double");
 const [weekday,setWeekday]=useState(2);
 const [startsAt,setStartsAt]=useState("");
 const [endsAt,setEndsAt]=useState("");
 const [limit,setLimit]=useState(50);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  try{const data=await apiFetch<{offers:Offer[]}>("/special-offers/business",{token,cache:"no-store"});setOffers(data.offers);setError("");}
  catch(e){setError(e instanceof Error?e.message:"Unable to load offers.");}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void load();},[load]);
 const create=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const start=new Date(startsAt),end=new Date(endsAt);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw Error("Choose a valid start and end date.");
   await apiFetch("/special-offers/business",{token,method:"POST",body:JSON.stringify({title,description,kind,weekday:kind==="weekday_double"?weekday:null,starts_at:start.toISOString(),ends_at:end.toISOString(),max_uses:limit})});
   setTitle("");setDescription("");setStartsAt("");setEndsAt("");setNotice("Offer created. Eligible customer visits will automatically receive ×2 stamps.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not create offer.");}finally{setBusy(false);}
 };
 const change=async(offer:Offer,mode:"toggle"|"delete")=>{
  if(busy)return;
  if(mode==="delete"&&!window.confirm("Deactivate this offer? Existing bonus stamps will not be removed."))return;
  setBusy(true);setError("");setNotice("");
  try{
   await apiFetch("/special-offers/business/"+offer.id,{token,method:mode==="delete"?"DELETE":"PATCH",...(mode==="toggle"?{body:JSON.stringify({is_active:!offer.is_active})}:{})});
   setNotice(mode==="delete"?"Offer deactivated.":"Offer status updated.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Action failed.");}finally{setBusy(false);}
 };
 return <DashboardShell activeItem="offers"><div className="mx-auto max-w-6xl space-y-5 px-3 pb-16 pt-6 sm:px-6 lg:px-8">
  <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e7b354]">{trI18n("LOYALTY BOOSTERS")}</p><h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-white"><Gift className="size-7 text-[#e7b354]"/>{trI18n("Special Offers & Double Stamps")}</h1><p className="mt-2 text-sm text-white/55">Offer double stamps on a weekday or on a customer&apos;s first visit. Limits are enforced on each stamp transaction.</p></div><button className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm" onClick={()=>void load()}><RefreshCcw className="size-4"/>{trI18n("Refresh")}</button></header>
  {error?<p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>:null}
  {notice?<p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>:null}
  <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
   <section className="h-fit rounded-2xl border border-[#e7b354]/15 bg-[#11130f] p-4 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><Plus className="size-5 text-[#e7b354]"/>{trI18n("Create a special offer")}</h2>
    <form onSubmit={e=>void create(e)} className="mt-5 space-y-4">
     <label className="block space-y-1.5 text-xs text-white/70">{trI18n("Offer name")}<input className={field} required minLength={3} maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Double stamps Tuesday"/></label>
     <label className="block space-y-1.5 text-xs text-white/70">Description<textarea className={field} rows={2} maxLength={300} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Collect ×2 stamps during the offer period."/></label>
     <label className="block space-y-1.5 text-xs text-white/70">{trI18n("Offer type")}<select className={field} value={kind} onChange={e=>setKind(e.target.value as Offer["kind"])}><option value="weekday_double">Double stamps on selected weekday</option><option value="first_visit_double">Double stamps on first visit only</option></select></label>
     {kind==="weekday_double"?<label className="block space-y-1.5 text-xs text-white/70">Day of week<select className={field} value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{weekdays.map((day,i)=><option key={day} value={i}>{day}</option>)}</select></label>:<p className="rounded-xl bg-[#e7b354]/10 p-3 text-xs text-[#e7b354]">First-visit bonus applies only if this customer has never had a recorded visit to your business.</p>}
     <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5 text-xs text-white/70">Start date & time<input type="datetime-local" className={field} required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label><label className="block space-y-1.5 text-xs text-white/70">Expiry date & time<input type="datetime-local" className={field} required value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label></div>
     <label className="block space-y-1.5 text-xs text-white/70">Maximum uses<input type="number" className={field} min={1} max={5000} value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label>
     <p className="text-xs leading-5 text-white/50">Only one offer applies per visit. A double-stamp bonus is applied only when it fits the remaining stamps on the loyalty card; otherwise normal stamps apply. Times follow Morocco&apos;s local time when choosing weekdays.</p>
     <button type="submit" disabled={busy||!title.trim()||!startsAt||!endsAt} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#eec05f] px-4 py-3 text-sm font-bold text-[#15120b] disabled:opacity-50">{busy?<Loader2 className="size-4 animate-spin"/>:<Zap className="size-4"/>}Create offer</button>
    </form>
   </section>
   <section className="rounded-2xl border border-[#e7b354]/15 bg-[#11130f] p-4 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-5 text-[#e7b354]"/>{trI18n("Offer history")}</h2>
    {loading?<p className="mt-5 text-sm text-white/50">{trI18n("Loading offers…")}</p>:offers.length===0?<p className="mt-5 text-sm text-white/50">{trI18n("No offers yet.")}</p>:<div className="mt-4 max-h-[670px] space-y-3 overflow-y-auto">{offers.map(o=><article key={o.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{o.title}</h3><p className="mt-1 text-xs text-white/45">{o.kind==="weekday_double"?(weekdays[o.weekday??2]+" · Double stamps"):"First visit · Double stamps"}</p></div><span className={"rounded-full px-2.5 py-1 text-xs "+(o.is_active&&new Date(o.ends_at)>new Date()&&o.uses_count<o.max_uses?"bg-emerald-400/10 text-emerald-300":"bg-white/10 text-white/50")}>{o.is_active&&new Date(o.ends_at)>new Date()&&o.uses_count<o.max_uses?"Active":"Inactive / ended"}</span></div>
      {o.description?<p className="mt-2 break-words text-sm text-white/65">{o.description}</p>:null}
      <p className="mt-3 text-xs text-white/50">{formatDate(o.starts_at)} – {formatDate(o.ends_at)}</p>
      <p className="mt-2 text-xs font-semibold text-[#e7b354]">{o.uses_count} / {o.max_uses} uses</p>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3"><button disabled={busy} onClick={()=>void change(o,"toggle")} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80">{o.is_active?<ToggleRight className="size-4"/>:<ToggleLeft className="size-4"/>}{o.is_active?"Pause":"Enable"}</button><button disabled={busy} onClick={()=>void change(o,"delete")} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300"><Trash2 className="size-4"/>Deactivate</button></div>
     </article>)}</div>}
   </section>
  </div>
 </div></DashboardShell>;
}
