"use client";
import { CalendarClock, Check, Clock3, Eye, Users, BadgeCheck } from "lucide-react";
import {useI18n} from "@/components/i18n/language-provider";

const trackingTranslations:Record<string,[string,string]>={"Referral link opened":["Lien de parrainage ouvert","زيارات رابط الإحالة"],"Tracked opens since activation":["Ouvertures enregistrées depuis l'activation","الزيارات المسجلة منذ التفعيل"],"Signed-up businesses":["Entreprises inscrites","المتاجر المسجلة"],"Completed account and email verification":["Compte créé et e-mail vérifié","الحسابات التي أكملت تأكيد البريد"],"Active paid subscriptions":["Abonnements payants actifs","الاشتراكات المدفوعة النشطة"],"Currently paid and not expired":["Paiement confirmé et abonnement actif","المدفوعة والسارية حالياً"],"Last recorded referral link open:":["Dernière ouverture enregistrée :","آخر زيارة مسجلة للرابط:"],"None recorded yet":["Aucune pour le moment","لا توجد زيارات بعد"],"Referral link visits · Countries & flags":["Visites du lien · Pays et drapeaux","زيارات الرابط · الدول والأعلام"],"No referral visits recorded yet.":["Aucune visite enregistrée.","لا توجد زيارات مسجلة بعد."],"No confirmed signups through your link yet":["Aucune inscription confirmée via votre lien","لا توجد تسجيلات مؤكدة عبر رابطك بعد"],"Share your personal business referral link above. Registrations will appear after OTP verification.":["Partagez votre lien. Les inscriptions apparaissent après vérification du code.","شارك رابط الإحالة. ستظهر التسجيلات بعد تأكيد رمز التحقق."],"Unknown country":["Pays inconnu","دولة غير معروفة"],"Paid subscription active":["Abonnement payant actif","اشتراك مدفوع نشط"],"Free access granted":["Accès gratuit accordé","تم منح وصول مجاني"],"Free trial active":["Essai gratuit actif","تجربة مجانية نشطة"],"Subscription expired":["Abonnement expiré","انتهى الاشتراك"],"Trial expired":["Essai expiré","انتهت الفترة التجريبية"],"14-day trial ends":["Fin de l'essai de 14 jours","نهاية التجربة لمدة 14 يوماً"],"Payment & subscription":["Paiement et abonnement","الدفع والاشتراك"],"Paid plan expires":["Expiration de l'abonnement","انتهاء الاشتراك المدفوع"],"Access expires":["Expiration de l'accès","انتهاء الوصول"],"Trial expires":["Expiration de l'essai","انتهاء التجربة"],"Last access expired":["Dernier accès expiré","انتهى آخر وصول"],"Trial time remaining":["Temps d'essai restant","الوقت المتبقي للتجربة"],"No confirmed payment yet":["Aucun paiement confirmé","لا يوجد دفع مؤكد"],"Not subscribed yet":["Pas encore abonné","لم يشترك بعد"],"No active subscription":["Aucun abonnement actif","لا يوجد اشتراك نشط"],"Needs renewal":["Renouvellement nécessaire","يحتاج إلى تجديد"],"Previously subscribed":["Abonnement précédent","اشتراك سابق"],"Trial finished / replaced":["Essai terminé ou remplacé","انتهت التجربة أو تم استبدالها"]};
function useTrackingLanguage(){const {language}=useI18n();return {language,tr:(key:string)=>language==="ar"?trackingTranslations[key]?.[1]??key:language==="fr"?trackingTranslations[key]?.[0]??key:key};}
export type ReferredBusiness = {
 id:string;name:string;attributed_at:string;paid_orders:number;earned_centimes:string;
 trial_started_at:string|null;trial_ends_at:string|null;paid_started_at:string|null;paid_ends_at:string|null;
 subscription_status:"trial"|"trial_expired"|"subscribed"|"subscription_expired"|"access_granted";
 trial_days_left:number;days_remaining:number;latest_plan_months:number|null;latest_paid_at:string|null;
 pending_plan_months:number|null;pending_since:string|null;
};
const money=(centimes:number|string)=>new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD"}).format(Number(centimes||0)/100);
const day=(value:string|null)=>value?new Date(value).toLocaleDateString("fr-MA",{day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Casablanca"}):"Not available";
function Step({icon:Icon,label,value,note}:{icon:typeof Users;label:string;value:number;note:string}){
 return <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
  <div className="flex items-center justify-between gap-2"><p className="text-xs text-white/55">{label}</p><Icon className="size-4 shrink-0 text-[#efbd5d]"/></div>
  <p className="mt-3 text-2xl font-bold tabular-nums text-[#efbd5d]">{value}</p>
  <p className="mt-1 text-[11px] leading-5 text-white/40">{note}</p>
 </div>;
}
function TrackingCard({business:b}:{business:ReferredBusiness}){
 const {tr}=useTrackingLanguage();
 const trial=b.subscription_status==="trial",paid=b.subscription_status==="subscribed";
 const wasPaid=b.subscription_status==="subscription_expired";
 const granted=b.subscription_status==="access_granted";
 const state=paid?"Paid subscription active":granted?"Free access granted":trial?"Free trial active":wasPaid?"Subscription expired":"Trial expired";
 const badge=paid?"border-emerald-400/25 bg-emerald-400/10 text-emerald-300":granted?"border-amber-400/25 bg-amber-400/10 text-amber-300":trial?"border-sky-400/25 bg-sky-400/10 text-sky-300":"border-rose-400/25 bg-rose-400/10 text-rose-300";
 const trialStart=b.trial_started_at?Date.parse(b.trial_started_at):NaN;
 const trialEnd=b.trial_ends_at?Date.parse(b.trial_ends_at):NaN;
 const trialProgress=Number.isFinite(trialStart)&&Number.isFinite(trialEnd)&&trialEnd>trialStart
   ?Math.min(100,Math.max(0,100*(trialEnd-Date.now())/(trialEnd-trialStart))):0;
 return <article className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3.5 sm:p-5">
  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
   <div className="min-w-0">
    <h3 className="break-words text-sm font-bold text-white">{b.name}</h3>
    <p className="mt-1 text-[11px] leading-5 text-white/45"><Check className="me-1 inline size-3 text-emerald-300"/>Account created and email verified · {day(b.attributed_at)}</p>
   </div>
   <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge}`}>{tr(state)}</span>
  </div>
  <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 min-[370px]:grid-cols-2 lg:grid-cols-3">
   <div className="min-w-0 rounded-lg border border-white/5 bg-white/[.025] p-3">
    <p className="text-[11px] text-white/40">{tr("14-day trial ends")}</p>
    <p className="mt-1 text-xs font-semibold text-white/85">{day(b.trial_ends_at)}</p>
    <p className="mt-1 text-[11px] text-white/45">{trial?`${b.trial_days_left} days remaining`:"Trial finished / replaced"}</p>
   </div>
   <div className="min-w-0 rounded-lg border border-white/5 bg-white/[.025] p-3">
    <p className="text-[11px] text-white/40">{tr("Payment & subscription")}</p>
    <p className="mt-1 text-xs font-semibold text-white/85">{paid?`Paid · ${b.latest_plan_months||"—"}-month plan`:granted?"Admin-granted access · no confirmed payment":wasPaid?"Previously subscribed":trial?"Not subscribed yet":"No active subscription"}</p>
    <p className="mt-1 text-[11px] leading-5 text-white/45">{b.latest_paid_at?`Last confirmed: ${day(b.latest_paid_at)}`:"No confirmed payment yet"}</p>
   </div>
   <div className="min-w-0 rounded-lg border border-white/5 bg-white/[.025] p-3">
    <p className="text-[11px] text-white/40">{paid?"Paid plan expires":granted?"Access expires":trial?"Trial expires":"Last access expired"}</p>
    <p className="mt-1 text-xs font-semibold text-[#efbd5d]">{day(b.paid_ends_at||b.trial_ends_at)}</p>
    <p className="mt-1 text-[11px] text-white/45">{paid||trial||granted?`${b.days_remaining} days remaining`:"Needs renewal"}</p>
   </div>
  </div>
  {trial&&<div className="mt-3">
   <div className="mb-1 flex justify-between gap-2 text-[11px] text-white/45"><span><Clock3 className="me-1 inline size-3"/>{tr("Trial time remaining")}</span><span>{b.trial_days_left} day(s)</span></div>
   <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-sky-400/80" style={{width:trialProgress+"%"}}/></div>
  </div>}
  {b.pending_plan_months&&<div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-[11px] leading-5 text-amber-200">
   <CalendarClock className="size-4 shrink-0"/>Payment proof submitted · {b.pending_plan_months} months · Awaiting admin review {b.pending_since?"("+day(b.pending_since)+")":""}
  </div>}
  <div className="mt-3 flex min-w-0 flex-wrap justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-white/45">
   <span>{b.paid_orders} commission-generating payment(s)</span>
   <span>Earned: <strong className="text-[#efbd5d]">{money(b.earned_centimes)}</strong></span>
  </div>
 </article>;
}
type ReferralOpen={visited_at:string;country_code:string|null};
function countryInfo(code:string|null,language:"ar"|"fr"|"en"){
 if(!code||!/^[A-Z]{2}$/.test(code))return {flag:"🌐",name:language==="ar"?"دولة غير معروفة":language==="fr"?"Pays inconnu":"Unknown country"};
 const flag=String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0)));
 let name=code;
 try{name=new Intl.DisplayNames([language],{type:"region"}).of(code)??code;}catch{}
 return {flag,name};
}
export function AffiliateReferralTracking({visits,signups,activePaid,lastVisit,businesses,recentVisits=[]}:{visits:number;signups:number;activePaid:number;lastVisit:string|null;businesses:ReferredBusiness[];recentVisits?:ReferralOpen[];language?:"ar"|"fr"|"en"}){
 const {language,tr}=useTrackingLanguage();
 return <div className="min-w-0 space-y-4">
  <div className="grid min-w-0 grid-cols-1 gap-2 min-[340px]:grid-cols-2 lg:grid-cols-3">
   <Step icon={Eye} label={tr("Referral link opened")} value={visits} note={tr("Tracked opens since activation")}/>
   <Step icon={Users} label={tr("Signed-up businesses")} value={signups} note={tr("Completed account and email verification")}/>
   <Step icon={BadgeCheck} label={tr("Active paid subscriptions")} value={activePaid} note={tr("Currently paid and not expired")}/>
  </div>
  <p className="text-[11px] font-medium text-[#efbd5d]/80">{tr("Last recorded referral link open:")} {lastVisit?day(lastVisit):tr("None recorded yet")}</p>
  <p className="text-[11px] leading-5 text-white/40">An opened link does not identify the visitor. A business appears below only after account creation and email verification. Link visits are approximate; private browsing, opt-outs and reloads may affect the count. Earlier visits cannot be recovered.</p>
  <section className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
   <h3 className="text-sm font-semibold text-white">{tr("Referral link visits · Countries & flags")}</h3>
   <p className="mt-1 text-[11px] leading-5 text-white/45">Latest 100 recorded opens. Country is approximate (Vercel edge), not a visitor&apos;s precise location. Anonymous visits only; no IP addresses or visitor identities are shown. Older country data is unavailable.</p>
   {!recentVisits.length?<p className="mt-3 rounded-lg border border-dashed border-white/10 p-4 text-xs text-white/50">{tr("No referral visits recorded yet.")}</p>:
    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
     {recentVisits.map((visit,index)=>{const geo=countryInfo(visit.country_code,language);return <div key={visit.visited_at+index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[.025] px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-white/85"><span aria-hidden="true" className="text-lg">{geo.flag}</span>{geo.name}</span>
      <time className="text-[11px] text-white/45" dateTime={visit.visited_at}>{new Date(visit.visited_at).toLocaleString("fr-MA",{timeZone:"Africa/Casablanca",dateStyle:"medium",timeStyle:"short"})}</time>
     </div>;})}
    </div>}
  </section>
  {businesses.length?<div className="space-y-3">{businesses.map(b=><TrackingCard key={b.id} business={b}/>)}</div>:
   <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center">
    <p className="text-sm font-semibold text-white/70">{tr("No confirmed signups through your link yet")}</p>
    <p className="mt-2 text-xs leading-5 text-white/45">{tr("Share your personal business referral link above. Registrations will appear after OTP verification.")}</p>
   </div>}
 </div>;
}
