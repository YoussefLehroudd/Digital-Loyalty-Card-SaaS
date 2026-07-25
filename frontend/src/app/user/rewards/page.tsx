"use client";

import { useEffect, useState } from "react";
import { Gift, History, Sparkles } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerRewards } from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RewardItem = {
  loyalty_card_id: string;
  business_id: string;
  reward_name: string;
  reward_description: string | null;
  points_required: number;
  ready: boolean;
};

type RewardHistoryItem = {
  id: string;
  status: string;
  business_id: string;
  customer_id: string;
  earned_at: string | null;
  redeemed_at: string | null;
};

export default function UserRewardsPage() {
  const { token } = useCustomerAuth();
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4" />
                Available rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available rewards yet.</p>
              ) : (
                available.map((reward) => (
                  <div key={`${reward.business_id}-${reward.loyalty_card_id}`} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{reward.reward_name}</p>
                      <Badge className={reward.ready ? "text-emerald-600 border-emerald-200 bg-emerald-50" : ""}>
                        {reward.ready ? "Ready" : "In progress"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reward.reward_description ?? "Collect required stamps to unlock this reward."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Required: {reward.points_required} stamps
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Reward history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reward history yet.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Status: {item.status}</p>
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Business ID: {item.business_id}</p>
                    {item.earned_at ? (
                      <p className="text-xs text-muted-foreground">Earned: {item.earned_at}</p>
                    ) : null}
                    {item.redeemed_at ? (
                      <p className="text-xs text-muted-foreground">Redeemed: {item.redeemed_at}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </CustomerLayout>
  );
}
