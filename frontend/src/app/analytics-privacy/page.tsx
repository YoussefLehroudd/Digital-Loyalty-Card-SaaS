"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const key="loyvance.analytics.optout";
export default function VisitorPrivacyPage(){
 const [disabled,setDisabled]=useState<boolean|null>(null);
 useEffect(()=>{try{setDisabled(localStorage.getItem(key)==="1");}catch{setDisabled(true);}},[]);
 function toggle(){
  try{const next=!disabled;localStorage.setItem(key,next?"1":"0");setDisabled(next);window.location.reload();}
  catch{setDisabled(true);}
 }
 return <main className="min-h-dvh bg-[#0a0d11] px-4 py-12 text-white sm:px-6">
  <div className="mx-auto max-w-2xl space-y-6">
   <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#efbd5d]"><ArrowLeft className="size-4"/>Back to LOYVANCE</Link>
   <div className="rounded-2xl border border-white/10 bg-[#101419] p-5 sm:p-8">
    <ShieldCheck className="mb-4 size-9 text-[#efbd5d]"/>
    <h1 className="text-2xl font-bold">Visitor analytics & privacy</h1>
    <p className="mt-4 text-sm leading-7 text-white/70">LOYVANCE uses first-party analytics to understand website visits and improve the experience. These measurements include the pages visited, links clicked, approximate time spent while the tab is active, referral source, device/browser category and approximate country/region/city inferred from hosting-network information.</p>
    <p className="mt-4 text-sm leading-7 text-white/70">We do not request GPS location, capture your typing, store URL search parameters, or keep raw IP addresses in our analytics tables. City estimates may be missing or inaccurate. Sessions are anonymous unless a visitor is signed in, in which case their visits may be associated with that account for the platform administrator. Analytics are visible only to authorized platform administrators.</p>
    <p className="mt-4 text-sm leading-7 text-white/70">If you open a public marketing link containing a campaign reference (for example, ?ref=salon01), we record only its validated campaign code and aggregate visits for that campaign. We do not record the rest of the URL query string or use the code to identify an individual. A campaign visit cannot prove which recipient opened a message.</p>
    <p className="mt-4 text-sm leading-7 text-white/70">A random, per-tab session identifier is kept in browser session storage. Analytics records are retained for up to 90 days and are purged when the reporting dashboard runs. Browser Global Privacy Control and Do Not Track preferences are respected.</p>
    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
     <p className="text-sm font-semibold">Optional visitor analytics</p>
     <p className="mt-1 text-xs leading-6 text-white/55">You can stop future analytics from this browser. Previously collected data is not automatically erased by this switch.</p>
     <button type="button" disabled={disabled===null} onClick={toggle}
       className="mt-4 rounded-xl border border-[#efbd5d]/50 bg-[#efbd5d]/10 px-4 py-3 text-sm font-bold text-[#efbd5d] transition hover:bg-[#efbd5d]/20 disabled:opacity-40">
      {disabled===null?"Loading preference...":disabled?"Enable analytics on this browser":"Disable analytics on this browser"}
     </button>
    </div>
   </div>
  </div>
 </main>;
}
