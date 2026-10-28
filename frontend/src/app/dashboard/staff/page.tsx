"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {UserCog,UserPlus,History,RefreshCcw,Loader2,ShieldCheck,ShieldOff,ScanLine} from "lucide-react";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";
import {useAuth} from "@/components/auth/auth-guard";
import {apiFetch} from "@/lib/api";
type Staff={id:string;name:string;email:string;active:boolean;created_at:string};
type Activity={id:string;created_at:string;stamp_count:number;customer_name:string;actor_name:string;actor_role:string;order_reference:string|null};
const input="w-full rounded-xl border border-white/15 bg-[#090b09] px-3 py-2.5 text-sm text-white outline-none focus:border-[#e7b354]/60";
const button="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-xs text-white/80 transition hover:bg-white/5 disabled:opacity-50";
const time=(date:string)=>new Date(date).toLocaleString("fr-MA",{dateStyle:"medium",timeStyle:"short"});
export default function StaffManagement(){
 const {token}=useAuth();
 const {t:trI18n}=useI18n();
 const [staff,setStaff]=useState<Staff[]>([]),[history,setHistory]=useState<Activity[]>([]);
 const [page,setPage]=useState(0),[hasMore,setHasMore]=useState(false);
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[success,setSuccess]=useState("");
 const load=useCallback(async(pageNumber=0)=>{
  try{
   const [people,visits]=await Promise.all([
    apiFetch<{staff:Staff[]}>("/staff",{token,cache:"no-store"}),
    apiFetch<{history:Activity[];has_more:boolean}>("/staff/history?page="+pageNumber,{token,cache:"no-store"})
   ]);
   setStaff(people.staff);setHistory(visits.history);setPage(pageNumber);setHasMore(visits.has_more);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load staff records.");}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void load();},[load]);
 const create=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError("");setSuccess("");
  try{
   await apiFetch("/staff",{token,method:"POST",body:JSON.stringify({name:name.trim(),email:email.trim(),password})});
   setName("");setEmail("");setPassword("");
   setSuccess("Cashier created. Share the temporary password securely and ask them to sign in at /login.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to create cashier.");}
  finally{setBusy(false);}
 };
 const change=async(person:Staff)=>{
  if(busy)return;
  if(person.active&&!window.confirm("Disable "+person.name+"? Their active sessions will be revoked immediately."))return;
  setBusy(true);setError("");setSuccess("");
  try{
   await apiFetch("/staff/"+person.id,{token,method:"PATCH",body:JSON.stringify({active:!person.active})});
   setSuccess(person.active?"Cashier disabled and sessions revoked.":"Cashier access restored.");
   await load(page);
  }catch(e){setError(e instanceof Error?e.message:"Could not change cashier status.");}
  finally{setBusy(false);}
 };
 return <DashboardShell activeItem="staff">
  <div className="mx-auto max-w-[1250px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
   <div className="flex flex-wrap items-center justify-between gap-3"><div>
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e7b354]">{trI18n("TEAM ACCESS")}</p>
    <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold"><UserCog className="size-7 text-[#e7b354]"/>Staff Management</h1>
    <p className="mt-2 text-sm text-white/55">Cashiers can scan your customers’ QR cards and add stamps. They cannot change business settings, rewards or staff accounts.</p>
   </div><button className={button} onClick={()=>void load(page)}><RefreshCcw className="size-4"/>{trI18n("Refresh")}</button></div>
   {error?<div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>:null}
   {success?<div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</div>:null}
   <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <section className="rounded-2xl border border-[#e7b354]/20 bg-[#11130f] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="size-5 text-[#e7b354]"/>{trI18n("Add a cashier")}</h2>
     <form className="mt-5 space-y-4" onSubmit={e=>void create(e)}>
      <label className="block space-y-1.5 text-xs text-white/70">{trI18n("Employee name")}<input required minLength={2} maxLength={100} className={input} placeholder="Cashier name" value={name} onChange={e=>setName(e.target.value)}/></label>
      <label className="block space-y-1.5 text-xs text-white/70">{trI18n("Login email")}<input required type="email" autoComplete="off" className={input} placeholder="cashier@shop.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label className="block space-y-1.5 text-xs text-white/70">{trI18n("Initial password (12+ characters)")}<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" className={input} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <p className="text-xs leading-5 text-white/50">Each cashier has an individual login. Never share the owner password. Deactivation revokes that cashier’s sessions without deleting their stamp history.</p>
      <button disabled={busy||password.length<12||name.trim().length<2||!email.includes("@")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#eec05f] px-4 py-3 text-sm font-bold text-[#12100a] disabled:opacity-50" type="submit">{busy?<Loader2 className="size-4 animate-spin"/>:<UserPlus className="size-4"/>}Create cashier</button>
     </form>
    </section>
    <section className="rounded-2xl border border-[#e7b354]/20 bg-[#11130f] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-[#e7b354]"/>Cashiers <span className="ms-auto text-xs font-normal text-white/50">{staff.filter(s=>s.active).length} active</span></h2>
     {loading?<p className="mt-5 text-sm text-white/50">{trI18n("Loading staff…")}</p>:staff.length===0?<p className="mt-5 text-sm text-white/50">{trI18n("No staff accounts. Create your first cashier.")}</p>:
     <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">{staff.map(person=><article key={person.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{person.name}</p><p className="mt-1 break-words text-xs text-white/50">{person.email}</p><p className="mt-1 text-[11px] text-white/45">Added {time(person.created_at)}</p></div><span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold "+(person.active?"bg-emerald-400/10 text-emerald-300":"bg-white/10 text-white/60")}>{person.active?"Active":"Disabled"}</span></div>
      <button type="button" className={button+" mt-3"} disabled={busy} onClick={()=>void change(person)}>{person.active?<ShieldOff className="size-4"/>:<ShieldCheck className="size-4"/>}{person.active?"Disable access":"Reactivate"}</button>
     </article>)}</div>}
    </section>
   </div>
   <section className="rounded-2xl border border-[#e7b354]/20 bg-[#11130f] p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><History className="size-5 text-[#e7b354]"/>{trI18n("Stamp activity history")}</h2><p className="mt-1 text-xs text-white/50">Who added stamps, when, and for which customer. Includes owner actions and disabled employees.</p></div><span className="rounded-full bg-[#e7b354]/10 px-3 py-1 text-xs text-[#e7b354]">Page {page+1}</span></div>
    {loading?<p className="mt-4 text-sm text-white/50">Loading activity…</p>:history.length===0?<p className="mt-4 text-sm text-white/50">No stamps recorded yet.</p>:<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-white/10 text-white/50"><tr><th className="px-3 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">Cashier / Owner</th><th className="px-3 py-3 font-semibold">Customer</th><th className="px-3 py-3 font-semibold">Stamps</th><th className="px-3 py-3 font-semibold">Order</th></tr></thead><tbody>{history.map(item=><tr key={item.id} className="border-b border-white/5"><td className="px-3 py-3 text-white/60">{time(item.created_at)}</td><td className="px-3 py-3"><span className="font-semibold">{item.actor_name}</span><span className="ms-1 text-white/40">({item.actor_role})</span></td><td className="px-3 py-3">{item.customer_name}</td><td className="px-3 py-3 font-bold text-[#e7b354]">+{item.stamp_count}</td><td className="px-3 py-3 text-white/45">{item.order_reference??"—"}</td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-[11px] text-white/45"><ScanLine className="size-4"/>Recent 50 operations per page</p><div className="flex gap-2"><button className={button} disabled={loading||page===0} onClick={()=>void load(page-1)}>Previous</button><button className={button} disabled={loading||!hasMore} onClick={()=>void load(page+1)}>Next</button></div></div>
   </section>
  </div>
 </DashboardShell>;
}