"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

type EchoContextValue = {
  echo: any | null;
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
    if (typeof window === "undefined") return null;

    const appKey = process.env.NEXT_PUBLIC_REVERB_APP_KEY?.trim();
    const hostFromEnv = process.env.NEXT_PUBLIC_REVERB_HOST;
    const portRawFromEnv = process.env.NEXT_PUBLIC_REVERB_PORT;
    const scheme = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https").toLowerCase();

    const host = hostFromEnv?.trim();
    const portRaw = portRawFromEnv?.trim();

    if (!appKey) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_APP_KEY");
    if (!host) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_HOST");
    if (!portRaw) throw new Error("Missing env var: NEXT_PUBLIC_REVERB_PORT");

    const port = Number(portRaw);
    if (!Number.isFinite(port)) throw new Error("NEXT_PUBLIC_REVERB_PORT must be a number");

    // Railway/Reverb can be ws or wss. Enable both to avoid transport/scheme mismatch.
    const forceTLS = scheme === "https";
    const enabledTransports = ["ws", "wss"] as any;

    const pusherClient = new Pusher(appKey, {
      cluster: "mt1",
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS,
      enabledTransports,
    });

    // Critical-path diagnostics: verify the exact runtime values used by the browser
    console.log("[Echo/Reverb] Using client config:", {
      key: appKey,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      scheme,
      forceTLS,
      enabledTransports,
    });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    const laravelBaseUrl = apiUrl?.replace(/\/api\/?$/, "");

    const echoConfig = {
      broadcaster: "reverb",
      key: appKey,
      client: pusherClient,
    } as any;

    if (token) {
      if (!laravelBaseUrl) throw new Error("Missing env var: NEXT_PUBLIC_API_URL");
      (echoConfig as any).authEndpoint = `${laravelBaseUrl}/broadcasting/auth`;
      (echoConfig as any).auth = {
        headers: { Authorization: `Bearer ${token}` },
      };
    }

    const instance = new Echo(echoConfig as any);

    console.log("Echo instance:", instance);

    // مؤقتًا للتشخيص
    (window as any).Echo = instance;

    return instance;
  }, [token]);

  useEffect(() => {
    if (!echo) return;

    const connection = (echo as any)?.connector?.pusher?.connection;
    if (!connection?.bind) return;

    console.log("Initial state:", connection.state);

    connection.bind("state_change", (states: any) => {
      console.log("State changed:", states.previous, "=>", states.current);
    });

    connection.bind("connected", () => {
      console.log("Connected!");
      console.log("Socket ID:", (connection as any).socket_id);
    });

    connection.bind("disconnected", () => {
      console.log("Disconnected");
    });

    connection.bind("error", (err: any) => {
      console.error("Pusher Error:", err);
    });

    connection.bind("failed", () => {
      console.error("Connection failed");
    });

    connection.bind("unavailable", () => {
      console.warn("Connection unavailable");
    });

    const sync = () => {
      const state = connection.state as string | undefined;
      if (typeof state === "string") {
        setConnected(state === "connected" || state === "authenticated" || state === "unavailable");
      }
    };

    sync();

    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);
    const onError = () => setConnected(false);

    connection.bind("connected", onConnected);
    connection.bind("disconnected", onDisconnected);
    connection.bind("error", onError);

    return () => {
      connection.unbind("connected", onConnected);
      connection.unbind("disconnected", onDisconnected);
      connection.unbind("error", onError);
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
