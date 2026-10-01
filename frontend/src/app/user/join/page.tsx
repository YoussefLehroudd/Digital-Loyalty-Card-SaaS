"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerCards, customerJoinByQr, type CustomerCardItem } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UserJoinPage() {
  const router = useRouter();
  const { token } = useCustomerAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cardsSnapshot, setCardsSnapshot] = useState<CustomerCardItem[] | null>(null);

  const reloadCards = async (): Promise<CustomerCardItem[]> => {
    if (!token) return [];
    const res = await customerCards(token);
    return res.data ?? [];
  };

  return (
    <CustomerLayout title="Join Loyalty Program" subtitle="Scan a QR code to add a loyalty card">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Point your camera at the business QR code.
            </p>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {loading ? (
              <p className="text-sm text-muted-foreground">Adding card…</p>
            ) : null}
          </CardContent>
        </Card>

        <StaffQrScanner
          onQrScanned={async (qrCode) => {
            if (!token) return;
            if (loading) return;

            setLoading(true);
            setError(null);

            try {
              const joinResult = await customerJoinByQr(token, qrCode);

              // Refresh cards first so we can auto-select newly added card.
              const refreshed = await reloadCards();
              setCardsSnapshot(refreshed);

              const membershipId = joinResult.customer?.id;
              router.push(membershipId ? `/user/cards?selected=${encodeURIComponent(membershipId)}` : "/user/cards");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Unable to join this business from QR",
              );
            } finally {
              setLoading(false);
            }
          }}
        />

        {cardsSnapshot ? (
          <Button variant="outline" onClick={async () => router.push("/user/cards")} disabled={loading}>
            View my cards
          </Button>
        ) : null}
      </div>
    </CustomerLayout>
  );
}
