"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Gift, LayoutGrid, Link2, Plus, QrCode, Sparkles, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  const router = useRouter();
  const { echo, connected } = useEcho();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CustomerCardItem[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
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
        const nextCards = cardsRes.data ?? [];
        setCards(nextCards);
        const savedCardId = window.localStorage.getItem("digital_loyalty_selected_card");
        const nextSelectedId =
          (savedCardId && nextCards.some((card) => card.id === savedCardId) && savedCardId) ||
          nextCards[0]?.id ||
          null;
        setSelectedCardId(nextSelectedId);
        if (nextSelectedId) window.localStorage.setItem("digital_loyalty_selected_card", nextSelectedId);
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

  // Keep the visible loyalty card in sync after a business adds a stamp or redeems a reward.
  // The realtime provider polls the server version; this fallback also refreshes while the tab is visible.
  useEffect(() => {
    if (!token) return;
    const refreshCards = () => {
      void customerCards(token).then((res) => setCards(res.data ?? [])).catch(() => undefined);
    };
    const timer = window.setInterval(refreshCards, connected ? 2000 : 4000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshCards(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [token, connected]);

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
          <Card className="border-[#d8a63f]/15 bg-[linear-gradient(145deg,rgba(18,19,16,.88),rgba(10,11,9,.82))] shadow-[0_12px_32px_rgba(0,0,0,.18)]">
            <CardContent className="p-4 text-sm text-muted-foreground">Loading dashboard...</CardContent>
          </Card>
        </div>
      ) : (
        <div className="mx-auto max-w-[1440px] space-y-5 lg:space-y-7">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3">
            <Card className="border-[#d8a63f]/15 bg-[linear-gradient(145deg,rgba(18,19,16,.88),rgba(10,11,9,.82))] shadow-[0_12px_32px_rgba(0,0,0,.18)]">
              <CardHeader className="pb-1.5 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Cards</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between pb-4">
                <p className="text-2xl font-bold tracking-tight text-white lg:text-3xl">{cards.length}</p>
                <Building2 className="h-5 w-5 text-[#d8a63f]" />
              </CardContent>
            </Card>

            <Card className="border-[#d8a63f]/15 bg-[linear-gradient(145deg,rgba(18,19,16,.88),rgba(10,11,9,.82))] shadow-[0_12px_32px_rgba(0,0,0,.18)]">
              <CardHeader className="pb-1.5 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Stamps</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between pb-4">
                <p className="text-2xl font-bold tracking-tight text-white lg:text-3xl">{totalStamps}</p>
                <Ticket className="h-5 w-5 text-[#d8a63f]" />
              </CardContent>
            </Card>

            <Card className="border-[#d8a63f]/15 bg-[linear-gradient(145deg,rgba(18,19,16,.88),rgba(10,11,9,.82))] shadow-[0_12px_32px_rgba(0,0,0,.18)]">
              <CardHeader className="pb-1.5 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Ready rewards</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between pb-4">
                <p className="text-2xl font-bold tracking-tight text-white lg:text-3xl">{availableRewards}</p>
                <Gift className="h-5 w-5 text-[#d8a63f]" />
              </CardContent>
            </Card>

            <Card className="border-[#d8a63f]/15 bg-[linear-gradient(145deg,rgba(18,19,16,.88),rgba(10,11,9,.82))] shadow-[0_12px_32px_rgba(0,0,0,.18)]">
              <CardHeader className="pb-1.5 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Activity</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between pb-4">
                <p className="text-2xl font-bold tracking-tight text-white lg:text-3xl">{activitiesCount}</p>
                <Sparkles className="h-5 w-5 text-[#d8a63f]" />
              </CardContent>
            </Card>
          </div>

          {cards.length === 0 ? (
            <Card className="overflow-hidden border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(15,16,13,.96),rgba(8,9,7,.92))]">
              <CardContent className="flex flex-col items-center px-5 py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-[#e7b354]/25 bg-[#8b5d12]/20 text-[#ffc857]">
                  <QrCode className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">Add your first loyalty card</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Scan a business QR code to join its loyalty program and start collecting stamps.
                </p>
                <Button className="mt-5 w-full sm:w-auto" onClick={() => router.push("/user/join")}>
                  <QrCode className="size-4" /> Scan business QR
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="relative overflow-hidden rounded-[22px] border border-[#d9a72e]/45 bg-[radial-gradient(ellipse_at_-8%_75%,rgba(208,148,20,.14),transparent_28%),radial-gradient(ellipse_at_108%_70%,rgba(208,148,20,.14),transparent_28%),linear-gradient(145deg,#10110f_0%,#090a08_52%,#0c0d0b_100%)] shadow-[inset_0_1px_0_rgba(255,213,103,.08),0_24px_70px_rgba(0,0,0,.32)] lg:min-h-[440px]">
                <div className="relative z-20 flex items-center justify-between gap-3 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[linear-gradient(145deg,rgba(157,107,17,.36),rgba(87,57,9,.28))] text-[#ffd369] shadow-[inset_0_0_18px_rgba(255,194,64,.08)] lg:size-12">
                      <QrCode className="size-4 lg:size-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-white sm:text-lg lg:text-xl">Your loyalty cards</h2>
                      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs lg:text-sm">Swipe or switch between businesses.</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button className="border border-[#ffd56b]/45 bg-[linear-gradient(180deg,#ffd36a,#eeb84d)] font-semibold text-black shadow-[0_8px_24px_rgba(215,155,22,.18)] hover:bg-[#f4c86f] lg:h-11 lg:px-5" size="sm" onClick={() => router.push("/user/join")}>
                      <Plus className="size-4" /> <span className="hidden sm:inline">Add card</span>
                    </Button>
                    <div className="hidden rounded-lg border border-[#d8a63f]/20 bg-black/30 p-1 sm:flex lg:h-11 lg:items-center">
                      <span className="flex size-7 items-center justify-center rounded-md bg-[#d79b16]/12 text-[#ffc857]"><LayoutGrid className="size-3.5" /></span>
                      <span className="flex size-7 items-center justify-center text-muted-foreground"><Link2 className="size-3.5" /></span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 px-2 pb-3 sm:px-4 sm:pb-4 lg:-mt-1 lg:px-8 lg:pb-5">
                  <CustomerCardCarousel
            cards={cards}
            dashboardMode
            selectedId={selectedCardId}
            onChange={(card) => {
              setSelectedCardId(card.id);
              window.localStorage.setItem("digital_loyalty_selected_card", card.id);
            }}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </CustomerLayout>
  );
}
