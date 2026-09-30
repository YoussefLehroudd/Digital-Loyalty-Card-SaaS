"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useEcho } from "@/components/echo/echo-provider";

type ReceivedEvent = {
  ts: number;
  raw: unknown;
};

type EchoChannel = {
  subscribed?: (callback: () => void) => void;
  listen: (event: string, callback: (payload: unknown) => void) => void;
  stopListening?: (event: string) => void;
};

type EchoLike = {
  connector?: {
    pusher?: {
      connection?: {
        socket_id?: string | null;
        state?: string;
      };
    };
  };
  channel: (name: string) => EchoChannel;
  leaveChannel?: (name: string) => void;
};

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

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

    const echoClient = echo as unknown as EchoLike;
    const id = echoClient.connector?.pusher?.connection?.socket_id ?? null;
    setSocketId(id);

    let channel: EchoChannel;
    const name = "test-public";

    try {
      channel = echoClient.channel(name);

      channel.subscribed?.(() => {
        setChannelSubscribed(true);
      });

      channel.listen("TestEvent", (payload: unknown) => {
        setEvents((prev) => [{ ts: Date.now(), raw: payload }, ...prev]);
      });
    } catch {
      return;
    }

    return () => {
      channel.stopListening?.("TestEvent");
      echoClient.leaveChannel?.(name);
    };
  }, [echo]);

  const websocketState = useMemo(() => {
    if (!mounted) return "Echo not created";
    if (!echo) return "Echo not created";

    const echoClient = echo as unknown as EchoLike;
    return echoClient.connector?.pusher?.connection?.state ?? "unknown";
  }, [echo, mounted]);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="text-2xl font-semibold">Realtime Test</h1>

      <div className="mt-4 space-y-2 rounded-lg border bg-card p-4">
        <div>
          <span className="font-medium">Echo connected:</span>{" "}
          {connected ? "Yes" : "No"}
        </div>
        <div>
          <span className="font-medium">WebSocket state:</span> {websocketState}
        </div>
        <div>
          <span className="font-medium">Socket ID:</span> {socketId ?? "-"}
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
            const res = await fetch(`${getApiBaseUrl()}/test-broadcast`, {
              method: "GET",
            });
            await res.json();
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
