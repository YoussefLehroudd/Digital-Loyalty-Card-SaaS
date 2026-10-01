"use client";

import { useEffect, useState } from "react";
import { Gift, History, Sparkles, Store } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerRewards } from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <CustomerLayout title="Rewards" subtitle="Track rewards you can claim and your history">
      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Loading rewards...</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Gift className="h-5 w-5" /> Available rewards
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Rewards from your loyalty cards</p>
                </div>
                <Badge variant="secondary">{available.length} {available.length === 1 ? "reward" : "rewards"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {available.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No available rewards yet.</div>
              ) : available.map((reward) => (
                <div key={`${reward.business_id}-${reward.loyalty_card_id}`} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background shadow-sm">
                      {reward.business_logo_url ? (
                        <img src={reward.business_logo_url} alt="" className="h-full w-full object-cover" />
                      ) : <Store className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold">{reward.business_name}</p>
                      <p className="truncate text-sm text-muted-foreground">{reward.reward_name}</p>
                    </div>
                    <Badge className={reward.ready ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}>
                      {reward.ready ? "Ready" : "In progress"}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {reward.reward_description ?? "Collect stamps to unlock your reward."}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="whitespace-nowrap text-sm font-medium">{reward.current_stamps}/{reward.points_required} stamps</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, reward.progress_percent)}%`, backgroundColor: reward.business_primary_color ?? undefined }} />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold">{reward.progress_percent}%</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
                    <Gift className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">{reward.reward_name}</p>
                      <p className="text-xs text-muted-foreground">Required: {reward.points_required} stamps</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> Reward history</CardTitle>
                <Badge variant="secondary">{history.length} claimed</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-5">
              {history.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border bg-muted/30"><History className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="font-semibold">No reward history yet.</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">Claim rewards from your loyalty cards and they will appear here.</p>
                </div>
              ) : history.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
                    {item.business_logo_url ? <img src={item.business_logo_url} alt="" className="h-full w-full object-cover" /> : <Sparkles className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.reward_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.business_name}</p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </CustomerLayout>
  );
}
