"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { CustomerCardCarousel } from "@/components/customer-app/customer-card-carousel";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import {
  customerCardById,
  customerCards,
  customerJoinByQr,
  type CustomerCardItem,
} from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { useEcho } from "@/components/echo/echo-provider";

function CardsUI() {
  const router = useRouter();
  const { token } = useCustomerAuth();
  const { echo } = useEcho();
  const [cards, setCards] = useState<CustomerCardItem[]>([]);
  const [selected, setSelected] = useState<CustomerCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(0);

  const reload = useCallback(async (options?: { silent?: boolean }): Promise<CustomerCardItem[]> => {
    if (!token) return [];
    const silent = options?.silent ?? false;
    const requestId = ++requestIdRef.current;
    pendingRef.current += 1;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await customerCards(token);
      const list = res.data ?? [];
      if (requestId !== requestIdRef.current) return list;
      setCards(list);
      setError(null);
      const preferredId = selectedIdRef.current
        ?? new URLSearchParams(window.location.search).get("selected")
        ?? window.localStorage.getItem("digital_loyalty_selected_card");
      const next = (preferredId && list.find((card) => card.id === preferredId)) || list[0] || null;
      selectedIdRef.current = next?.id ?? null;
      setSelected(next);
      if (next) window.localStorage.setItem("digital_loyalty_selected_card", next.id);
      else window.localStorage.removeItem("digital_loyalty_selected_card");
      return list;
    } catch (err) {
      if (requestId === requestIdRef.current && !silent) {
        setError(err instanceof Error ? err.message : "Failed to load your cards");
      }
      return [];
    } finally {
      pendingRef.current -= 1;
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = async () => {
      if (cancelled || pendingRef.current > 0) return;
      await reload({ silent: true });
    };
    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") await refresh();
      if (!cancelled) timer = window.setTimeout(poll, 1500);
    };
    void reload();
    timer = window.setTimeout(poll, 1500);
    const channel = echo?.private("customer");
    const onChange = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    channel?.listen("data.changed", onChange);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onChange);
    window.addEventListener("online", onChange);
    return () => {
      cancelled = true;
      requestIdRef.current += 1;
      if (timer !== undefined) window.clearTimeout(timer);
      channel?.stopListening("data.changed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("online", onChange);
    };
  }, [echo, reload, token]);

  return (
    <CustomerLayout
      title="My Cards"
      subtitle="Switch between business loyalty cards"
    >
      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Loading cards...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Join a business loyalty program to see your cards here.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => router.push("/user/join")}
                disabled={joining}
              >
                Join Loyalty Program
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setScanOpen((v) => !v)}
                disabled={joining}
              >
                {scanOpen ? "Close Scanner" : "Scan QR Code"}
              </Button>
            </div>

            {scanOpen ? (
              <StaffQrScanner
                onQrScanned={async (qrCode) => {
                  if (!token || joining) return false;
                  setJoining(true);
                  setError(null);

                  try {
                    const joinResult = await customerJoinByQr(token, qrCode);
                    await reload({ silent: true });
                    setScanOpen(false);

                    const membershipId = joinResult.customer?.id;
                    if (membershipId) {
                      const picked = await customerCardById(token, membershipId);
                      selectedIdRef.current = picked.data.id;
                      setSelected(picked.data);
                    }

                    router.push(membershipId ? `/user/cards?selected=${encodeURIComponent(membershipId)}` : "/user/cards");
                    return true;
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Unable to join this business from QR",
                    );
                    return false;
                  } finally {
                    setJoining(false);
                  }
                }}
              />
            ) : null}

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="relative mx-auto w-full max-w-[960px] space-y-6 overflow-hidden rounded-[22px] border border-[#d9a72e]/45 bg-[radial-gradient(ellipse_at_-8%_75%,rgba(208,148,20,.14),transparent_28%),radial-gradient(ellipse_at_108%_70%,rgba(208,148,20,.14),transparent_28%),linear-gradient(145deg,#10110f_0%,#090a08_52%,#0c0d0b_100%)] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,213,103,.08),0_24px_70px_rgba(0,0,0,.32)] sm:p-6 lg:p-8 lg:pt-[10px] lg:pb-[10px] lg:space-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:absolute lg:inset-x-8 lg:top-[10px] lg:z-10">
            <Badge className="shrink-0 rounded-full border-[#d8a63f]/25 bg-[#d8a63f]/10 px-3 py-2 text-xs font-medium text-[#ffd369] sm:text-sm">
              Card {Math.max(1, cards.findIndex((card) => card.id === selected?.id) + 1)} of {cards.length}
            </Badge>
            <Button
              type="button"
              onClick={() => router.push("/user/join")}
              className="h-11 min-w-0 rounded-xl lg:h-[50px] lg:w-[283px] lg:rounded-full border border-[#ffd56b]/45 bg-[linear-gradient(180deg,#ffd36a,#eeb84d)] px-3 text-xs font-semibold text-black shadow-[0_8px_24px_rgba(215,155,22,.18)] transition hover:brightness-110 active:scale-[.98] sm:px-4 sm:text-sm"
            >
              <Plus className="size-4 shrink-0" /> Add Loyalty Card
            </Button>
          </div>

          <CustomerCardCarousel
            cards={cards}
            selectedId={selected?.id}
            onChange={(card) => {
              selectedIdRef.current = card.id;
              setSelected(card);
              window.localStorage.setItem("digital_loyalty_selected_card", card.id);
            }}
            onRefresh={() => reload({ silent: true })}
          />
        </div>
      )}
    </CustomerLayout>
  );
}

export default function UserCardsPage() {
  return <CardsUI />;
}
