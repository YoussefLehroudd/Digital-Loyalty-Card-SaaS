"use client";

import { CalendarDays, Clock3, Crown, Download, History, ShieldCheck } from "lucide-react";
import { subscriptionDate, type BusinessSubscription, type SubscriptionDetails } from "@/lib/subscription";

export function SubscriptionBadge({ subscription }: { subscription: BusinessSubscription }) {
  const label = subscription.state === "trial" ? "Free trial" : subscription.state === "active" ? "Subscribed" : "Expired";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${subscription.state === "expired" ? "border-rose-400/20 bg-rose-400/5 text-rose-300" : subscription.state === "active" ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-[#edbc62]/20 bg-[#edbc62]/5 text-[#edbc62]"}`}><span className="size-1 rounded-full bg-current" />{label}</span>;
}

export function SubscriptionDetailsView({ data, businessName }: { data: SubscriptionDetails; businessName: string }) {
  const s = data.subscription;
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ business_name: businessName, exported_at: new Date().toISOString(), timezone: "Africa/Casablanca", ...data }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `loyvance-subscription-${s.business_id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-5">
    <div className="rounded-2xl border border-[#edbc62]/20 bg-gradient-to-br from-[#edbc62]/10 to-transparent p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edbc62]/10 text-[#edbc62]"><Crown className="size-5" /></span><SubscriptionBadge subscription={s} /></div>
      <h3 className="mt-4 text-lg font-semibold">{s.paid_started_at ? "LOYVANCE · Monthly access" : "LOYVANCE · 14-day free trial"}</h3>
      <p className="mt-1 text-xs leading-5 text-white/45">{s.state === "expired" ? "Access has expired. An administrator can activate a new month." : `${Math.ceil(s.remaining_seconds / 86400)} days remaining · ${s.paid_started_at ? 'Manually activated by an administrator' : 'Included automatically'}`}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#bd862d] to-[#f4ce87]" style={{ width: `${Math.max(0, Math.min(100, (s.remaining_seconds * 1000 / (new Date(s.period_ends_at).getTime() - new Date(s.period_started_at).getTime())) * 100))}%` }} /></div>
    </div>
    <dl className="grid gap-3 sm:grid-cols-2">{[["Current period started",s.period_started_at],["Current period expires",s.period_ends_at],["Free trial started",s.trial_started_at],["Free trial expired / expires",s.trial_ends_at]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><dt className="flex items-center gap-1.5 text-[10px] text-white/40"><CalendarDays className="size-3.5" />{label}</dt><dd className="mt-2 text-xs font-semibold">{subscriptionDate(value)}</dd></div>)}</dl>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-[10px] text-white/35"><Clock3 className="size-3.5" />Times in Morocco · Africa/Casablanca</p><button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold hover:bg-white/5"><Download className="size-3.5" />Export record</button></div>
    <section><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><History className="size-4 text-[#edbc62]" />Activation history <span className="text-white/30">({data.history.length})</span></h3>
      {data.history.length ? <div className="space-y-3">{data.history.map(event=><article key={event.id} className="rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs font-semibold text-[#edbc62]"><ShieldCheck className="size-3.5" />One month activated</p><span className="text-[10px] text-white/30">Record #{event.revision}</span></div><p className="mt-2 text-[11px] text-white/65">{subscriptionDate(event.started_at)} → {subscriptionDate(event.ends_at)}</p><p className="mt-2 text-[11px] text-white/40">Activated by {event.actor_name} · {subscriptionDate(event.created_at)}</p><p className="mt-3 break-words rounded-lg bg-white/[.035] p-2.5 text-xs leading-5 text-white/65">{event.note}</p>{event.reference ? <p className="mt-2 break-all text-[11px] text-white/45">Reference: {event.reference}</p> : null}<details className="mt-3 text-[10px] text-white/35"><summary className="cursor-pointer text-white/50">Full record</summary><dl className="mt-2 space-y-1.5 break-all"><div>Activation ID: {event.id}</div><div>Administrator ID: {event.actor_id || 'Account removed'}</div><div>Previous state: {event.previous_state}</div><div>Previous period: {subscriptionDate(event.previous_started_at)} → {subscriptionDate(event.previous_ends_at)}</div><div>Exact UTC start: {new Date(event.started_at).toISOString()}</div><div>Exact UTC expiry: {new Date(event.ends_at).toISOString()}</div></dl></details></article>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs leading-5 text-white/40">No paid period activated yet. The original free trial dates are recorded above.</p>}
    </section>
  </div>;
}
