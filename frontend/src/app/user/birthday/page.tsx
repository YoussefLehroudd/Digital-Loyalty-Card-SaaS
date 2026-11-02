"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useEffect,useState} from "react";
import {Cake,Save,ShieldCheck} from "lucide-react";
import {CustomerLayout} from "@/components/customer-app/customer-layout";
import {useCustomerAuth} from "@/components/customer-app/customer-auth-provider";
import {apiFetch} from "@/lib/api";
export default function BirthdayPreferences(){
 const {t}=useI18n();
 const {token:customerToken}=useCustomerAuth();const token=customerToken??undefined;const [dob,setDob]=useState(""),[consent,setConsent]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[success,setSuccess]=useState("");
 useEffect(()=>{if(!token)return;let active=true;apiFetch<{birthday:{date_of_birth:string|null;opt_in:boolean}}>("/growth/birthdays",{token,cache:"no-store"}).then(r=>{if(active){setDob(r.birthday.date_of_birth??"");setConsent(r.birthday.opt_in);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load birthday settings.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[token]);
 const save=async()=>{setSaving(true);setError("");setSuccess("");try{await apiFetch("/growth/birthdays",{token,method:"PUT",body:JSON.stringify({date_of_birth:dob||null,opt_in:consent})});setSuccess("Your birthday preferences were saved.");}catch(e){setError(e instanceof Error?e.message:"Could not save birthday preferences.");}finally{setSaving(false);}};
 return <CustomerLayout title={t("Birthday Rewards")} subtitle={t("Optional birthday surprises from your loyalty businesses.")}>
 <div className="max-w-2xl space-y-4">
 <section className="rounded-2xl border border-[#e7b354]/20 bg-[#11130f] p-5"><div className="flex items-center gap-3"><Cake className="size-6 text-[#e7b354]"/><h2 className="text-lg font-semibold">{t("Your birthday")}</h2></div>
 <p className="mt-2 text-sm text-white/55">{t("Add your date of birth if you want to receive a birthday gift or a bonus stamp from businesses where you have a loyalty card. This is optional and kept private from individual business owners.")}</p>
 <label className="mt-5 block text-xs text-white/65">{t("Date of birth")}<input type="date" disabled={loading} max={new Date().toISOString().slice(0,10)} value={dob} onChange={e=>{setDob(e.target.value);if(!e.target.value)setConsent(false);}} className="mt-2 w-full rounded-xl border border-white/15 bg-[#080907] p-3 text-sm text-white"/></label>
 <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><input type="checkbox" disabled={loading||!dob} className="mt-1 accent-[#e7b354]" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span><strong className="block">{t("I agree to birthday reward notifications")}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{t("Businesses with an enabled birthday program may send you one birthday reward per year. Disable anytime to stop future birthday messages.")}</span></span></label>
 {error?<p role="alert" className="mt-3 text-sm text-rose-300">{t(error)}</p>:null}{success?<p role="status" className="mt-3 text-sm text-emerald-300">{t(success)}</p>:null}
 <button disabled={loading||saving} onClick={()=>void save()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e7b354] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"><Save className="size-4"/>{t(saving?"Saving…":"Save birthday preferences")}</button></section>
 <p className="flex items-start gap-2 text-xs leading-5 text-white/45"><ShieldCheck className="size-4 shrink-0"/>{t("Your full birth date is not shown to businesses. Gifts may be issued only once per loyalty business per year. Bonus stamps respect reward-card limits.")}</p>
 </div></CustomerLayout>;
}