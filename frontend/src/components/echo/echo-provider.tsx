"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

type EchoLike = {
  private: (channel: string) => { listen: (event: string, cb: (...args: unknown[]) => void) => EchoLike; stopListening: (...args: unknown[]) => void };
  disconnect: () => void;
};

type EchoContextValue = {
  echo: EchoLike | null;
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
    (window as unknown as { Pusher?: typeof Pusher }).Pusher = Pusher;

    const e = new Echo({
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
    });

    // Cast because Echo's runtime connector shape isn't strongly typed.
    return e as unknown as EchoLike;
  }, [token]);

  useEffect(() => {
    if (!echo) return;

    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    const echoUnknown = echo as unknown as {
      connector?: {
        pusher?: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          connection?: { bind?: (event: string, cb: () => void) => void; unbind?: (event: string, cb: () => void) => void };
        };
      };
    };

    const pusherConnection = echoUnknown?.connector?.pusher?.connection;

    const bind = pusherConnection?.bind;
    const unbind = pusherConnection?.unbind;

    if (!bind || !unbind) return;

    bind("connected", onConnected);
    bind("disconnected", onDisconnected);
    bind("unavailable", onDisconnected);

    return () => {
      try {
        unbind("connected", onConnected);
        unbind("disconnected", onDisconnected);
        unbind("unavailable", onDisconnected);
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
