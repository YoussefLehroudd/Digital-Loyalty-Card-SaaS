"use client";

import { useEffect, useRef, useState } from "react";
import { adminRequest, type AdminActivity, type AdminOverview } from "@/lib/admin";
import { apiFetch } from "@/lib/api";

/**
 * Polls existing authenticated admin endpoints, without a new backend or
 * fake client-only notifications. Admin data refreshes roughly every 20s
 * while the tab is visible, and immediately when the tab regains focus.
 */
type CounterSnapshot = Record<string, number>;
type ProbeResult = CounterSnapshot;
const STORAGE_PREFIX = "loyvance.admin.nav-seen.v1:";
const watchedRoutes = ["/admin", "/admin/businesses", "/admin/customers", "/admin/premium", "/admin/affiliates", "/admin/activity", "/admin/visitors", "/admin/archived"] as const;
type PremiumResponse = { requests: Array<{business_id:string; feature:string; status:string; requested_at:string}> };
type AffiliateResponse = {data:Array<{id:string}>};
type ArchivedResponse = {counts:{business:number;customer:number;affiliate:number}};
type VisitorsResponse = {totals:{sessions:number}};

function storedCounters(key: string): CounterSnapshot {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([k,v]) => watchedRoutes.includes(k as typeof watchedRoutes[number]) && typeof v === "number" && Number.isFinite(v) && v >= 0)) as CounterSnapshot;
  } catch {
    return {};
  }
}
function persistCounters(key:string, seen:CounterSnapshot) {
  try { window.localStorage.setItem(key, JSON.stringify(seen)); } catch { /* Private browsing: in-memory acknowledgement still works. */ }
}
function onRoute(path:string, route:string) {
  return path === route || (route !== "/admin" && path.startsWith(route + "/"));
}

export function useAdminSidebarAlerts(token: string | null, userId: string | null, pathname: string) {
  const [badges, setBadges] = useState<Record<string, number>>({});
  const pathnameRef = useRef(pathname);
  const seenRef = useRef<CounterSnapshot>({});
  const latestRef = useRef<CounterSnapshot>({});
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!token || !userId) { setBadges({}); return; }
    const storageKey = STORAGE_PREFIX + userId;
    seenRef.current = storedCounters(storageKey);
    latestRef.current = {};
    let stopped = false;
    let busy = false;
    const controller = new AbortController();

    function displayAlerts(current:CounterSnapshot, seen:CounterSnapshot) {
      const result: Record<string, number> = {};
      for (const route of watchedRoutes) {
        const value = current[route];
        if (typeof value !== "number") continue;
        // Open approvals and payment renewals require action until resolved.
        if (route === "/admin/premium" || route === "/admin") {
          result[route] = Math.max(0, value);
        } else {
          result[route] = Math.max(0, value - (seen[route] ?? value));
        }
      }
      setBadges(result);
    }

    async function checkForUpdates() {
      if (stopped || busy || document.hidden) return;
      busy = true;
      try {
        // Independent checks: if one endpoint is unavailable, all other badges
        // continue working. The responses contain actual server-side totals.
        const results = await Promise.allSettled<ProbeResult>([
          adminRequest<AdminOverview>("overview", token!, {signal: controller.signal, cache:"no-store"}).then(r => ({
            "/admin": r.data.subscriptions?.pending_requests ?? 0,
            "/admin/businesses": r.data.stats.businesses,
            "/admin/customers": r.data.stats.customers,
          })),
          adminRequest<AffiliateResponse>("affiliates?archived=false", token!, {signal: controller.signal, cache:"no-store"}).then(r => ({
            "/admin/affiliates": r.data.length,
          })),
          adminRequest<AdminActivity>("activity?kind=all&page=1", token!, {signal: controller.signal, cache:"no-store"}).then(r => ({
            "/admin/activity": r.total,
          })),
          adminRequest<ArchivedResponse>("archived?type=all&page=1", token!, {signal: controller.signal, cache:"no-store"}).then(r => ({
            "/admin/archived": r.counts.business + r.counts.customer + r.counts.affiliate,
          })),
          adminRequest<VisitorsResponse>("visitors?days=7", token!, {signal: controller.signal, cache:"no-store"}).then(r => ({
            "/admin/visitors": r.totals.sessions,
          })),
        ]);
        // Feature requests live at /premium-admin, not under /admin.
        // It is fetched independently from the other admin endpoints.
        const premiumRequest = await apiFetch<PremiumResponse>("/premium-admin",{token:token!,signal:controller.signal,cache:"no-store"}).catch(() => null);
        if (stopped || controller.signal.aborted) return;
        const current = { ...latestRef.current };
        for (const probe of results) {
          if (probe.status !== "fulfilled") continue;
          for (const [route, value] of Object.entries(probe.value)) {
            if (typeof value === "number" && Number.isFinite(value) && value >= 0) current[route] = value;
          }
        }
        if (premiumRequest && Array.isArray(premiumRequest.requests)) {
          current["/admin/premium"] = premiumRequest.requests.filter(r => r.status === "pending" || r.status === "requested").length;
        }
        const seen = { ...seenRef.current };
        let changed = false;
        for (const [route, value] of Object.entries(current)) {
          if (route === "/admin" || route === "/admin/premium") continue;
          // First-time setup is a baseline, not an invented new alert.
          // Opening a page acknowledges additions to that page.
          if (seen[route] === undefined || value < seen[route] || onRoute(pathnameRef.current, route)) {
            seen[route] = value;
            changed = true;
          }
        }
        latestRef.current = current;
        seenRef.current = seen;
        if (changed) persistCounters(storageKey, seen);
        displayAlerts(current, seen);
      } finally {
        busy = false;
      }
    }
    const wake = () => { if (!document.hidden) void checkForUpdates(); };
    void checkForUpdates();
    const timer = window.setInterval(() => { void checkForUpdates(); }, 20000);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [token,userId]);

  useEffect(() => {
    if (!userId) return;
    const route = watchedRoutes.find(r => r !== "/admin" && onRoute(pathname,r));
    if (!route || route === "/admin/premium") return;
    const value = latestRef.current[route];
    if (typeof value !== "number") return;
    seenRef.current = { ...seenRef.current, [route]: value };
    persistCounters(STORAGE_PREFIX + userId, seenRef.current);
    setBadges(old => old[route] ? { ...old, [route]:0 } : old);
  }, [pathname,userId]);

  return badges;
}
