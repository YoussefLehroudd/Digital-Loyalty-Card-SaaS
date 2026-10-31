"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";

const EMAIL="youssefhrdd@gmail.com";
const WHATSAPP="212644819899";
const CAMPAIGN_KEY="loyvance.analytics.campaign.v1";
const validCode=(value:string)=>/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value);
const field="mt-1.5 h-12 w-full min-w-0 rounded-xl border border-white/20 bg-[#0c0d0c] px-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#f3bd55]/70 focus:ring-2 focus:ring-[#f3bd55]/15";

export function MarketingDemoContact(){
  const {t}=useI18n();
  const [campaign,setCampaign]=useState("");
  const [contactName,setContactName]=useState("");
  const [businessName,setBusinessName]=useState("");
  const [email,setEmail]=useState("");
  const [message,setMessage]=useState("");
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    try{
      const query=new URLSearchParams(location.search).get("ref")?.trim().toLowerCase()||"";
      const stored=JSON.parse(sessionStorage.getItem(CAMPAIGN_KEY)||"null") as {code?:string}|null;
      const value=validCode(query)?query:stored?.code||"";
      if(validCode(value))setCampaign(value);
    }catch{}
  },[]);
  const context=campaign?" (reference: "+campaign+")":"";
  const whatsAppUrl="https://wa.me/"+WHATSAPP+"?text="+encodeURIComponent(
    "Hello LOYVANCE, I would like a demonstration for my business"+(businessName?" ("+businessName+")":"")+context+"."
  );
  const emailUrl="mailto:"+EMAIL+"?subject="+encodeURIComponent("LOYVANCE - Demo request"+context)+
    "&body="+encodeURIComponent("Hello, I am interested in a LOYVANCE demo.\nBusiness: "+businessName+"\nName: "+contactName+"\nReference: "+(campaign||"Direct")+"\n");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy||!consent)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/demo-request",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({contact_name:contactName,business_name:businessName,email,message,consent,campaign_code:campaign,website:""}),
      });
      const data=await response.json().catch(()=>({})) as {message?:string;ok?:boolean};
      if(!response.ok||!data.ok)throw Error(data.message||t("Could not send your request."));
      setDone(true);
    }catch(e){setError(e instanceof Error?e.message:t("Could not send your request."));}
    finally{setBusy(false);}
  }
  return <section id="request-demo" className="relative scroll-mt-24 border-y border-[#f3bd55]/15 bg-[radial-gradient(ellipse_at_75%_10%,rgba(243,189,85,.14),transparent_60%),#090a09] px-5 py-16 sm:py-20 lg:px-8">
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#f3bd55]/30 bg-[#f3bd55]/10 px-4 py-2 text-xs font-semibold text-[#f3bd55]"><MessageCircle className="size-4"/>{t("Talk to LOYVANCE")}</span>
        <h2 className="mt-5 max-w-lg text-3xl font-black leading-tight sm:text-4xl">{t("Interested in LOYVANCE?")} <span className="text-[#f3bd55]">{t("Let's talk about your business.")}</span></h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">{t("Get a free, no-obligation 10-minute demonstration. Ask questions, see a digital loyalty card and explore how it would work for your shop.")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f3bd55] px-5 text-sm font-bold text-black transition hover:bg-[#ffd16f]"><MessageCircle className="size-5"/>{t("Contact on WhatsApp")}</a>
          <a href={emailUrl} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-[#f3bd55]/50"><Mail className="size-5"/>{t("Send an email")}</a>
        </div>
        <a href={"mailto:"+EMAIL} className="mt-4 inline-block text-sm text-[#f3bd55] underline underline-offset-4">{EMAIL}</a>
      </div>
      <div className="min-w-0 rounded-2xl border border-[#f3bd55]/25 bg-black/65 p-5 shadow-[0_18px_50px_rgba(0,0,0,.3)] backdrop-blur-sm sm:p-7">
        {done?<div role="status" className="flex min-h-[285px] flex-col items-center justify-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-emerald-400"/>
          <h3 className="text-xl font-bold">{t("Demo request received!")}</h3>
          <p className="max-w-sm text-sm leading-6 text-white/65">{t("Thank you! We have saved your request and will contact you by email.")}</p>
          <button type="button" onClick={()=>{setDone(false);setMessage("");}} className="text-sm font-semibold text-[#f3bd55] underline underline-offset-4">{t("Send another request")}</button>
        </div>:<form onSubmit={e=>void submit(e)} className="space-y-4">
          <div>
            <h3 className="text-xl font-bold">{t("Request a personal demo")}</h3>
            <p className="mt-1 text-xs leading-5 text-white/55">{t("No account or payment required.")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-white/75">{t("Your name")}<input required maxLength={100} minLength={2} autoComplete="name" value={contactName} onChange={e=>setContactName(e.target.value)} className={field} placeholder={t("Your name")}/></label>
            <label className="text-xs font-medium text-white/75">{t("Business name")}<input required maxLength={120} minLength={2} autoComplete="organization" value={businessName} onChange={e=>setBusinessName(e.target.value)} className={field} placeholder={t("Business name")}/></label>
          </div>
          <label className="block text-xs font-medium text-white/75">{t("Business email")}<input required type="email" maxLength={150} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="contact@business.com"/></label>
          <label className="block text-xs font-medium text-white/75">{t("Message (optional)")}<textarea maxLength={1200} rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder={t("Tell us about your business or ask a question")} className={field+" h-auto min-h-[88px] py-3"}/></label>
          <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/65"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[#f3bd55]"/>{t("I agree to be contacted about my request. My details will be used only to respond to this inquiry.")}</label>
          {error?<p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>:null}
          <button type="submit" disabled={busy||!consent} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f3bd55] px-5 text-sm font-bold text-black transition hover:bg-[#ffd16f] disabled:opacity-50">{busy?<Loader2 className="size-4 animate-spin"/>:<Send className="size-4"/>}{busy?t("Sending request…"):t("Request my demo")}</button>
          <p className="text-[11px] leading-5 text-white/45">{t("We use your details to reply to your demo request. If you arrived through a campaign link, its reference is included so we can understand the source.")}</p>
        </form>}
      </div>
    </div>
  </section>;
}
