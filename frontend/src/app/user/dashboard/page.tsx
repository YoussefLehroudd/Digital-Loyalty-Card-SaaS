"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Gift, Sparkles, Ticket } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { CustomerCardCarousel } from "@/components/customer-app/customer-card-carousel";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import {
  customerActivity,
  customerCards,
  customerRewards,
  type CustomerCardItem,
} from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEcho } from "@/components/echo/echo-provider";

export default function UserDashboardPage() {
  const { token, user } = useCustomerAuth();
  const { echo } = useEcho();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CustomerCardItem[]>([]);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [availableRewards, setAvailableRewards] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const totalStamps = useMemo(
    () => cards.reduce((sum, card) => sum + (card.loyalty?.current_stamps ?? 0), 0),
    [cards],
  );

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([customerCards(token), customerActivity(token), customerRewards(token)])
      .then(([cardsRes, activityRes, rewardsRes]) => {
        if (!mounted) return;
        setCards(cardsRes.data ?? []);
        setActivitiesCount(activityRes.data.items?.length ?? 0);
        setAvailableRewards(
          (rewardsRes.data.available ?? []).filter((item) => Boolean(item.ready)).length,
        );
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("customer");
    const refresh = () => {
      void Promise.all([customerCards(token), customerActivity(token), customerRewards(token)])
        .then(([cardsRes, activityRes, rewardsRes]) => {
          setCards(cardsRes.data ?? []);
          setActivitiesCount(activityRes.data.items?.length ?? 0);
          setAvailableRewards((rewardsRes.data.available ?? []).filter((item) => Boolean(item.ready)).length);
        })
        .catch(() => undefined);
    };
    channel.listen("data.changed", refresh);
    return () => {
      channel.stopListening("data.changed", refresh);
    };
  }, [echo, token]);

  return (
    <CustomerLayout
      title="Dashboard"
      subtitle={user ? `Welcome back, ${user.customer_profile?.first_name ?? user.name}` : "Your loyalty overview"}
    >
      {error ? (
        <Card className="mb-4 border-destructive/30">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading dashboard...</CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Cards</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{cards.length}</p>
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Stamps</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{totalStamps}</p>
                <Ticket className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Ready rewards</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{availableRewards}</p>
                <Gift className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Activity</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{activitiesCount}</p>
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          <CustomerCardCarousel cards={cards} />
        </div>
      )}
    </CustomerLayout>
  );
}
