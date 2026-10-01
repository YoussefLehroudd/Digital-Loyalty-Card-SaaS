"use client";

import { useEffect, useState } from "react";
import { useEcho } from "@/components/echo/echo-provider";

type ReceivedEvent = { ts: number; name: string; payload: unknown };

export default function RealtimeTestPage() {
  const { echo, connected } = useEcho();
  const [events, setEvents] = useState<ReceivedEvent[]>([]);

  useEffect(() => {
    if (!echo) return;
    const channel = echo.private("business.current");
    const names = ["StampAdded", "RewardRedeemed", "MembershipCreated", "MembershipDeleted", "BusinessBrandUpdated", "BusinessCardUpdated"];
    const handlers = names.map((name) => {
      const handler = (payload?: unknown) =>
        setEvents((prev) => [{ ts: Date.now(), name, payload }, ...prev].slice(0, 25));
      channel.listen(name, handler);
      return { name, handler };
    });
    return () => handlers.forEach(({ name, handler }) => channel.stopListening(name, handler));
  }, [echo]);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="text-2xl font-semibold">Vercel + Neon Realtime</h1>
      <div className="mt-4 rounded-lg border bg-card p-4">
        <span className="font-medium">Realtime status:</span>{" "}
        {connected ? "Connected" : "Waiting for authenticated session"}
      </div>
      <div className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">Live events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new events yet.</p>
        ) : events.map((event, index) => (
          <pre key={`${event.ts}-${index}`} className="rounded-lg border bg-card p-3 text-sm">
            {JSON.stringify(event, null, 2)}
          </pre>
        ))}
      </div>
    </main>
  );
}
