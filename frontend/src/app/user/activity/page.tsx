"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CircleDot, Gift, Search, Store, Ticket, X } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerActivity } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEcho } from "@/components/echo/echo-provider";

type ActivityItem = {
  id: string;
  type: string;
  business_id: string;
  customer_id: string;
  business_name: string;
  business_logo_url: string | null;
  business_primary_color: string | null;
  reward_name?: string | null;
  date: string | null;
  points?: number;
};

function iconForType(type: string) {
  const t = type.toLowerCase();
  if (t.includes("reward")) return Gift;
  if (t.includes("visit") || t.includes("stamp")) return Ticket;
  return CircleDot;
}

function labelForType(type: string) {
  if (type === "reward_redeemed") return "Reward redeemed";
  if (type === "reward_earned") return "Reward unlocked";
  if (type === "visit") return "Stamp earned";
  return type.replaceAll("_", " ");
}

function formatActivityDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const day = sameDay ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} · ${time}`;
}

export default function UserActivityPage() {
  const { token } = useCustomerAuth();
  const { echo } = useEcho();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "stamps" | "rewards">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    customerActivity(token)
      .then((res) => {
        setItems(res.data.items ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("customer");
    const refresh = () => {
      void customerActivity(token).then((res) => setItems(res.data.items ?? [])).catch(() => undefined);
    };
    channel.listen("data.changed", refresh);
    return () => { channel.stopListening("data.changed", refresh); };
  }, [echo, token]);

  const visible = items.filter((item) => {
    const stamp = item.type === "visit" || item.type.includes("stamp");
    const matchesType = filter === "all" || (filter === "stamps" ? stamp : item.type.includes("reward"));
    return matchesType && `${item.business_name} ${item.reward_name ?? ""} ${labelForType(item.type)}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const groups = new Map<string, ActivityItem[]>();
  for (const item of visible) {
    const date = item.date ? new Date(item.date) : null;
    const label = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date)
      : "Date unavailable";
    const group = groups.get(label) ?? [];
    group.push(item);
    groups.set(label, group);
  }

  return (
    <CustomerLayout title="Activity" subtitle="Your latest visits and reward events">
      {loading ? (
        <Card className="border-white/10 bg-[#10110e]/95"><CardContent role="status" className="p-6 text-sm text-white/50">Loading activity...</CardContent></Card>
      ) : error ? (
        <Card className="border-destructive/30"><CardContent role="alert" className="p-6 text-sm text-destructive">{error}</CardContent></Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: "Recent stamps", value: items.filter((item) => item.type === "visit" || item.type.includes("stamp")).reduce((sum, item) => sum + (item.points ?? 1), 0), icon: Ticket },
              { label: "Unlocked", value: items.filter((item) => item.type === "reward_earned").length, icon: Gift },
              { label: "Redeemed", value: items.filter((item) => item.type === "reward_redeemed").length, icon: CircleDot },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-[#10110e]/95 px-3 py-3 sm:px-5 sm:py-3.5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Icon aria-hidden="true" className="size-7 shrink-0 text-[#f3bd55]/80 sm:size-8" />
                  <p className="min-w-0 break-all text-2xl font-semibold leading-none tracking-tight text-white sm:text-3xl">{value}</p>
                </div>
                <p className="mt-2 text-[11px] text-white/45 sm:text-xs">{label}</p>
              </div>
            ))}
          </div>

          <section aria-labelledby="activity-heading" className="overflow-hidden rounded-2xl border border-[#f3bd55]/15 bg-[#10110e]/95">
            <div className="space-y-4 border-b border-white/10 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="activity-heading" className="flex items-center gap-2 font-semibold text-white"><CalendarClock className="size-4 text-[#f3bd55]" /> Activity timeline</h2>
                <span className="text-xs text-white/40">{visible.length} {visible.length === 1 ? "event" : "events"}</span>
              </div>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex gap-1 rounded-xl border border-white/5 bg-black/25 p-1">
                  {([{ key: "all", label: "All activity" }, { key: "stamps", label: "Stamps" }, { key: "rewards", label: "Rewards" }] as const).map((tab) => (
                    <button key={tab.key} type="button" aria-pressed={filter === tab.key} onClick={() => setFilter(tab.key)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55] ${filter === tab.key ? "bg-[#f3bd55]/15 text-[#f3bd55]" : "text-white/45 hover:bg-white/5 hover:text-white"}`}>{tab.label}</button>
                  ))}
                </div>
                <div className="relative xl:w-72">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <input type="search" aria-label="Search activity" placeholder="Search business or reward" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-9 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#f3bd55]/50 [&::-webkit-search-cancel-button]:hidden" />
                  {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/45 hover:text-white"><X className="size-4" /></button> : null}
                </div>
              </div>
            </div>
            <div role="region" aria-label="Activity events" tabIndex={0} className="max-h-[min(520px,65dvh)] overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f3bd55]/40 lg:max-h-[560px]" style={{ scrollbarWidth: "thin", scrollbarColor: "#806629 #10110e" }}>
              {visible.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <CalendarClock className="mx-auto mb-3 size-7 text-[#f3bd55]/50" />
                  <p className="text-sm font-medium text-white/80">{items.length ? "No matching activity" : "Your story starts here"}</p>
                  <p className="mt-2 text-xs leading-5 text-white/45">{items.length ? "Try another search or activity filter." : "Your visits, collected stamps and rewards will appear here."}</p>
                </div>
              ) : Array.from(groups, ([day, events]) => (
                <div key={day}>
                  <h3 className="sticky top-0 z-10 border-b border-white/5 bg-[#141510] px-4 py-2.5 text-[11px] font-medium tracking-wide text-white/45 sm:px-5">{day}</h3>
                  <ul className="divide-y divide-white/5">
                    {events.map((item) => {
                      const Icon = iconForType(item.type);
                      const rewardEvent = item.type.includes("reward");
                      return (
                        <li key={item.id} className="flex items-start gap-3 px-4 py-4 transition hover:bg-white/[.025] sm:gap-4 sm:px-5">
                          <div className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border ${rewardEvent ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-[#f3bd55]/20 bg-[#f3bd55]/10 text-[#f3bd55]"}`}><Icon className="size-3.5" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                              <p className="text-sm font-semibold text-white">{labelForType(item.type)}</p>
                              {typeof item.points === "number" ? <span className="text-xs font-semibold text-[#f3bd55]">+{item.points} {item.points === 1 ? "stamp" : "stamps"}</span> : rewardEvent ? <Badge className="border-emerald-400/20 bg-emerald-400/10 text-[10px] text-emerald-300">{item.type === "reward_redeemed" ? "Redeemed" : "Unlocked"}</Badge> : null}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/20">{item.business_logo_url ? <img src={item.business_logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="size-3 text-white/40" />}</span>
                              <p className="break-words text-xs text-white/55">{item.business_name}</p>
                            </div>
                            {item.reward_name ? <p className="mt-1.5 break-words text-xs leading-5 text-white/45">{item.reward_name}</p> : null}
                            <p className="mt-2 text-[11px] text-white/35">{formatActivityDate(item.date)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </CustomerLayout>
  );
}
