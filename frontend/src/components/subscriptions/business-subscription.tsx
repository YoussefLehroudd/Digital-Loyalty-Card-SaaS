"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Crown, Clock3, LockKeyhole, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionBadge, SubscriptionDetailsView } from "@/components/subscriptions/subscription-details";
import { BusinessRenewalRequest } from "./renewal-tools";
import { apiFetch } from "@/lib/api";
import { subscriptionDate, subscriptionDuration, subscriptionUrgency, subscriptionRemaining, subscriptionContact, type SubscriptionDetails } from "@/lib/subscription";

export function useBusinessSubscription(token: string | null) {
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState("");
  const receivedAt = useRef(0);
  const [clock, setClock] = useState(0);
  useEffect(()=>{const timer=setInterval(()=>setClock(performance.now()),1000); return ()=>clearInterval(timer);},[]);
  useEffect(() => {
    setData(null); setError("");
    if (!token) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let running = false;
    async function poll() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const result = await apiFetch<SubscriptionDetails>("/subscription", { token: token!, signal: controller.signal });
        if (!controller.signal.aborted) { receivedAt.current = performance.now(); setClock(receivedAt.current); setData(result); setError(""); }
      } catch { if (!controller.signal.aborted) setError("Subscription status unavailable. Retrying…"); }
      finally { running = false; if (!controller.signal.aborted) timer = setTimeout(poll, document.hidden ? 30000 : 5000); }
    }
    const focus = () => { clearTimeout(timer); void poll(); };
    void poll(); window.addEventListener("focus", focus);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [token,revision]);
  const seconds = data ? Math.max(0, Math.ceil((new Date(data.subscription.period_ends_at).getTime() - new Date(data.subscription.server_time).getTime()) / 1000 - Math.max(0, clock - receivedAt.current) / 1000)) : 0;
  const liveData = data ? { ...data, subscription: { ...data.subscription, remaining_seconds: seconds, state: seconds <= 0 ? "expired" as const : data.subscription.state } } : null;
  return { data: liveData, error, refresh };
}

export function BusinessSubscriptionCard({ data, error, onOpen }: { data: SubscriptionDetails | null; error: string; onOpen: () => void }) {
  if (!data) return error ? <p className="mb-3 rounded-xl border border-white/10 p-3 text-[10px] text-white/50">{error}</p> : <Skeleton className="mb-3 h-32 rounded-2xl" />;
  const s = data.subscription;
  const urgent = subscriptionUrgency(s) !== "normal";
  const current = data.history.find(event=>event.revision===s.revision);
  return <button type="button" onClick={onOpen} aria-label="View subscription details" data-urgent={urgent} className="group data-[urgent=true]:border-rose-400/40 data-[urgent=true]:from-rose-950/60 data-[urgent=true]:via-[#221013]/90 mb-3 w-full rounded-2xl border border-[#edbc62]/25 bg-gradient-to-br from-[#513713]/55 via-[#201a10]/90 to-[#0d100d]/95 p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,.2)] transition hover:border-[#edbc62]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62]/50">
    <div className="flex items-center justify-between gap-2"><span className="grid size-8 place-items-center rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/10 text-[#edbc62] group-data-[urgent=true]:text-rose-300"><Crown className="size-4" /></span><SubscriptionBadge subscription={s} /></div>
    <p className="mt-3 text-xs font-semibold text-white">{s.state === "trial" ? "Your 14-day free trial" : `Your ${subscriptionDuration(current?.duration_months ?? 1)} subscription`}</p>
    <p className="mt-1 text-[10px] text-white/50 group-data-[urgent=true]:text-rose-300">{s.state === "expired" ? "Contact admin to activate access" : subscriptionRemaining(s.remaining_seconds)}</p>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#edbc62]/10 pt-2.5"><p className="text-[9px] leading-4 text-white/40 group-data-[urgent=true]:text-rose-300">{s.state === "expired" ? "Expired" : "Expires"} {subscriptionDate(s.period_ends_at)}</p><ArrowUpRight className="size-3.5 shrink-0 text-[#edbc62]" /></div>
    {error ? <p className="mt-2 text-[9px] text-amber-200">{error}</p> : null}
  </button>;
}

export function BusinessSubscriptionModal({ data, name, open, onClose, token, onSaved }: { data: SubscriptionDetails | null; name: string; open: boolean; onClose: () => void; token: string; onSaved: () => void }) {
  return <Modal className="sm:max-w-5xl" isOpen={open} onClose={onClose} title="Your subscription" description={name} icon={<Crown className="size-6" />}>
    {data ? <><SubscriptionDetailsView data={data} businessName={name} /><BusinessRenewalRequest token={token} requests={data.requests??[]} onSaved={onSaved}/><p className="mt-5 rounded-xl border border-white/10 p-3 text-xs leading-5 text-white/45">Activation is managed by the platform administrator. There is no automatic charge or automatic renewal.</p></> : <Skeleton className="h-64 rounded-2xl" />}
  </Modal>;
}

export function BusinessSubscriptionAlert({ data, name, onOpen }: { data: SubscriptionDetails | null; name: string; onOpen: () => void }) {
  if (!data || subscriptionUrgency(data.subscription) === "normal") return null;
  const expired = subscriptionUrgency(data.subscription) === "expired";
  const Icon = expired ? LockKeyhole : Clock3;
  return <section role="status" aria-live="polite" className="mx-4 mt-4 rounded-2xl border border-rose-400/30 bg-gradient-to-r from-rose-950/40 to-[#160e10] p-4 sm:mx-6 sm:p-5 lg:mx-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300"><Icon className="size-5" /></span><div className="min-w-0"><h2 className="text-sm font-bold text-rose-200">{expired ? "Subscription expired · workspace is read-only" : "Your subscription expires soon"}</h2><p className="mt-1 text-xs leading-5 text-white/65">{expired ? "Your data is preserved. Scanning, rewards and changes are locked until the administrator renews your subscription." : "Renew before expiry to keep scanning and rewarding your customers."}</p><p className="mt-2 text-xs font-semibold text-rose-300">{subscriptionDate(data.subscription.period_ends_at)} · {subscriptionRemaining(data.subscription.remaining_seconds)}</p></div></div>
      <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={onOpen} className="rounded-xl border border-white/15 px-3 py-2.5 text-xs font-semibold text-white/80">Subscription details</button><a href={subscriptionContact(name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#edbc62] px-3 py-2.5 text-xs font-bold text-black"><MessageCircle className="size-4" />Contact to renew</a></div>
    </div><p className="mt-3 text-[11px] text-white/50">Renewal assistance: <a href="tel:+212644819899" className="font-semibold text-white/75 underline underline-offset-2">0644819899</a></p>
  </section>;
}

