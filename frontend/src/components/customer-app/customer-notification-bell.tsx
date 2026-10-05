"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { useEcho } from "@/components/echo/echo-provider";
import { customerNotifications, customerMarkNotificationsRead, type CustomerNotification } from "@/lib/customerAuth";

export function CustomerNotificationBell() {
  const { token } = useCustomerAuth();
  const { echo } = useEcho();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!token) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    let timer: number | undefined;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || cancelled) return;
      refreshing = true;
      try {
        const res = await customerNotifications(token);
        if (!cancelled) { setItems(res.data ?? []); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load notifications.");
      } finally {
        refreshing = false;
        if (!cancelled) setLoading(false);
      }
    };
    refreshRef.current = refresh;
    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") await refresh();
      if (!cancelled) timer = window.setTimeout(poll, 1500);
    };
    setLoading(true);
    void refresh();
    timer = window.setTimeout(poll, 1500);
    const channel = echo?.private("customer");
    const onChange = () => { void refresh(); };
    channel?.listen("data.changed", onChange);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      channel?.stopListening("data.changed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
      refreshRef.current = async () => {};
    };
  }, [token, echo]);

  useEffect(() => {
    if (!open) return;
    void refreshRef.current();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);

  const unread = items.filter((item) => !item.read).length;
  const markRead = async (id?: string) => {
    if (!token || marking) return;
    setMarking(true);
    try {
      await customerMarkNotificationsRead(token, id);
      setItems((current) => current.map((item) => !id || item.id === id ? { ...item, read: true } : item));
      setError(null);
      await refreshRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark notifications as read.");
    } finally { setMarking(false); }
  };

  return (
    <div ref={container} className="relative">
      <Button ref={trigger} size="icon" variant="ghost" onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open} aria-controls="customer-notifications-panel" className="relative border border-transparent lg:rounded-xl hover:border-[#d8a63f]/15 hover:bg-[#d79b16]/10 hover:text-[#ffc857]">
        <Bell className="h-5 w-5" />
        {unread > 0 ? <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f3bd55] px-1 text-[9px] font-black text-black shadow-[0_0_8px_rgba(243,189,85,.8)]">{Math.min(unread, 99)}</span> : null}
      </Button>
      {open ? (
        <section id="customer-notifications-panel" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-100px))] overflow-hidden rounded-2xl border border-[#e7b354]/25 bg-[#090a08]/[.98] shadow-2xl backdrop-blur-xl lg:w-[360px]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0"><p className="font-bold text-white">Notifications</p><p className="text-xs text-white/45">Recent updates and reward alerts</p></div>
            {unread > 0 ? <button type="button" disabled={marking} onClick={() => void markRead()} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#f3bd55] hover:bg-[#f3bd55]/10 disabled:opacity-50">Read all</button> : !loading && !error ? <span className="shrink-0 text-xs text-white/30">All read</span> : null}
          </div>
          <div className="max-h-[min(420px,calc(100dvh-180px))] overflow-y-auto overscroll-contain p-2" onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
            {error ? <div role="alert" className="px-3 py-2 text-xs text-rose-300">{error}<button type="button" onClick={() => void refreshRef.current()} className="ml-2 underline">Retry</button></div> : null}
            {loading ? <p role="status" className="px-3 py-8 text-center text-sm text-white/40">Loading notifications...</p> : items.length ? items.slice(0, 20).map((item) => (
              <button key={item.id} type="button" disabled={marking} onClick={() => { if (!item.read) void markRead(item.id); }} className={`block w-full rounded-xl px-3 py-3 text-left hover:bg-white/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55] ${item.read ? "opacity-55" : ""}`}>
                <span className="flex items-start gap-3">
                  <span aria-hidden="true" className={`mt-1 size-2 shrink-0 rounded-full ${item.read ? "" : "bg-[#f3bd55]"}`} />
                  <span className="min-w-0"><span className="block text-sm font-semibold text-white">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-white/55">{item.message}</span><span className="mt-1 block text-[10px] text-white/35">{new Date(item.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></span>
                </span>
              </button>
            )) : !error ? <p className="px-3 py-8 text-center text-sm text-white/40">No notifications yet.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
