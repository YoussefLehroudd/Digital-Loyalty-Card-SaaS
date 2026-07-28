"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

type EchoContextValue = {
  // Echo has complex generics and connector typing; keep it typed loosely but safely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  echo: any | null;
  connected: boolean;
};

const EchoContext = createContext<EchoContextValue | null>(null);

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function EchoProvider({
  children,
  token,
}: {
  children: React.ReactNode;
  token: string | null;
}) {
  const [connected, setConnected] = useState(false);

  const echo = useMemo(() => {
    if (!token) return null;

    // Reverb via Pusher protocol settings.
    const appKey = getEnv("NEXT_PUBLIC_REVERB_APP_KEY");
    const host = getEnv("NEXT_PUBLIC_REVERB_HOST");
    const port = Number(getEnv("NEXT_PUBLIC_REVERB_PORT"));
    const scheme = getEnv("NEXT_PUBLIC_REVERB_SCHEME") || "https";

    // Ensure pusher is set up globally for Echo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Pusher = Pusher;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e: any = new (Echo as any)({
      broadcaster: "reverb",
      key: appKey,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: scheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000"}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      // Avoid noisy reconnect loops while app bootstraps.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return e;
  }, [token]);

  useEffect(() => {
    if (!echo) return;

    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    // laravel-echo types are strict; use runtime connector shape.
    const anyEcho = echo as any;
    const pusherConnection = anyEcho?.connector?.pusher?.connection;

    if (!pusherConnection?.bind) return;

    pusherConnection.bind("connected", onConnected);
    pusherConnection.bind("disconnected", onDisconnected);
    pusherConnection.bind("unavailable", onDisconnected);

    return () => {
      try {
        pusherConnection.unbind("connected", onConnected);
        pusherConnection.unbind("disconnected", onDisconnected);
        pusherConnection.unbind("unavailable", onDisconnected);
      } catch {
        // no-op
      }
    };
  }, [echo]);

  useEffect(() => {
    if (!echo) return;
    return () => {
      echo.disconnect();
    };
  }, [echo]);

  return <EchoContext.Provider value={{ echo, connected }}>{children}</EchoContext.Provider>;
}

export function useEcho() {
  const ctx = useContext(EchoContext);
  if (!ctx) throw new Error("useEcho must be used inside EchoProvider");
  return ctx;
}
