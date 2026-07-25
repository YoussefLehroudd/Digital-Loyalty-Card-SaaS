"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { CustomerCardCarousel } from "@/components/customer-app/customer-card-carousel";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerCardById, customerCards, customerJoinByQr, type CustomerCardItem } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";

export default function UserCardsPage() {
  const router = useRouter();
  const { token } = useCustomerAuth();
  const [cards, setCards] = useState<CustomerCardItem[]>([]);
  const [selected, setSelected] = useState<CustomerCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const reload = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await customerCards(token);
      const list = res.data ?? [];
      setCards(list);

      if (list.length > 0) {
        const picked = await customerCardById(token, list[0].id);
        setSelected(picked.data);
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [token]);

  return (
    <CustomerLayout title="My Cards" subtitle="Switch between business loyalty cards">
      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Loading cards...</CardContent>
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
              Scan a business QR code to get your loyalty card instantly
            </p>
            <Button type="button" onClick={() => setScanOpen((v) => !v)} disabled={joining}>
              {scanOpen ? "Close Scanner" : "Scan QR Code"}
            </Button>

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

                    const cardId = joinResult.loyalty_card?.id;
                    if (cardId) {
                      const picked = await customerCardById(token, cardId);
                      setSelected(picked.data);
                    }

                    router.push("/user/cards");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Unable to join this business from QR");
                  } finally {
                    setJoining(false);
                  }
                }}
              />
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <CustomerCardCarousel
            cards={cards}
            selectedId={selected?.id}
            onChange={(card) => {
              setSelected(card);
            }}
          />
        </div>
      )}
    </CustomerLayout>
  );
}
