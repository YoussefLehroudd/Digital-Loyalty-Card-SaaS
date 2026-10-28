"use client";
import {useCallback,useEffect,useState} from "react";
import {useAdmin} from "@/components/admin/admin-shell";
import {apiFetch} from "@/lib/api";
import {useI18n,getFormattingLocale} from "@/components/i18n/language-provider";
type RequestRow={business_id:string;business_name:string;feature:string;status:string;requested_at:string;reviewed_at:string|null};
export default function AdminPremiumRequests(){
 const {token}=useAdmin();
 const {t}=useI18n();
 const [rows,setRows]=useState<RequestRow[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
 try{const data=await apiFetch<{requests:RequestRow[]}>("/premium-admin",{token,cache:"no-store"});setRows(data.requests);setError("");}
 catch(e){setError(e instanceof Error?e.message:"Unable to load requests");}
 },[token]);
 useEffect(()=>{void refresh();},[refresh]);
 async function review(row:RequestRow,status:"approved"|"rejected"){
 const key=row.business_id+row.feature;setBusy(key);
 try{await apiFetch("/premium-admin",{token,method:"PATCH",body:JSON.stringify({business_id:row.business_id,feature:row.feature,status})});await refresh();}
 catch(e){setError(e instanceof Error?e.message:"Unable to save decision");}
 finally{setBusy(null);}
 }
 return <div className="mx-auto max-w-6xl space-y-6 p-5 text-white sm:p-8">
 <header><p className="text-xs font-bold uppercase tracking-widest text-[#edbc62]">{t("BUSINESS ACCESS CONTROL")}</p><h1 className="mt-2 text-3xl font-bold">{t("Premium feature requests")}</h1><p className="mt-2 text-sm text-white/60">{t("Approve or reject each module separately for each business. Revoking approval hides the module and blocks its API.")}</p></header>
 {error?<p role="alert" className="rounded-xl border border-rose-400/30 p-4 text-rose-300">{error}</p>:null}
 <button onClick={()=>void refresh()} className="rounded-xl border border-white/20 px-4 py-2 text-sm">{t("Refresh requests")}</button>
 <div className="space-y-3">{rows.length===0?<p className="rounded-xl border border-white/10 p-6 text-white/55">{t("No feature requests yet.")}</p>:rows.map(row=><section key={row.business_id+row.feature} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#edbc62]/20 bg-[#11130f] p-5"><div><h2 className="font-semibold">{row.business_name}</h2><p className="mt-1 text-sm text-white/60">{t(row.feature)} · {t(row.status)}</p><p className="mt-1 text-xs text-white/35">{t("Requested")} {new Date(row.requested_at).toLocaleDateString(getFormattingLocale())}</p></div><div className="flex gap-2"><button disabled={busy!==null||row.status==="approved"} onClick={()=>void review(row,"approved")} className="rounded-xl bg-[#edbc62] px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{t("Approve")}</button><button disabled={busy!==null||row.status==="rejected"} onClick={()=>void review(row,"rejected")} className="rounded-xl border border-red-400/40 px-4 py-2 text-sm text-red-200 disabled:opacity-40">{t("Reject / Revoke")}</button></div></section>)}</div>
 </div>;
}