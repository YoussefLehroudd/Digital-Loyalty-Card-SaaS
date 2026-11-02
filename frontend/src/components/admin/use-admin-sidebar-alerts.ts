"use client";

import { useEffect, useRef, useState } from "react";
import { adminRequest, type AdminOverview } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { PREMIUM_DECISION_EVENT, isPremiumPending, premiumKey, type PremiumApprovalRequest, type PremiumDecision } from "@/lib/premium-approval-live";

/** Only user/business-originated changes should create sidebar notifications.
 * Counts are acknowledged on page visit; they are not workload counters.
 * Per-admin acknowledgement is persisted locally (not across devices).
 */
type Counters = Record<string, number>;
const STORAGE_PREFIX = "loyvance.admin.nav-seen.v2:";
const routes = ["/admin/businesses", "/admin/customers", "/admin/affiliates", "/admin/premium", "/admin/visitors"] as const;
const DEMO_KEY = "/admin/visitors/demo-alerts";
const PREMIUM_SEEN_PREFIX = "loyvance.admin.premium-seen.v1:";
const VISITORS_ROUTE = "/admin/visitors";
type PremiumResponse = { requests: PremiumApprovalRequest[] };
type AffiliateResponse = { data: Array<{ id: string }> };
type DemoAlertResponse = { total: number };

function readSeen(key: string): Counters {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(key) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([key, value]) =>
      (routes.some(route => route === key) || key === DEMO_KEY) &&
      typeof value === "number" && Number.isFinite(value) && value >= 0
    )) as Counters;
  } catch { return {}; }
}
function storeSeen(key: string, seen: Counters) {
  try { window.localStorage.setItem(key, JSON.stringify(seen)); } catch { /* storage disabled */ }
}

