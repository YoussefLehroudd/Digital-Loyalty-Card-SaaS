"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerNotifications } from "@/lib/customerAuth";
import { CustomerListSkeleton } from "@/components/customer-app/customer-skeletons";
import { CustomerEmptyState } from "@/components/customer-app/customer-empty-state";
import { PullToRefresh } from "@/components/customer-app/pull-to-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEcho } from "@/components/echo/echo-provider";

type NotificationItem = {
  id?: string;
  title?: string;
  message?: string;
  created_at?: string;
  read?: boolean;
};

export default function UserNotificationsPage() {
  const { token } = useCustomerAuth();
  const { echo } = useEcho();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);

    try {
      const res = await customerNotifications(token);
      setItems((res.data as NotificationItem[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("customer");
    const refresh = () => {
      void customerNotifications(token).then((res) => setItems((res.data as NotificationItem[]) ?? [])).catch(() => undefined);
    };
    channel.listen("data.changed", refresh);
    return () => { channel.stopListening("data.changed", refresh); };
  }, [echo, token]);

  return (
    <CustomerLayout title="Notifications" subtitle="Recent updates and reward alerts">
      <PullToRefresh onRefresh={load}>
        {loading ? (
          <CustomerListSkeleton rows={4} />
        ) : error ? (
          <Card className="border-destructive/30">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={load}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <CustomerEmptyState
            title="No notifications yet"
            description="When businesses update your card progress or rewards, you will see it here."
            actionLabel="Refresh"
            onAction={load}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <Card key={item.id ?? `notification-${idx}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BellRing className="h-4 w-4 text-muted-foreground" />
                    {item.title ?? "Notification"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm">{item.message ?? "No content provided."}</p>
                  <p className="text-xs text-muted-foreground">{item.created_at ?? "Unknown date"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PullToRefresh>
    </CustomerLayout>
  );
}
