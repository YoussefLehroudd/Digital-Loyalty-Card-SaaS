"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

type EchoPrivateChannelLike = {
  listen: (event: string, cb: (...args: unknown[]) => void) => EchoPrivateChannelLike;
  stopListening: (...args: unknown[]) => void;
};

type EchoLike = {
  private: (channel: string) => EchoPrivateChannelLike;
  disconnect: () => void;
};

type EchoContextValue = {
  echo: EchoLike | null;
  connected: boolean;
};

const EchoContext = createContext<EchoContextValue | null>(null);

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

    // Reverb via Pusher protocol settings (static env access for Next.js client build).
    const appKey = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
    const host = process.env.NEXT_PUBLIC_REVERB_HOST;
    const portRaw = process.env.NEXT_PUBLIC_REVERB_PORT;
    const scheme = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https").toLowerCase();

    if (!appKey) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_APP_KEY");
    if (!host) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_HOST");
    if (!portRaw) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_PORT");

    const port = Number(portRaw);
    if (!Number.isFinite(port)) {
      throw new Error("Invalid env var: NEXT_PUBLIC_REVERB_PORT must be a number");
    }

    // Ensure pusher is set up globally for Echo.
    (window as unknown as { Pusher?: typeof Pusher }).Pusher = Pusher;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (!apiUrl) {
      throw new Error("Missing env var: NEXT_PUBLIC_API_URL");
    }

    const forceTLS = scheme === "https";
    const enabledTransports = (forceTLS ? ["wss"] : ["ws", "wss"]) as unknown as any;

    const e = new Echo({
      broadcaster: "reverb",
      key: appKey,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS,
      enabledTransports,
      authEndpoint: `${apiUrl}/broadcasting/auth`,
      auth: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
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
