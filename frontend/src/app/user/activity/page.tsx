"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CircleDot, Gift, Ticket } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerActivity } from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEcho } from "@/components/echo/echo-provider";

type ActivityItem = {
  id: string;
  type: string;
  business_id: string;
  customer_id: string;
  date: string | null;
  points?: number;
};

function iconForType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("reward")) return Gift;
  if (t.includes("visit") || t.includes("stamp")) return Ticket;
  return CircleDot;
}

export default function UserActivityPage() {
  const { token } = useCustomerAuth();
  const { echo } = useEcho();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    customerActivity(token)
      .then((res) => {
        setItems(res.data.items ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("customer");
    const refresh = () => {
      void customerActivity(token).then((res) => setItems(res.data.items ?? [])).catch(() => undefined);
    };
    channel.listen("data.changed", refresh);
    return () => { channel.stopListening("data.changed", refresh); };
  }, [echo, token]);

  return (
    <CustomerLayout title="Activity" subtitle="Your latest visits and reward events">
      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Loading activity...</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No recent activity yet. Your visits and rewards will appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = iconForType(item.type);
            return (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {item.type}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">{item.business_id}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="inline-flex items-center gap-2 text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    {item.date ?? "No date provided"}
                  </p>
                  {typeof item.points === "number" ? <p>Points: {item.points}</p> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </CustomerLayout>
  );
}
