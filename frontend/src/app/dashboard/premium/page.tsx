"use client";
import {useCallback,useEffect,useState} from "react";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";
import {useAuth} from "@/components/auth/auth-guard";
import {apiFetch} from "@/lib/api";
import Link from "next/link";
import {useI18n} from "@/components/i18n/language-provider";
const modules=[
 {key:"birthdays",name:"Birthdays",description:"Birthday rewards and celebrations",href:"/dashboard/birthdays"},
 {key:"analytics",name:"Analytics Pro",description:"Advanced customer and visit analytics",href:"/dashboard/analytics"},
 {key:"staff",name:"Staff Management",description:"Manage staff accounts and access",href:"/dashboard/staff"},
 {key:"offers",name:"Special Offers",description:"Create and manage customer offers",href:"/dashboard/offers"},
 {key:"campaigns",name:"Campaigns",description:"Marketing messages and automations",href:"/dashboard/campaigns"}
] as const;
type FeatureState=Record<string,string>;
export default function PremiumFeaturesPage(){
 const {token}=useAuth();
 const {t}=useI18n();
 const [features,setFeatures]=useState<FeatureState>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
   try{const data=await apiFetch<{features:FeatureState}>("/premium-features",{token,cache:"no-store"});setFeatures(data.features);setError("");}
   catch(e){setError(e instanceof Error?e.message:"Could not load approvals");}
   finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void refresh();},[refresh]);
 async function requestFeature(feature:string){
  setBusy(feature);
  try{const data=await apiFetch<{features:FeatureState}>("/premium-features",{token,method:"POST",body:JSON.stringify({feature})});setFeatures(data.features);setError("");}
  catch(e){setError(e instanceof Error?e.message:"Request failed");}
  finally{setBusy(null);}
 }
 return <DashboardShell activeItem="premium"><div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-7">
 <header><p className="text-xs font-bold uppercase tracking-widest text-[#e7b354]">{t("LOYVANCE BUSINESS")}</p><h1 className="mt-2 text-3xl font-bold">{t("Request advanced features")}</h1><p className="mt-2 text-sm text-white/60">{t("These modules require administrator approval before they appear in your menu.")}</p></header>
 {error?<p role="alert" className="rounded-xl border border-red-400/30 p-3 text-red-200">{t(error)}</p>:null}
 <div className="grid gap-4 md:grid-cols-2">{modules.map(m=>{const state=features[m.key]??"not_requested";return <section key={m.key} className="rounded-2xl border border-[#e7b354]/20 bg-[#12130f] p-6"><h2 className="text-lg font-bold">{t(m.name)}</h2><p className="mt-2 text-sm text-white/55">{t(m.description)}</p><p className="mt-4 text-xs uppercase tracking-wider text-[#e7b354]">{loading?t("Loading…"):t(state)}</p><div className="mt-4">{state==="approved"?<Link href={m.href} className="inline-flex rounded-xl bg-[#e7b354] px-4 py-2.5 font-semibold text-black">{t("Open feature")}</Link>:<button disabled={loading||state==="pending"||busy!==null} onClick={()=>void requestFeature(m.key)} className="rounded-xl border border-[#e7b354]/45 px-4 py-2.5 text-sm font-semibold text-[#e7b354] disabled:opacity-40">{state==="pending"?t("Awaiting admin decision"):busy===m.key?t("Sending…"):state==="rejected"?t("Request again"):t("Request access")}</button>}</div></section>})}</div></div></DashboardShell>;
}