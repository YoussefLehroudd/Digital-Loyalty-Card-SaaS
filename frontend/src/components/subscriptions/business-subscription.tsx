"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Crown } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionBadge, SubscriptionDetailsView } from "@/components/subscriptions/subscription-details";
import { apiFetch } from "@/lib/api";
import { subscriptionDate, subscriptionDuration, type SubscriptionDetails } from "@/lib/subscription";

export function useBusinessSubscription(token: string | null) {
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null); setError("");
    if (!token) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let running = false;
    async function poll() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const result = await apiFetch<SubscriptionDetails>("/subscription", { token: token!, signal: controller.signal });
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch { if (!controller.signal.aborted) setError("Subscription status unavailable. Retrying…"); }
      finally { running = false; if (!controller.signal.aborted) timer = setTimeout(poll, document.hidden ? 30000 : 5000); }
    }
    const focus = () => { clearTimeout(timer); void poll(); };
    void poll(); window.addEventListener("focus", focus);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [token]);
  return { data, error };
}

export function BusinessSubscriptionCard({ data, error, onOpen }: { data: SubscriptionDetails | null; error: string; onOpen: () => void }) {
  if (!data) return error ? <p className="mb-3 rounded-xl border border-white/10 p-3 text-[10px] text-white/50">{error}</p> : <Skeleton className="mb-3 h-32 rounded-2xl" />;
  const s = data.subscription;
  const current = data.history.find(event=>event.revision===s.revision);
  return <button type="button" onClick={onOpen} aria-label="View subscription details" className="group mb-3 w-full rounded-2xl border border-[#edbc62]/25 bg-gradient-to-br from-[#513713]/55 via-[#201a10]/90 to-[#0d100d]/95 p-3.5 text-left shadow-[0_8px_24px_rgba(0,0,0,.2)] transition hover:border-[#edbc62]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62]/50">
    <div className="flex items-center justify-between gap-2"><span className="grid size-8 place-items-center rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/10 text-[#edbc62]"><Crown className="size-4" /></span><SubscriptionBadge subscription={s} /></div>
    <p className="mt-3 text-xs font-semibold text-white">{s.state === "trial" ? "Your 14-day free trial" : `Your ${subscriptionDuration(current?.duration_months ?? 1)} subscription`}</p>
    <p className="mt-1 text-[10px] text-white/50">{s.state === "expired" ? "Contact admin to activate access" : `${Math.ceil(s.remaining_seconds / 86400)} days remaining`}</p>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#edbc62]/10 pt-2.5"><p className="text-[9px] leading-4 text-white/40">{s.state === "expired" ? "Expired" : "Expires"} {subscriptionDate(s.period_ends_at)}</p><ArrowUpRight className="size-3.5 shrink-0 text-[#edbc62]" /></div>
    {error ? <p className="mt-2 text-[9px] text-amber-200">{error}</p> : null}
  </button>;
}

export function BusinessSubscriptionModal({ data, name, open, onClose }: { data: SubscriptionDetails | null; name: string; open: boolean; onClose: () => void }) {
  return <Modal className="sm:max-w-5xl" isOpen={open} onClose={onClose} title="Your subscription" description={name} icon={<Crown className="size-6" />}>
    {data ? <><SubscriptionDetailsView data={data} businessName={name} /><p className="mt-5 rounded-xl border border-white/10 p-3 text-xs leading-5 text-white/45">Activation is managed by the platform administrator. There is no automatic charge or automatic renewal.</p></> : <Skeleton className="h-64 rounded-2xl" />}
  </Modal>;
}
