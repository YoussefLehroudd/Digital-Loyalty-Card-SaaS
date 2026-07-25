"use client";

import { useEffect, useState } from "react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { CustomerCardCarousel } from "@/components/customer-app/customer-card-carousel";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerCardById, customerCards, type CustomerCardItem } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UserCardsPage() {
  const { token } = useCustomerAuth();
  const [cards, setCards] = useState<CustomerCardItem[]>([]);
  const [selected, setSelected] = useState<CustomerCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
