"use client";
import { Mail, MessageCircle, UsersRound } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";

export type VisitorDemoRequest = {
 id:string;created_at:string;contact_name:string;business_name:string;
 email:string;message:string;campaign_code:string|null;emailed:boolean;
};
export function VisitorDemoRequests({requests}:{requests:VisitorDemoRequest[]}){
 const {t}=useI18n();
 return <section className="admin-panel min-w-0 rounded-2xl border border-[#edbc62]/20 bg-[#101318] p-4 sm:p-5">
   <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
     <div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#edbc62]"><UsersRound className="size-4"/>{t("Demo requests from interested businesses")}</p>
       <h2 className="mt-2 text-lg font-semibold">{t("Contact these businesses")}</h2>
       <p className="mt-1 text-xs leading-5 text-white/50">{t("These businesses explicitly asked for a demo. Use their email to reply; campaign references show where they arrived from.")}</p>
     </div>
     <span className="rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/10 px-4 py-2 text-xl font-bold tabular-nums text-[#edbc62]">{requests.length}</span>
   </div>
   {requests.length===0?<p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50">{t("No demo requests received yet.")}</p>:
   <div className="admin-visitors-ranking-scroll mt-4 max-h-[390px] space-y-2 overflow-y-auto overscroll-y-contain pe-1 sm:max-h-[480px]" role="region" aria-label={t("Demo requests from interested businesses")} tabIndex={0}>
     {requests.map(r=><article key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
       <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
         <div className="min-w-0">
           <h3 className="break-words text-sm font-semibold text-white">{r.business_name}</h3>
           <p className="mt-1 text-xs text-white/70">{r.contact_name}</p>
           <p className="mt-1 break-all text-xs text-[#edbc62]">{r.email}</p>
         </div>
         <a href={"mailto:"+r.email+"?subject="+encodeURIComponent("LOYVANCE - Your demo request")}
           className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-[#edbc62]/40 px-3 text-xs font-semibold text-[#edbc62] hover:bg-[#edbc62]/10">
           <Mail className="size-4"/>{t("Reply by email")}
         </a>
       </div>
       {r.message?<p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white/[.035] p-3 text-xs leading-5 text-white/65">{r.message}</p>:null}
       <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
         <span>{new Date(r.created_at).toLocaleString()}</span>
         <span>{t("Campaign")}: {r.campaign_code||t("Direct / unknown")}</span>
       </div>
     </article>)}
   </div>}
 </section>;
}
