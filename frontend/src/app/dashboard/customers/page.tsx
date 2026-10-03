"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Search, Sparkles, User, Users } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-guard";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEcho } from "@/components/echo/echo-provider";

type RewardStatus = "collecting" | "ready" | "redeemed";

type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  qr_code: string | null;
  current_stamps: number;
  required_stamps: number;
  reward_status: RewardStatus;
  total_visits: number;
  last_visit: string | null;
  joined_at: string | null;
};

type VisitHistoryRow = {
  id: string;
  date: string;
};

type RewardHistoryRow = {
  id: string;
  reward_name: string | null;
  earned_at: string | null;
  redeemed_at: string | null;
  status: "collecting" | "ready" | "redeemed";
};

type CustomerDetails = {
  customer: CustomerRow & {
    visit_history: VisitHistoryRow[];
    reward_history: RewardHistoryRow[];
  };
};

type ApiMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
};

type CustomersResponse = {
  data: CustomerRow[];
  meta: ApiMeta;
  summary: {
    total_customers: number;
    active_customers: number;
    rewards_ready: number;
  };
  query: {
    q: string;
    page: number;
    per_page: number;
  };
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function statusBadgeClass(status: RewardStatus) {
  // Spec:
  // collecting = gray
  // ready = orange
  // redeemed = green (user spec)
  if (status === "collecting") {
    return cn(
      "border-border bg-muted text-muted-foreground",
      "hover:opacity-90",
    );
  }
  if (status === "ready") {
    return cn(
      "border-transparent bg-amber-600/15 text-amber-200",
      "hover:opacity-90",
      "dark:bg-amber-500/15 dark:text-amber-200",
    );
  }
  return cn(
    "border-transparent bg-emerald-600/15 text-emerald-200",
    "hover:opacity-90",
    "dark:bg-emerald-500/15 dark:text-emerald-200",
  );
}

function rewardStatusLabel(status: RewardStatus) {
  if (status === "collecting") return "Collecting";
  if (status === "ready") return "Ready";
  return "Redeemed";
}

function formatName(c: CustomerRow) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export default function CustomersPage() {
  const { token } = useAuth();
  const { echo } = useEcho();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const [response, setResponse] = useState<CustomersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const summary = response?.summary;

  const canPrev = response ? page > 1 : false;
  const canNext = response ? page < response.meta.last_page : false;

  // Debounce search input to reduce API requests while typing
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    // Reset pagination when the debounced query changes
    setPage(1);
  }, [debouncedQ]);

  const loadCustomers = async (opts?: { nextPage?: number; nextQ?: string }) => {
    if (!token) return;

    const nextPage = opts?.nextPage ?? page;
    const nextQ = opts?.nextQ ?? debouncedQ;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: nextQ,
        page: String(nextPage),
        per_page: String(perPage),
      });

      const res = await apiFetch<CustomersResponse>(
        `/business/customers?${params.toString()}`,
        { token },
      );

      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Single fetch effect driven by (page, debouncedQ)
    loadCustomers({ nextPage: page, nextQ: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("business");
    const refresh = () => { void loadCustomers({ nextPage: page, nextQ: debouncedQ }); };
    channel.listen("data.changed", refresh);
    return () => { channel.stopListening("data.changed", refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo, token, page, debouncedQ]);

  const openDetails = async (c: CustomerRow) => {
    if (!token) return;
    setIsFetchingDetails(true);
    setError(null);

    try {
      const res = await apiFetch<CustomerDetails>(`/business/customers/${c.id}`, {
        token,
      });

      setSelectedCustomer(c);
      setDetails(res);
      setIsModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customer details.");
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDetails(null);
    setSelectedCustomer(null);
  };

  const customers = response?.data ?? [];

  const isEmpty = !isLoading && response && customers.length === 0;

  const progressText = (c: CustomerRow) => {
    return `${c.current_stamps} / ${c.required_stamps}`;
  };

  const progressPercent = (c: CustomerRow) => {
    if (!c.required_stamps) return 0;
    return Math.min(100, (c.current_stamps / c.required_stamps) * 100);
  };

  return (
    <DashboardShell activeItem="customers">
      <div className="mx-auto max-w-[1450px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[20px] border border-[#d6a33d]/25 bg-[linear-gradient(145deg,rgba(16,17,14,.94),rgba(8,9,7,.9))] p-5 shadow-[0_18px_55px_rgba(0,0,0,.28)] sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#e8b74f]">Customer management</p><h1 className="mt-1 text-2xl font-bold text-white">Customers</h1><p className="mt-1 text-sm text-white/45">Track members, loyalty progress, visits and rewards.</p></div>
            <div className="hidden size-12 items-center justify-center rounded-xl border border-[#d6a33d]/25 bg-[#8b5d12]/20 text-[#ffc857] sm:flex"><Users className="size-6"/></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {label:"Total Customers",value:summary?.total_customers,icon:Users},
              {label:"Active Customers",value:summary?.active_customers,icon:User},
              {label:"Rewards Ready",value:summary?.rewards_ready,icon:BadgeCheck},
            ].map(({label,value,icon:Icon})=><div key={label} className="flex min-h-[105px] items-center gap-4 rounded-2xl border border-[#d6a33d]/20 bg-black/35 px-4 shadow-[inset_0_0_28px_rgba(243,189,85,.035)]"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#d6a33d]/20 bg-[#8b5d12]/20 text-[#ffc857]"><Icon className="size-6"/></div><div><p className="text-xs text-white/45">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value ?? "—"}</p></div></div>)}
          </div>
          <div className="relative mt-4 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#e6b64e]/70"/>
            <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name, email, or phone..." className="h-12 rounded-xl border-[#d6a33d]/20 bg-black/35 pl-11 text-white placeholder:text-white/35 focus-visible:ring-[#e7b354]/30"/>
          </div>
        </section>

        {error ? <Alert>{error}</Alert> : null}

        <section className="overflow-hidden rounded-[20px] border border-[#d6a33d]/25 bg-[linear-gradient(145deg,rgba(15,16,13,.95),rgba(8,9,7,.93))] shadow-[0_18px_55px_rgba(0,0,0,.3)]">
          <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4">
            <div><h2 className="font-semibold text-white">Customer directory</h2><p className="mt-0.5 text-xs text-white/40">{response ? `${response.meta.total} members in your loyalty program` : "Loading members..."}</p></div>
            <Sparkles className="size-5 text-[#e8b74f]"/>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead><tr className="border-b border-white/[.07] bg-white/[.025] text-left text-[11px] uppercase tracking-[.08em] text-white/38">
                <th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Progress</th><th className="px-5 py-3 font-medium">Reward Status</th><th className="px-5 py-3 font-medium">Visits</th><th className="px-5 py-3 font-medium">Last Visit</th><th className="px-5 py-3 font-medium">Joined</th><th className="px-5 py-3 text-right font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[.06]">
                {isLoading ? Array.from({length:6}).map((_,idx)=><tr key={idx}><td colSpan={7} className="px-5 py-5"><Skeleton className="h-5 w-2/3 bg-white/10"/></td></tr>)
                : isEmpty ? <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-white/40">No customers found.</td></tr>
                : customers.map((c)=>{const name=formatName(c)||"Customer";const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();return <tr key={c.id} className="transition hover:bg-[#e7b354]/[.035]">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#f2b93f]/30 bg-[linear-gradient(145deg,#a97418,#5f3d08)] text-xs font-bold text-white">{initials}</span><div><p className="font-medium text-white/90">{name}</p><p className="mt-0.5 text-xs text-white/40">{c.email||c.phone||"—"}</p></div></div></td>
                  <td className="px-5 py-4"><div className="flex w-44 items-center justify-between text-xs"><span className="font-semibold text-white/75">{progressText(c)}</span><span className="text-white/35">{Math.round(progressPercent(c))}%</span></div><div className="mt-2 h-1.5 w-44 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#9d6813,#f3bd55)]" style={{width:`${progressPercent(c)}%`}}/></div></td>
                  <td className="px-5 py-4"><Badge className={cn("rounded-full border px-3 py-1 text-xs",statusBadgeClass(c.reward_status))}>{rewardStatusLabel(c.reward_status)}</Badge></td>
                  <td className="px-5 py-4 text-sm font-medium text-white/70">{c.total_visits}</td>
                  <td className="px-5 py-4 text-sm text-white/50">{formatDate(c.last_visit)}</td>
                  <td className="px-5 py-4 text-sm text-white/50">{formatDate(c.joined_at)}</td>
                  <td className="px-5 py-4 text-right"><Button variant="outline" className="h-9 cursor-pointer rounded-lg border-[#d6a33d]/35 bg-[#d6a33d]/10 px-4 text-xs font-semibold text-[#ffd067] hover:bg-[#d6a33d]/20 hover:text-[#ffe09a]" onClick={()=>openDetails(c)}>View Details</Button></td>
                </tr>})}
              </tbody>
            </table>
          </div>
          {response?<div className="flex flex-col gap-3 border-t border-white/[.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-white/40">Showing <span className="font-semibold text-white/70">{response.meta.from??0}</span> to <span className="font-semibold text-white/70">{response.meta.to??0}</span> of <span className="font-semibold text-white/70">{response.meta.total}</span></p><div className="flex items-center gap-2"><Button variant="outline" className="h-9 cursor-pointer border-white/10 bg-black/25 text-white/65 hover:border-[#d6a33d]/30 hover:bg-[#d6a33d]/10" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={!canPrev||isLoading}><ArrowLeft className="mr-1 size-4"/>Previous</Button><span className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#d6a33d]/25 bg-[#d6a33d]/10 px-3 text-xs font-semibold text-[#ffd067]">{page} / {Math.max(response.meta.last_page,1)}</span><Button variant="outline" className="h-9 cursor-pointer border-white/10 bg-black/25 text-white/65 hover:border-[#d6a33d]/30 hover:bg-[#d6a33d]/10" onClick={()=>setPage(p=>Math.min(response.meta.last_page,p+1))} disabled={!canNext||isLoading}>Next<ArrowRight className="ml-1 size-4"/></Button></div></div>:null}
        </section>
      </div>
      {/* Modal */}
      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-lg">
<div className="flex items-center justify-between border-b px-5 py-4">
  <div>
    <div className="text-base font-semibold">
      {selectedCustomer ? formatName(selectedCustomer) : "Customer"}
    </div>
    <div className="text-sm text-muted-foreground">
      {selectedCustomer?.email || selectedCustomer?.phone || "—"}
    </div>
  </div>
  <Button variant="ghost" className="cursor-pointer" onClick={closeModal}>
    Close
  </Button>
</div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
              {isFetchingDetails || !details ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="text-sm font-medium">Loyalty progress</div>
                      <div className="text-sm text-muted-foreground">
                        Current stamps: <span className="font-medium text-foreground">{details.customer.current_stamps}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Required stamps: <span className="font-medium text-foreground">{details.customer.required_stamps}</span>
                      </div>
                      <div className="text-sm">
                        Reward status:{" "}
                        <span className={cn("font-medium", "text-foreground")}>
                          {rewardStatusLabel(details.customer.reward_status)}
                        </span>
                      </div>

                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-ring"
                          style={{
                            width: details.customer.required_stamps
                              ? `${Math.min(100, (details.customer.current_stamps / details.customer.required_stamps) * 100)}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="text-sm font-medium">QR code</div>
                      <div className="flex items-center justify-center rounded-lg bg-muted/40 p-4">
                        {details.customer.qr_code ? (
                          <div className="text-xs text-muted-foreground">
                            QR available
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No QR</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        QR code rendering is handled in the scanner/wallet flow.
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <div className="text-sm font-medium">Visit history</div>
                      {details.customer.visit_history.length ? (
                        <div className="mt-3 space-y-2">
                          {details.customer.visit_history.map((v) => (
                            <div key={v.id} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Visit</span>
                              <span className="font-medium">{formatDate(v.date)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">No visits yet.</div>
                      )}
                    </div>

                    <div className="rounded-lg border p-4">
                      <div className="text-sm font-medium">Reward history</div>
                      {details.customer.reward_history.length ? (
                        <div className="mt-3 space-y-2">
                          {details.customer.reward_history.map((r) => (
                            <div key={r.id} className="rounded-md bg-muted/30 p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{r.reward_name || "Reward"}</span>
                                <Badge className={cn("px-2", statusBadgeClass(r.status as RewardStatus))}>
                                  {rewardStatusLabel(r.status as RewardStatus)}
                                </Badge>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                Earned: {formatDate(r.earned_at)}
                                {r.redeemed_at ? ` • Redeemed: ${formatDate(r.redeemed_at)}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">No rewards yet.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