export function useAdminSidebarAlerts(token: string | null, userId: string | null, pathname: string) {
  const [badges, setBadges] = useState<Counters>({});
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const seenRef = useRef<Counters>({});
  const latestRef = useRef<Counters>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const handledRef = useRef<Set<string>>(new Set());
  const premiumSeenRef = useRef<Set<string>>(new Set());
  const premiumInitialized = useRef(false);

  useEffect(() => {
    if (!token || !userId) { setBadges({}); return; }
    const storageKey = STORAGE_PREFIX + userId;
    seenRef.current = readSeen(storageKey);
    latestRef.current = {};
    pendingRef.current = new Set();
    handledRef.current = new Set();
    try { premiumSeenRef.current = new Set(JSON.parse(window.localStorage.getItem(PREMIUM_SEEN_PREFIX + userId) || "[]") as string[]); }
    catch { premiumSeenRef.current = new Set(); }
    premiumInitialized.current = false;
    let stopped = false;
    let running = false;
    const controller = new AbortController();

    const acknowledge = (route: string) => {
      const seen = { ...seenRef.current };
      const latest = latestRef.current;
      if (route === VISITORS_ROUTE && latest[DEMO_KEY] !== undefined) seen[DEMO_KEY] = latest[DEMO_KEY];
      if (latest[route] !== undefined) seen[route] = latest[route];
      if (route === "/admin/premium") {
        premiumSeenRef.current = new Set([...pendingRef.current]);
      }
      seenRef.current = seen;
      storeSeen(storageKey, seen);
      setBadges(previous => ({ ...previous, [route]: 0 }));
    };

    const refreshBadges = () => {
      const result: Counters = {};
      for (const route of routes) {
        if (route === "/admin/premium") {
          result[route] = [...pendingRef.current].filter(key =>
            !premiumSeenRef.current.has(key) && !handledRef.current.has(key)).length;
        } else if (route === VISITORS_ROUTE) {
          result[route] = Math.max(0, (latestRef.current[DEMO_KEY] ?? 0) - (seenRef.current[DEMO_KEY] ?? 0));
        } else {
          const current = latestRef.current[route];
          result[route] = current === undefined ? 0 : Math.max(0, current - (seenRef.current[route] ?? current));
        }
        if (pathnameRef.current === route) result[route] = 0;
      }
      setBadges(result);
    };

    async function check() {
      if (stopped || running || document.hidden) return;
      running = true;
      try {
        const results = await Promise.allSettled([
          adminRequest<AdminOverview>("overview", token!, { signal:controller.signal, cache:"no-store" }).then(r => ({
            "/admin/businesses": r.data.stats.businesses,
            "/admin/customers": r.data.stats.customers,
          })),
          adminRequest<AffiliateResponse>("affiliates?archived=false", token!, { signal:controller.signal, cache:"no-store" }).then(r => ({
            "/admin/affiliates": r.data.length,
          })),
          adminRequest<DemoAlertResponse>("visitors/demo-alerts", token!, { signal:controller.signal, cache:"no-store" }).then(r => ({
            [DEMO_KEY]: r.total,
          })),
          apiFetch<PremiumResponse>("/premium-admin", { token:token!, signal:controller.signal, cache:"no-store" }),
        ] as const);
        if (stopped || controller.signal.aborted) return;
        const seen = { ...seenRef.current };
        let changed = false;
        for (let index = 0; index < 4; index++) {
          const item = results[index];
          if (item.status !== "fulfilled") continue;
          const counts = item.value as Counters;
          for (const [route, value] of Object.entries(counts)) {
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
            const previous = latestRef.current[route];
            latestRef.current[route] = value;
            // Initial load establishes a baseline, not a fake notification.
            // A decrease means deleted records, not new events.
            if (seen[route] === undefined || (previous !== undefined && value < previous && value < seen[route]) ||
                pathnameRef.current === route || (route === DEMO_KEY && pathnameRef.current === VISITORS_ROUTE)) {
              if (seen[route] !== value) { seen[route] = value; changed = true; }
            }
          }
        }
        const premium = results[4];
        if (premium.status === "fulfilled" && Array.isArray(premium.value.requests)) {
          const pending = new Set(premium.value.requests.filter(isPremiumPending).map(premiumKey));
          pendingRef.current = pending;
          for (const key of handledRef.current) if (!pending.has(key)) handledRef.current.delete(key);
          for (const key of premiumSeenRef.current) if (!pending.has(key)) premiumSeenRef.current.delete(key);
          // Pending requests already present when admin opens the app are new
          // until their dedicated page is visited.
          premiumInitialized.current = true;
          if (pathnameRef.current === "/admin/premium") {
            premiumSeenRef.current = new Set(pending);
            try { window.localStorage.setItem(PREMIUM_SEEN_PREFIX + userId, JSON.stringify([...pending])); } catch { /* storage disabled */ }
          }
        }
        seenRef.current = seen;
        if (changed) storeSeen(storageKey, seen);
        refreshBadges();
      } finally { running = false; }
    }
    const onDecision = (event: Event) => {
      const detail = (event as CustomEvent<PremiumDecision>).detail;
      if (!detail || !["approved","rejected"].includes(detail.status)) return;
      handledRef.current.add(premiumKey(detail));
      refreshBadges();
      void check();
    };
    const wake = () => { if (!document.hidden) void check(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) seenRef.current = readSeen(storageKey);
      else if (event.key === PREMIUM_SEEN_PREFIX + userId) {
        try { premiumSeenRef.current = new Set(JSON.parse(event.newValue || "[]") as string[]); }
        catch { premiumSeenRef.current = new Set(); }
      } else return;
      refreshBadges();
    };
    // When mounted on a target route, acknowledge the server snapshot after loading.
    void check();
    const timer = window.setInterval(() => { void check(); }, 5000);
    window.addEventListener("focus", wake);
    window.addEventListener("storage", onStorage);
    window.addEventListener(PREMIUM_DECISION_EVENT, onDecision);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PREMIUM_DECISION_EVENT, onDecision);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [token, userId]);

  useEffect(() => {
    if (!userId) return;
    const route = pathname;
    if (!routes.some(item => item === route)) return;
    const seen = { ...seenRef.current };
    if (route === VISITORS_ROUTE && latestRef.current[DEMO_KEY] !== undefined) seen[DEMO_KEY] = latestRef.current[DEMO_KEY];
    if (latestRef.current[route] !== undefined) seen[route] = latestRef.current[route];
    if (route === "/admin/premium") {
      premiumSeenRef.current = new Set(pendingRef.current);
      try { window.localStorage.setItem(PREMIUM_SEEN_PREFIX + userId, JSON.stringify([...pendingRef.current])); } catch { /* storage disabled */ }
    }
    seenRef.current = seen;
    storeSeen(STORAGE_PREFIX + userId, seen);
    setBadges(previous => ({ ...previous, [route]: 0 }));
  }, [pathname, userId]);

  return badges;
}
