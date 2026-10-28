"use client";
import {useCallback,useEffect,useState} from "react";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";
import {useAuth} from "@/components/auth/auth-guard";
import {apiFetch} from "@/lib/api";
import Link from "next/link";
import {useI18n} from "@/components/i18n/language-provider";
import {Gift,ChartNoAxesCombined,UsersRound,Tag,Megaphone,ArrowRight,ArrowLeft,CheckCircle2,Clock3,LockKeyhole} from "lucide-react";

const modules=[
 {key:"birthdays",name:"Birthdays",description:"Birthday rewards and celebrations",href:"/dashboard/birthdays",icon:Gift},
 {key:"analytics",name:"Analytics Pro",description:"Advanced customer and visit analytics",href:"/dashboard/analytics",icon:ChartNoAxesCombined},
 {key:"staff",name:"Staff Management",description:"Manage staff accounts and access",href:"/dashboard/staff",icon:UsersRound},
 {key:"offers",name:"Special Offers",description:"Create and manage customer offers",href:"/dashboard/offers",icon:Tag},
 {key:"campaigns",name:"Campaigns",description:"Marketing messages and automations",href:"/dashboard/campaigns",icon:Megaphone}
] as const;
type FeatureState=Record<string,string>;

export default function PremiumFeaturesPage(){
 const {token}=useAuth();
 const {t,language}=useI18n();
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
 const Arrow=language==="ar"?ArrowLeft:ArrowRight;
 return <DashboardShell activeItem="premium">
 <div className="loyvance-light-content relative isolate min-h-screen w-full bg-[#080907]">
 <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 sm:px-7 sm:pt-10">
   <header className="mb-8">
     <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#eab33e]">
       <span className="inline-flex size-[18px] items-center justify-center rounded-full border-2 border-[#eab33e]"><span className="size-1 rounded-full bg-[#eab33e]"/></span>
       {t("LOYVANCE BUSINESS")}
     </p>
     <h1 className="mt-4 text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold leading-tight tracking-[-.035em] text-white">{t("Request advanced features")}</h1>
     <p className="mt-2 text-sm leading-6 text-white/60">{t("These modules require administrator approval before they appear in your menu.")}</p>
   </header>
   {error?<p role="alert" className="mb-5 rounded-xl border border-red-400/35 bg-red-900/15 p-4 text-sm text-red-200">{t(error)}</p>:null}
   <div className="grid gap-5 md:grid-cols-2">
    {modules.map(m=>{
      const state=features[m.key]??"not_requested";
      const Icon=m.icon;
      const approved=state==="approved";
      return <section key={m.key} className="premium-feature-card group relative isolate min-h-[190px] overflow-hidden rounded-[23px] border border-[#9d752b]/50 bg-[#10100c] p-5 shadow-[inset_0_1px_0_rgba(255,217,122,.06),0_8px_26px_rgba(0,0,0,.22)] transition-colors hover:border-[#e3ae42]/70 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -end-12 -z-10 size-[230px] rounded-full bg-[#d49313]/25 blur-[55px]"/>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#f4bc3e]/65 to-[#f7c454]"/>
        <div className="flex h-full items-stretch justify-between gap-3">
          <div className="relative z-10 flex min-w-0 flex-1 flex-col items-start">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#d49b31]/30 bg-gradient-to-br from-[#352812] via-[#21190b] to-[#0b0b08] shadow-[inset_0_1px_8px_rgba(245,181,57,.08)]">
                <Icon size={29} strokeWidth={2.7} className="text-[#ffc244] drop-shadow-[0_2px_4px_rgba(236,157,19,.35)]"/>
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[17px] font-extrabold leading-6 text-white sm:text-[19px]">{t(m.name)}</h2>
                <p className="mt-0.5 text-[13px] leading-5 text-white/55">{t(m.description)}</p>
                <span className="mt-2 inline-flex rounded-full border border-[#f2bc48]/10 bg-[#e8b23b]/[.08] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#f4b52e]">
                  {loading?t("Loading…"):t(state)}
                </span>
              </div>
            </div>
            <div className="mt-auto pt-4 ps-4">
              {approved?
                <Link href={m.href} className="inline-flex min-h-10 items-center gap-3 rounded-full border border-[#e4a525] bg-[#f1b83f]/15 px-5 py-2 text-sm font-bold text-[#f9c04b] transition hover:bg-[#eab134]/25">
                  {t("Open feature")}<Arrow size={17} aria-hidden="true"/>
                </Link>:
                <button type="button" disabled={loading||state==="pending"||busy!==null} onClick={()=>void requestFeature(m.key)} className="inline-flex min-h-10 items-center gap-3 rounded-full border border-[#e4a525] bg-gradient-to-b from-[#493312]/60 to-[#21190e] px-5 py-2 text-sm font-bold text-[#f9c04b] shadow-[inset_0_1px_0_rgba(255,218,114,.14)] transition hover:border-[#ffcd54] hover:from-[#604315]/80 disabled:cursor-not-allowed disabled:opacity-55">
                  {state==="pending"?<Clock3 size={16}/>:state==="rejected"?<LockKeyhole size={16}/>:null}
                  {state==="pending"?t("Awaiting admin decision"):busy===m.key?t("Sending…"):state==="rejected"?t("Request again"):t("Request access")}
                  {state!=="pending"?<Arrow size={17} aria-hidden="true"/>:null}
                </button>}
            </div>
          </div>
          <div aria-hidden="true" className="relative hidden w-[112px] shrink-0 items-end justify-center self-stretch sm:flex">
             <div className="absolute bottom-0 size-[120px] rounded-full bg-[#e8a323]/15 blur-2xl"/>
             <Icon className="relative mb-2 size-[92px] rotate-[-12deg] text-[#eeb02d] opacity-80 drop-shadow-[0_12px_9px_rgba(0,0,0,.6)]" strokeWidth={1.7}/>
          </div>
        </div>
      </section>;
    })}
   </div>
 </div>
 </div>
 </DashboardShell>;
}
