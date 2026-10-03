"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, CheckCircle2, Gift, Search, Sparkles } from "lucide-react";

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

type RewardStatusFilter = "all" | "ready" | "redeemed";

type RewardRow = {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  reward_name: string | null;
  earned_at: string | null;
  redeemed_at: string | null;
  status: "ready" | "redeemed";
};

type RewardsResponse = {
  data: RewardRow[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
  summary: {
    total_rewards: number;
    rewards_ready: number;
    rewards_redeemed: number;
  };
  query: {
    q: string;
    page: number;
    per_page: number;
    status: string | null;
  };
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function customerName(r: RewardRow) {
  if (!r.customer) return "—";
  return [r.customer.first_name, r.customer.last_name].filter(Boolean).join(" ").trim();
}

function statusBadgeClass(status: RewardRow["status"]) {
  // Spec:
  // Ready = green? (user wants green for Ready in Rewards page)
  // Redeemed = blue
  if (status === "ready") {
    return cn(
      "border-transparent bg-emerald-600/15 text-emerald-200",
      "hover:opacity-90",
      "dark:bg-emerald-500/15 dark:text-emerald-200",
    );
  }

  return cn(
    "border-transparent bg-blue-600/15 text-blue-200",
    "hover:opacity-90",
    "dark:bg-blue-500/15 dark:text-blue-200",
  );
}

function statusLabel(status: RewardRow["status"]) {
  return status === "ready" ? "Ready to Redeem" : "Redeemed";
}

export default function RewardsPage() {
  const { token } = useAuth();
  const { echo } = useEcho();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<RewardStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [response, setResponse] = useState<RewardsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPrev = response ? page > 1 : false;
  const canNext = response ? page < response.meta.last_page : false;

  const statusQueryValue = useMemo(() => {
    if (statusFilter === "all") return null;
    return statusFilter;
  }, [statusFilter]);

  // Debounce search input to reduce API requests while typing
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    // Reset pagination when query/filter changes
    setPage(1);
  }, [debouncedQ, statusFilter]);

  const loadRewards = async (opts?: { nextPage?: number }) => {
    if (!token) return;

    const nextPage = opts?.nextPage ?? page;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: debouncedQ,
        page: String(nextPage),
        per_page: String(perPage),
      });

      if (statusQueryValue) {
        params.set("status", statusQueryValue);
      }

      const res = await apiFetch<RewardsResponse>(
        `/business/rewards?${params.toString()}`,
        { token },
      );

      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rewards.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Single fetch effect driven by (page, debouncedQ, statusFilter)
    loadRewards({ nextPage: page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, statusFilter, statusQueryValue]);

  useEffect(() => {
    if (!echo || !token) return;
    const channel = echo.private("business");
    const refresh = () => { void loadRewards({ nextPage: page }); };
    channel.listen("data.changed", refresh);
    return () => { channel.stopListening("data.changed", refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo, token, page, debouncedQ, statusQueryValue]);

  const rewards = response?.data ?? [];
  const isEmpty = !isLoading && response && rewards.length === 0;

  return (
    <DashboardShell activeItem="rewards">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-[#e7b354]/15 bg-black/25 shadow-none">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-border" />
                    Total Rewards
                  </CardTitle>
                  <div className="text-2xl font-semibold">
                    {response ? response.summary.total_rewards : "—"}
                  </div>
                </CardHeader>
              </Card>

              <Card className="border-[#e7b354]/15 bg-black/25 shadow-none">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <BadgeCheck className="h-4 w-4 text-emerald-400" />
                    Ready to Redeem
                  </CardTitle>
                  <div className="text-2xl font-semibold">
                    {response ? response.summary.rewards_ready : "—"}
                  </div>
                </CardHeader>
              </Card>

              <Card className="border-[#e7b354]/15 bg-black/25 shadow-none">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-500/15 text-blue-200" />
                    Redeemed
                  </CardTitle>
                  <div className="text-2xl font-semibold">
                    {response ? response.summary.rewards_redeemed : "—"}
                  </div>
                </CardHeader>
              </Card>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search rewards by customer name/email/phone..."
                  className="border-[#e7b354]/15 bg-black/30 pl-9 focus-visible:ring-[#e7b354]/30"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "ready", "redeemed"] as RewardStatusFilter[]).map((t) => {
                const label = t === "all" ? "All" : t === "ready" ? "Ready" : "Redeemed";
                const active = statusFilter === t;
                return (
                  <Button
                    key={t}
                    variant={active ? "default" : "outline"}
                    onClick={() => setStatusFilter(t)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {error ? <Alert>{error}</Alert> : null}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full">
                <thead className="border-b border-white/10 bg-white/[.025] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-4 px-4 font-medium">Customer</th>
                    <th className="py-4 px-4 font-medium">Reward</th>
                    <th className="py-4 px-4 font-medium">Earned Date</th>
                    <th className="py-4 px-4 font-medium">Redeemed Date</th>
                    <th className="py-4 px-4 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx} className="h-16">
                        <td colSpan={5} className="px-4 py-4">
                          <Skeleton className="h-4 w-2/3" />
                        </td>
                      </tr>
                    ))
                  ) : isEmpty ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10">
                        <div className="text-center text-sm text-muted-foreground">
                          No rewards found.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rewards.map((r, idx) => (
                      <tr key={`${r.customer?.id ?? "null"}-${r.reward_name ?? "null"}-${idx}`} className="align-middle transition-colors hover:bg-[#e7b354]/[.035]">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e7b354]/25 bg-[#8b5d12]/30 text-xs font-bold text-[#ffc857]">{customerName(r).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><div className="font-semibold text-white">{customerName(r)}</div>
                          <div className="text-sm text-muted-foreground">
                            {r.customer?.email || r.customer?.phone || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">{r.reward_name || "—"}</td>
                        <td className="px-4 py-4 text-sm">{formatDate(r.earned_at)}</td>
                        <td className="px-4 py-4 text-sm">{formatDate(r.redeemed_at)}</td>
                        <td className="px-4 py-4">
                          <Badge className={cn("px-2 py-1", statusBadgeClass(r.status))}>
                            {statusLabel(r.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {response ? (
              <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">{response.meta.from ?? 0}</span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">{response.meta.to ?? 0}</span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">{response.meta.total}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!canPrev || isLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(response.meta.last_page, p + 1))}
                    disabled={!canNext || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
