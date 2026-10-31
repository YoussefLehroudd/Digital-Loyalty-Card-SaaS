"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/admin-shell";
import { apiFetch } from "@/lib/api";
import { useI18n, getFormattingLocale } from "@/components/i18n/language-provider";
import { isPremiumPending, premiumKey, notifyPremiumDecision, type PremiumApprovalRequest } from "@/lib/premium-approval-live";
type RequestsResponse = { requests:PremiumApprovalRequest[] };
export default function AdminPremiumRequests(){
  const {token}=useAdmin();
  const {t}=useI18n();
  const [rows,setRows]=useState<PremiumApprovalRequest[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [lastChecked,setLastChecked]=useState<Date|null>(null);
  const active=useRef<AbortController|null>(null);
  const decided=useRef<Map<string,"approved"|"rejected">>(new Map());
  const refresh=useCallback(async()=>{
    if (document.hidden || active.current) return;
    const ctrl=new AbortController();
    active.current=ctrl;
    try {
      const result=await apiFetch<RequestsResponse>("/premium-admin",{token,signal:ctrl.signal,cache:"no-store"});
      if(ctrl.signal.aborted)return;
      const effective=(Array.isArray(result.requests)?result.requests:[]).map(row=>{
        const key=premiumKey(row), status=decided.current.get(key);
        if(!status)return row;
        if(row.status.toLowerCase()===status){decided.current.delete(key);return row;}
        return {...row,status};
      });
      setRows(effective);
      setError("");
      setLastChecked(new Date());
    }catch(e){
      if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:"Unable to load requests");
    }finally {
      if(active.current===ctrl)active.current=null;
      if(!ctrl.signal.aborted)setLoading(false);
    }
  },[token]);
  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},4000);
    const wake=()=>{if(!document.hidden)void refresh();};
    window.addEventListener("focus",wake);
    document.addEventListener("visibilitychange",wake);
    return()=>{
      active.current?.abort();
      active.current=null;
      window.clearInterval(timer);
      window.removeEventListener("focus",wake);
      document.removeEventListener("visibilitychange",wake);
    };
  },[refresh]);
  async function review(row:PremiumApprovalRequest,status:"approved"|"rejected"){
    const key=premiumKey(row);
    if(busy)return;
    setBusy(key);
    setError("");
    try{
      await apiFetch("/premium-admin",{token,method:"PATCH",body:JSON.stringify({business_id:row.business_id,feature:row.feature,status})});
      decided.current.set(key,status);
      active.current?.abort();
      active.current=null;
      setRows(prev=>prev.map(item=>premiumKey(item)===key?{...item,status}:item));
      if(isPremiumPending(row)) notifyPremiumDecision({business_id:row.business_id,feature:row.feature,requested_at:row.requested_at,status});
      void refresh();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save decision");}
    finally{setBusy(null);}
  }
  const pending=rows.filter(isPremiumPending);
  const reviewed=rows.filter(item=>!isPremiumPending(item));
  function renderRow(row:PremiumApprovalRequest){
    const key=premiumKey(row);
    const waiting=isPremiumPending(row);
    return <section key={key} className="admin-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#edbc62]/20 bg-[#11130f] p-5">
      <div className="min-w-0">
        <h3 className="font-semibold">{row.business_name}</h3>
        <p className="mt-1 text-sm text-white/60">{t(row.feature)} · {t(row.status)}</p>
        <p className="mt-1 text-xs text-white/35">{t("Requested")} {new Date(row.requested_at).toLocaleDateString(getFormattingLocale())}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy!==null||row.status==="approved"} onClick={()=>void review(row,"approved")} className="rounded-xl bg-[#edbc62] px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{busy===key?t("Saving…"):t("Approve")}</button>
        <button disabled={busy!==null||row.status==="rejected"} onClick={()=>void review(row,"rejected")} className="rounded-xl border border-red-400/40 px-4 py-2 text-sm text-red-200 disabled:opacity-40">{t(waiting?"Reject":"Reject / Revoke")}</button>
      </div>
    </section>;
  }
  return <div className="admin-premium mx-auto max-w-6xl space-y-6 p-5 text-white sm:p-8">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#edbc62]">{t("BUSINESS ACCESS CONTROL")}</p>
      <h1 className="mt-2 text-3xl font-bold">{t("Premium feature requests")}</h1>
      <p className="mt-2 text-sm text-white/60">{t("Approve or reject each module separately for each business. Revoking approval hides the module and blocks its API.")}</p>
      <p role="status" className="mt-2 text-xs text-white/50">{t("Requests update automatically.")} {lastChecked ? t("Last checked")+": "+lastChecked.toLocaleTimeString(getFormattingLocale()):null}</p>
    </header>
    {error?<p role="alert" className="rounded-xl border border-rose-400/30 p-4 text-rose-300">{t(error)}</p>:null}
    <button onClick={()=>void refresh()} className="rounded-xl border border-white/20 px-4 py-2 text-sm">{t("Refresh requests")}</button>
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t("Pending requests")} ({pending.length})</h2>
      {loading&&!rows.length?<p className="text-sm text-white/60">{t("Loading requests…")}</p>:pending.length===0?<p className="rounded-xl border border-white/10 p-6 text-white/55">{t("No pending requests.")}</p>:pending.map(renderRow)}
    </div>
    {reviewed.length?<div className="space-y-3"><h2 className="text-base font-semibold">{t("Reviewed requests")}</h2>{reviewed.map(renderRow)}</div>:null}
  </div>;
}
