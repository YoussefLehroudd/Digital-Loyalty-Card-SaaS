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
    const hostFromEnv = process.env.NEXT_PUBLIC_REVERB_HOST;
    const portRawFromEnv = process.env.NEXT_PUBLIC_REVERB_PORT;
    const scheme = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https").toLowerCase();

    // Important for Railway/production:
    // - Do NOT hardcode 127.0.0.1 in client-side WebSocket config.
    // - If REVERB host isn't provided, fall back to the current browser hostname.
    const host =
      (hostFromEnv && hostFromEnv.trim().length > 0
        ? hostFromEnv.trim()
        : typeof window !== "undefined"
          ? window.location.hostname
          : null);

    const portRaw =
      (portRawFromEnv && portRawFromEnv.trim().length > 0
        ? portRawFromEnv.trim()
        : typeof window !== "undefined"
          ? window.location.port
          : null);

    if (!appKey) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_APP_KEY");
    if (!host) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_HOST (and window.location.hostname is unavailable)");
    if (!portRaw) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_PORT (and window.location.port is unavailable)");

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

    // If NEXT_PUBLIC_API_URL includes "/api", strip it for Laravel broadcasting auth.
    const laravelBaseUrl = apiUrl.replace(/\/api\/?$/, "");

    const forceTLS = scheme === "https";
    const enabledTransports: Array<"ws" | "wss"> = forceTLS ? ["wss"] : ["ws", "wss"];

    const e = new Echo({
      broadcaster: "reverb",
      key: appKey,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS,
      enabledTransports,
      authEndpoint: `${laravelBaseUrl}/broadcasting/auth`,
      auth: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    // Cast because Echo's runtime connector shape isn't strongly typed.
    return e as unknown as EchoLike;
  }, [token]);

  // Intentionally no manual binding/unbinding to internal Echo connector internals.
  // The connector shape differs across builds/versions and can crash at runtime.

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
