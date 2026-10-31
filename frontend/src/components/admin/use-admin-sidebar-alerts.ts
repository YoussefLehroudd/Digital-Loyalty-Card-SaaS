"use client";

import { useEffect, useRef, useState } from "react";
import { adminRequest, type AdminActivity, type AdminOverview } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { PREMIUM_DECISION_EVENT, isPremiumPending, premiumKey, type PremiumApprovalRequest, type PremiumDecision } from "@/lib/premium-approval-live";

/**
 * Polls existing authenticated admin endpoints, without a new backend or
 * fake client-only notifications. Admin data refreshes roughly every 20s
 * while the tab is visible, and immediately when the tab regains focus.
 */
type CounterSnapshot = Record<string, number>;
type ProbeResult = CounterSnapshot;
const STORAGE_PREFIX = "loyvance.admin.nav-seen.v1:";
const VISITORS_ROUTE = "/admin/visitors";
const watchedRoutes = ["/admin", "/admin/businesses", "/admin/customers", "/admin/premium", "/admin/affiliates", "/admin/activity", "/admin/visitors", "/admin/archived"] as const;
type PremiumResponse = { requests: PremiumApprovalRequest[] };
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
export function useAdminSidebarAlerts(token: string | null, userId: string | null, pathname: string) {
  const [badges, setBadges] = useState<Record<string, number>>({});
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const seenRef = useRef<CounterSnapshot>({});
  const latestRef = useRef<CounterSnapshot>({});
  const handledPremiumRef = useRef<Set<string>>(new Set());

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
        if (stopped || controller.signal.aborted) return;
        const current = { ...latestRef.current };
        for (const probe of results) {
          if (probe.status !== "fulfilled") continue;
          for (const [route, value] of Object.entries(probe.value)) {
            if (typeof value === "number" && Number.isFinite(value) && value >= 0) current[route] = value;
          }
        }
        const seen = { ...seenRef.current };
        let changed = false;
        for (const [route, value] of Object.entries(current)) {
          if (route === "/admin" || route === "/admin/premium") continue;
          // First-time setup is a baseline, not an invented new alert.
          // Visitors is a read-only feed: opening it marks the visible total seen.
          // Feature Approvals remains action-based and is never auto-cleared.
          if (seen[route] === undefined || value < seen[route] || (route === VISITORS_ROUTE && pathnameRef.current === VISITORS_ROUTE)) {
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

  // Visiting the Visitors page clears its badge without waiting for polling.
  // A fresh server count is acknowledged on the next poll while the page is open.
  useEffect(() => {
    if (!userId || pathname !== VISITORS_ROUTE) return;
    const latest = latestRef.current[VISITORS_ROUTE];
    if (typeof latest === "number") {
      seenRef.current = { ...seenRef.current, [VISITORS_ROUTE]: latest };
      persistCounters(STORAGE_PREFIX + userId, seenRef.current);
    }
    setBadges(previous =>
      (previous[VISITORS_ROUTE] ?? 0) > 0
        ? { ...previous, [VISITORS_ROUTE]: 0 }
        : previous
    );
  }, [pathname, userId]);

  // Feature Approvals has its own fast live cycle and direct action events.
  useEffect(() => {
    if (!token || !userId) return;
    let stopped = false;
    let active: AbortController | null = null;
    const handled = handledPremiumRef.current;
    handled.clear();
    async function sync() {
      if (stopped || document.hidden || active) return;
      const ctrl = new AbortController();
      active = ctrl;
      try {
        const result = await apiFetch<PremiumResponse>("/premium-admin", {token:token!, signal:ctrl.signal, cache:"no-store"});
        if (stopped || ctrl.signal.aborted || !Array.isArray(result.requests)) return;
        const pendingKeys = new Set(result.requests.filter(isPremiumPending).map(premiumKey));
        // Release handled ids once they no longer appear pending on the server.
        // A later re-request gets its own requested_at identity and fresh badge.
        for (const key of handled) {
          if (!pendingKeys.has(key)) handled.delete(key);
        }
        setBadges(old => ({...old, "/admin/premium": [...pendingKeys].filter(k => !handled.has(k)).length}));
      } catch {
        // A temporary API error never hides a known pending approval.
      } finally {
        if (active === ctrl) active = null;
      }
    }
    const onDecision = (event: Event) => {
      const detail = (event as CustomEvent<PremiumDecision>).detail;
      if (!detail || !["approved","rejected"].includes(detail.status)) return;
      const key = premiumKey(detail);
      if (!handled.has(key)) {
        handled.add(key);
        setBadges(old => ({...old, "/admin/premium": Math.max(0, (old["/admin/premium"] ?? 1)-1)}));
      }
      active?.abort();
      active = null;
      void sync();
    };
    const wake = () => { if (!document.hidden) { active?.abort(); active=null; void sync(); } };
    void sync();
    const timer = window.setInterval(() => {void sync();}, 4000);
    window.addEventListener(PREMIUM_DECISION_EVENT,onDecision);
    window.addEventListener("focus",wake);
    document.addEventListener("visibilitychange",wake);
    return () => {
      stopped=true;
      active?.abort();
      window.clearInterval(timer);
      window.removeEventListener(PREMIUM_DECISION_EVENT,onDecision);
      window.removeEventListener("focus",wake);
      document.removeEventListener("visibilitychange",wake);
    };
  }, [token,userId]);

  return badges;
}
