"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

  const reload = useCallback(async (options?: { silent?: boolean }): Promise<CustomerCardItem[]> => {
    if (!token) return [];
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const res = await customerCards(token);
      const list = res.data ?? [];
      setCards(list);

      if (list.length > 0) {
        const querySelectedId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("selected")
            : null;
        const savedSelectedId =
          typeof window !== "undefined"
            ? window.localStorage.getItem("digital_loyalty_selected_card")
            : null;
        const preferredId = querySelectedId ?? selected?.id ?? savedSelectedId;
        const next = (preferredId && list.find((card) => card.id === preferredId)) || list[0];
        setSelected(next);
        window.localStorage.setItem("digital_loyalty_selected_card", next.id);
      } else {
        setSelected(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("digital_loyalty_selected_card");
        }
      }

      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your cards");
      return [];
    } finally {
      setLoading(false);
    }
  }, [selected?.id, token]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("customer");
    const refresh = () => {
      void customerCards(token)
        .then((res) => {
          const list = res.data ?? [];
          setCards(list);
          if (!list.length) {
            setSelected(null);
            return;
          }
          const currentId = selected?.id;
          const next = (currentId && list.find((card) => card.id === currentId)) || list[0];
          setSelected(next);
        })
        .catch(() => undefined);
    };
    channel.listen("data.changed", refresh);
    return () => {
      channel.stopListening("data.changed", refresh);
    };
  }, [echo, selected?.id, token]);

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
                  if (!token || joining) return;
                  setJoining(true);
                  setError(null);

                  try {
                    const joinResult = await customerJoinByQr(token, qrCode);
                    await reload({ silent: true });
                    setScanOpen(false);

                    const membershipId = joinResult.customer?.id;
                    if (membershipId) {
                      const picked = await customerCardById(token, membershipId);
                      setSelected(picked.data);
                    }

                    router.push(membershipId ? `/user/cards?selected=${encodeURIComponent(membershipId)}` : "/user/cards");
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Unable to join this business from QR",
                    );
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
        <div className="space-y-4 lg:space-y-6">
          <div className="flex items-center justify-between gap-3 lg:mx-auto lg:max-w-5xl">
            <Badge className="shrink-0 border-white/30 bg-white/20 px-3 py-2 text-sm text-white shadow-sm backdrop-blur-sm">
              Card {Math.max(1, cards.findIndex((card) => card.id === selected?.id) + 1)} of {cards.length}
            </Badge>
            <Button
              type="button"
              onClick={() => router.push("/user/join")}
              className="min-w-0 flex-1 sm:flex-none"
            >
              + Add Loyalty Card
            </Button>
          </div>

          <CustomerCardCarousel
            cards={cards}
            selectedId={selected?.id}
            onChange={(card) => {
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
