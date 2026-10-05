"use client";

import { useEffect, useState } from "react";
import { Check, Gift, History, Store } from "lucide-react";
import Image from "next/image";

import { RewardSlider } from "@/components/customer-app/reward-slider";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerRewards } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEcho } from "@/components/echo/echo-provider";

type RewardItem = {
  loyalty_card_id: string;
  business_id: string;
  business_name: string;
  business_logo_url: string | null;
  business_primary_color: string | null;
  reward_name: string;
  reward_description: string | null;
  points_required: number;
  current_stamps: number;
  progress_percent: number;
  ready: boolean;
};

type RewardHistoryItem = {
  id: string;
  status: string;
  business_id: string;
  customer_id: string;
  business_name: string;
  business_logo_url: string | null;
  business_primary_color: string | null;
  reward_name: string;
  reward_description: string | null;
  points_required: number;
  earned_at: string | null;
  redeemed_at: string | null;
};

export default function UserRewardsPage() {
  const { token } = useCustomerAuth();
  const { echo } = useEcho();
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<RewardItem[]>([]);
  const [history, setHistory] = useState<RewardHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    customerRewards(token)
      .then((res) => {
        setAvailable(res.data.available ?? []);
        setHistory(res.data.history ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load rewards");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("customer");
    const refresh = () => {
      void customerRewards(token).then((res) => {
        setAvailable(res.data.available ?? []);
        setHistory(res.data.history ?? []);
      }).catch(() => undefined);
    };
    channel.listen("data.changed", refresh);
    return () => { channel.stopListening("data.changed", refresh); };
  }, [echo, token]);

  const readyCount = available.filter((reward) => reward.ready).length;
  const redeemedCount = history.filter((item) => item.status === "redeemed").length;

  return (
    <CustomerLayout title="Rewards" subtitle="Track rewards you can claim and your history">
      {loading ? (
        <Card className="border-white/10 bg-[#10110e]/95">
          <CardContent role="status" className="p-6 text-sm text-white/50">Loading rewards...</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent role="alert" className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <div className="space-y-7">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: "Ready to claim", value: readyCount },
              { label: "In progress", value: available.length - readyCount },
              { label: "Redeemed", value: redeemedCount },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-[#10110e]/95 px-3 py-4 sm:px-5">
                <p className="min-w-0 break-all text-2xl font-semibold tracking-tight text-white sm:text-3xl">{stat.value}</p>
                <p className="text-[11px] text-white/50 sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          <section aria-labelledby="loyalty-rewards-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="loyalty-rewards-heading" className="flex items-center gap-2 text-base font-semibold text-white">
                <Gift className="size-4 text-[#f3bd55]" /> Your rewards
              </h2>
              <span className="text-xs text-white/45">{available.length} {available.length === 1 ? "loyalty card" : "loyalty cards"}</span>
            </div>
            {available.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-[#10110e]/90 px-5 py-10 text-center">
                <Gift className="mx-auto mb-3 size-7 text-[#f3bd55]/70" />
                <p className="text-sm font-medium text-white">Start collecting rewards</p>
                <p className="mt-1 text-sm text-white/50">Add a loyalty card and collect stamps on your visits.</p>
              </div>
            ) : (
              <RewardSlider items={available.map((reward) => {
                  const progress = Math.max(0, Math.min(100, reward.progress_percent));
                  const remaining = Math.max(0, reward.points_required - reward.current_stamps);
                  return (
                    <article key={`${reward.business_id}-${reward.loyalty_card_id}`} className="flex min-w-0 flex-col rounded-2xl border border-[#f3bd55]/15 bg-[linear-gradient(145deg,#171811,#0c0d0a)] p-5 shadow-[0_8px_28px_rgba(0,0,0,.18)]">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {reward.business_logo_url ? (
                            <Image src={reward.business_logo_url} alt={`${reward.business_name} logo`} width={44} height={44} className="h-full w-full object-cover" unoptimized />
                          ) : <Store className="size-5 text-white/40" />}
                        </div>
                        <p className="min-w-0 flex-1 break-words text-sm font-medium text-white/70">{reward.business_name}</p>
                        <Badge className={reward.ready ? "shrink-0 border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "shrink-0 border-white/10 bg-white/5 text-white/55"}>
                          {reward.ready ? "Ready" : "In progress"}
                        </Badge>
                      </div>
                      <h3 className="mt-5 min-h-14 break-words text-lg font-semibold leading-7 text-white">{reward.reward_name}</h3>
                      <p className="mt-2 min-h-[72px] flex-1 text-sm leading-6 text-white/50">{reward.reward_description || "Collect stamps to unlock your reward."}</p>
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                          <p className="text-white/50"><span className="font-semibold text-white">{reward.current_stamps}</span> / {reward.points_required} stamps</p>
                          <span className="font-medium text-[#f3bd55]">{progress}%</span>
                        </div>
                        <div role="progressbar" aria-label={`${reward.business_name} reward progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#f3bd55] transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        <p className={reward.ready ? "mt-3 flex items-center gap-1.5 text-xs text-emerald-300" : "mt-3 text-xs text-white/45"}>
                          {reward.ready ? <><Check className="size-3.5" /> Show your card at the business to redeem.</> : `${remaining} more ${remaining === 1 ? "stamp" : "stamps"} to unlock`}
                        </p>
                      </div>
                    </article>
                  );
                })} />
            )}
          </section>

          <section aria-labelledby="reward-history-heading" className="overflow-hidden rounded-2xl border border-white/10 bg-[#10110e]/95">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 id="reward-history-heading" className="flex items-center gap-2 text-base font-semibold text-white"><History className="size-4 text-[#f3bd55]" /> Reward history</h2>
              <span className="text-xs text-white/45">{history.length} {history.length === 1 ? "reward" : "rewards"}</span>
            </div>
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <History className="mx-auto mb-3 size-6 text-white/30" />
                <p className="text-sm font-medium text-white/75">No reward history yet</p>
                <p className="mt-1 text-xs leading-5 text-white/45">Your earned and redeemed rewards will appear here.</p>
              </div>
            ) : (
              <div role="region" aria-label="Reward history list" tabIndex={0} className="max-h-[420px] divide-y divide-white/10 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f3bd55]/40 lg:max-h-[480px]" style={{ scrollbarWidth: "thin", scrollbarColor: "#806629 #10110e" }}>
                {history.map((item) => {
                  const date = item.redeemed_at ?? item.earned_at;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
                        {item.business_logo_url ? <Image src={item.business_logo_url} alt={`${item.business_name} logo`} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <Gift className="size-4 text-white/40" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-white">{item.reward_name}</p>
                        <p className="mt-0.5 text-xs text-white/45">{item.business_name}</p>
                        {date ? <p className="mt-1 text-[11px] text-white/35">{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p> : null}
                      </div>
                      <Badge className={item.status === "redeemed" ? "shrink-0 border-white/10 bg-white/5 text-white/55" : "shrink-0 border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}>{item.status === "redeemed" ? "Redeemed" : item.status === "ready" ? "Ready" : item.status}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </CustomerLayout>
  );
}
