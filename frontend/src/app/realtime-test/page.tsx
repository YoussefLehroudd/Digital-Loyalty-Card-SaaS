"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useEcho } from "@/components/echo/echo-provider";

type ReceivedEvent = {
  ts: number;
  raw: unknown;
};

export default function RealtimeTestPage() {
  const { echo, connected } = useEcho();
  const [channelSubscribed, setChannelSubscribed] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [events, setEvents] = useState<ReceivedEvent[]>([]);
  const [mounted, setMounted] = useState(false);

  const publicChannelName = useMemo(() => "test-public", []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!echo) return;

    const anyEcho = echo as any;

    // Socket id (best-effort, depends on Echo internals)
    try {
      const id = anyEcho?.connector?.pusher?.connection?.socket_id ?? null;
      setSocketId(id);
    } catch {
      // ignore
    }

    let channel: any;
    const name = "test-public";

    try {
      // Public channel subscription (must use channel(), not private())
      channel = anyEcho.channel(name);

      channel.subscribed?.(() => {
        setChannelSubscribed(true);
        // eslint-disable-next-line no-console
        console.log("[RealtimeTest] Channel subscribed:", name);
      });

      channel.listen("TestEvent", (payload: unknown) => {
        // eslint-disable-next-line no-console
        console.log("[RealtimeTest] TestEvent received:", payload);

        setEvents((prev) => [{ ts: Date.now(), raw: payload }, ...prev]);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[RealtimeTest] Subscription/setup failed:", e);
      return;
    }

    return () => {
      try {
        channel?.stopListening?.("TestEvent");
        anyEcho?.leaveChannel?.(name);
      } catch {
        // ignore
      }
    };
  }, [echo]);

  const websocketState = useMemo(() => {
    if (!mounted) return "Echo not created";
    if (!echo) return "Echo not created";
    try {
      const state = (echo as any)?.connector?.pusher?.connection?.state;
      return state ?? "unknown";
    } catch {
      return "unknown";
    }
  }, [echo, events.length, connected, mounted]);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="text-2xl font-semibold">Realtime Test</h1>

      <div className="mt-4 space-y-2 rounded-lg border bg-card p-4">
        <div>
          <span className="font-medium">Echo connected:</span>{" "}
          {connected ? "Yes" : "No"}
        </div>
        <div>
          <span className="font-medium">WebSocket state:</span>{" "}
          {websocketState}
        </div>
        <div>
          <span className="font-medium">Socket ID:</span>{" "}
          {socketId ?? "—"}
        </div>
        <div>
          <span className="font-medium">Channel:</span> {publicChannelName} /{" "}
          {channelSubscribed ? "Subscribed" : "Not subscribed"}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Received events</h2>
        <button
          type="button"
          className="rounded-md border bg-background px-3 py-1 text-sm"
          onClick={async () => {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? ""}/api/test-broadcast`,
              { method: "GET" }
            );
            const json = await res.json();
            // eslint-disable-next-line no-console
            console.log("[RealtimeTest] /api/test-broadcast response:", json);
          }}
        >
          Trigger /api/test-broadcast
        </button>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events yet. Trigger the endpoint.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((ev, idx) => (
              <div
                key={`${ev.ts}-${idx}`}
                className="rounded-lg border bg-card p-3"
              >
                <div className="text-xs text-muted-foreground">
                  {new Date(ev.ts).toISOString()}
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {JSON.stringify(ev.raw, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
