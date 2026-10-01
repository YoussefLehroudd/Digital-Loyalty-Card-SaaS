"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CircleDot, Gift, Store, Ticket } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerActivity } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEcho } from "@/components/echo/echo-provider";

type ActivityItem = {
  id: string;
  type: string;
  business_id: string;
  customer_id: string;
  business_name: string;
  business_logo_url: string | null;
  business_primary_color: string | null;
  reward_name?: string | null;
  date: string | null;
  points?: number;
};

function iconForType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("reward")) return Gift;
  if (t.includes("visit") || t.includes("stamp")) return Ticket;
  return CircleDot;
}

function labelForType(type: string) {
  if (type === "reward_redeemed") return "Reward redeemed";
  if (type === "reward_earned") return "Reward unlocked";
  if (type === "visit") return "Stamp earned";
  return type.replaceAll("_", " ");
}

function formatActivityDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = sameDay ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} · ${time}`;
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
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {items.map((item) => {
            const Icon = iconForType(item.type);
            const rewardEvent = item.type.includes("reward");
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background shadow-sm">
                      {item.business_logo_url ? (
                        <img src={item.business_logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-tl-md bg-background/90">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{item.business_name}</p>
                          <p className="mt-0.5 text-sm font-medium">{labelForType(item.type)}</p>
                        </div>
                        {typeof item.points === "number" ? (
                          <Badge className="shrink-0">+{item.points} stamp</Badge>
                        ) : rewardEvent ? (
                          <Badge className="shrink-0">{item.type === "reward_redeemed" ? "Redeemed" : "Unlocked"}</Badge>
                        ) : null}
                      </div>
                      {item.reward_name ? <p className="mt-2 text-sm text-muted-foreground">{item.reward_name}</p> : null}
                      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatActivityDate(item.date)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </CustomerLayout>
  );
}
