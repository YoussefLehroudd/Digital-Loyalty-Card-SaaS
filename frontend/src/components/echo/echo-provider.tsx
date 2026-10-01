"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type EventCallback = (payload?: unknown) => void;
type Channel = {
  listen: (event: string, callback: EventCallback) => Channel;
  stopListening: (event: string, callback?: EventCallback) => Channel;
  subscribed: (callback: () => void) => Channel;
};
type RealtimeClient = {
  private: (name: string) => Channel;
  channel: (name: string) => Channel;
  leaveChannel: (name: string) => void;
  disconnect: () => void;
};
type EchoContextValue = { echo: RealtimeClient | null; connected: boolean };

const EchoContext = createContext<EchoContextValue | null>(null);
const TOKEN_KEY = "digital_loyalty_token";

function apiBase() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return "/api";
  const base = raw.replace(/\/+$/, "");
  return /\/api$/i.test(base) ? base : `${base}/api`;
}

export function EchoProvider({
  children,
  token,
}: {
  children: React.ReactNode;
  token: string | null;
}) {
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Map<string, Set<EventCallback>>());
  const stopped = useRef(false);

  const echo = useMemo<RealtimeClient>(() => {
    const makeChannel = (_name: string): Channel => {
      const channel: Channel = {
        listen(event, callback) {
          const key = event.replace(/^\./, "");
          const set = listeners.current.get(key) ?? new Set<EventCallback>();
          set.add(callback);
          listeners.current.set(key, set);
          return channel;
        },
        stopListening(event, callback) {
          const key = event.replace(/^\./, "");
          if (!callback) listeners.current.delete(key);
          else listeners.current.get(key)?.delete(callback);
          return channel;
        },
        subscribed(callback) {
          queueMicrotask(callback);
          return channel;
        },
      };
      return channel;
    };

    return {
      private: makeChannel,
      channel: makeChannel,
      leaveChannel: () => undefined,
      disconnect: () => {
        stopped.current = true;
        setConnected(false);
      },
    };
  }, []);

  useEffect(() => {
    stopped.current = false;
    let cursor = "0";
    let timer: number | undefined;
    let inFlight = false;

    const poll = async () => {
      if (stopped.current || inFlight) return;
      const authToken =
        token ||
        (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null);

      if (!authToken) {
        setConnected(false);
        timer = window.setTimeout(poll, 1000);
        return;
      }

      inFlight = true;
      try {
        const res = await fetch(`${apiBase()}/dashboard`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`Realtime HTTP ${res.status}`);
        const body = (await res.json()) as unknown;
        const snapshot = JSON.stringify(body);
        setConnected(true);

        if (cursor !== "0" && snapshot !== cursor) {
          for (const callbacks of listeners.current.values()) {
            for (const callback of callbacks) callback(body);
          }
        }
        cursor = snapshot;
      } catch {
        setConnected(false);
      } finally {
        inFlight = false;
        if (!stopped.current) timer = window.setTimeout(poll, 1200);
      }
    };

    void poll();
    return () => {
      stopped.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [token]);

  return <EchoContext.Provider value={{ echo, connected }}>{children}</EchoContext.Provider>;
}

export function useEcho() {
  const ctx = useContext(EchoContext);
  if (!ctx) throw new Error("useEcho must be used inside EchoProvider");
  return ctx;
}
