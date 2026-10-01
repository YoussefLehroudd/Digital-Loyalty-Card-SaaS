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
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";

function CardsUI() {
  const router = useRouter();
  const { token } = useCustomerAuth();
  const [cards, setCards] = useState<CustomerCardItem[]>([]);
  const [selected, setSelected] = useState<CustomerCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const reload = useCallback(async (): Promise<CustomerCardItem[]> => {
    if (!token) return [];
    setLoading(true);
    setError(null);

    try {
      const res = await customerCards(token);
      const list = res.data ?? [];
      setCards(list);

      if (list.length > 0) {
        const nextSelectedId = selected?.id ?? list[0].id;
        const picked = await customerCardById(token, nextSelectedId);
        setSelected(picked.data);
      } else {
        setSelected(null);
      }

      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your cards");
      return [];
    } finally {
      setLoading(false);
    }
  }, [selected?.id, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
            <Button variant="outline" onClick={reload}>
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
                    await reload();
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
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              onClick={() => router.push("/user/join")}
              className="w-full sm:w-auto"
            >
              + Add Loyalty Card
            </Button>
          </div>

          <CustomerCardCarousel
            cards={cards}
            selectedId={selected?.id}
            onChange={(card) => setSelected(card)}
            onRefresh={reload}
          />
        </div>
      )}
    </CustomerLayout>
  );
}

export default function UserCardsPage() {
  return <CardsUI />;
}
