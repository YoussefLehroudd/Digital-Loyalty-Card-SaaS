"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Search, User, Users } from "lucide-react";

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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-none">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Total Customers
                  </CardTitle>
                  <div className="text-2xl font-semibold">
                    {summary ? summary.total_customers : "—"}
                  </div>
                </CardHeader>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <User className="h-4 w-4" />
                    Active Customers
                  </CardTitle>
                  <div className="text-2xl font-semibold">
                    {summary ? summary.active_customers : "—"}
                  </div>
                </CardHeader>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <BadgeCheck className="h-4 w-4" />
                    Rewards Ready
                  </CardTitle>
                  <div className="text-2xl font-semibold">
                    {summary ? summary.rewards_ready : "—"}
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
                  placeholder="Search by name, email, or phone..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? <Alert>{error}</Alert> : null}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-4 px-4 font-medium">Customer</th>
                    <th className="py-4 px-4 font-medium">Progress</th>
                    <th className="py-4 px-4 font-medium">Reward Status</th>
                    <th className="py-4 px-4 font-medium">Visits</th>
                    <th className="py-4 px-4 font-medium">Last Visit</th>
                    <th className="py-4 px-4 font-medium">Joined</th>
                    <th className="py-4 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx} className="h-16">
                        <td colSpan={7} className="px-4 py-4">
                          <Skeleton className="h-4 w-2/3" />
                        </td>
                      </tr>
                    ))
                  ) : isEmpty ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10">
                        <div className="text-center text-sm text-muted-foreground">
                          No customers found.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.id} className="align-middle">
                        <td className="px-4 py-4">
                          <div className="font-medium">{formatName(c) || "—"}</div>
                          <div className="text-sm text-muted-foreground">
                            {(c.email ?? c.phone) ? (
                              <span>
                                {c.email ? c.email : c.phone}
                              </span>
                            ) : (
                              "—"
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-medium">{progressText(c)}</div>
                          <div className="mt-2 h-2 w-44 max-w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-ring"
                              style={{ width: `${progressPercent(c)}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <Badge className={cn("px-2 py-1", statusBadgeClass(c.reward_status))}>
                            {rewardStatusLabel(c.reward_status)}
                          </Badge>
                        </td>

                        <td className="px-4 py-4 text-sm">{c.total_visits}</td>
                        <td className="px-4 py-4 text-sm">{formatDate(c.last_visit)}</td>
                        <td className="px-4 py-4 text-sm">{formatDate(c.joined_at)}</td>

<td className="px-4 py-4 text-right">
  <Button variant="secondary" className="cursor-pointer" onClick={() => openDetails(c)}>
    View Details
  </Button>
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
                  <span className="font-medium text-foreground">
                    {response.meta.from ?? 0}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {response.meta.to ?? 0}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">
                    {response.meta.total}
                  </span>
                </div>

<div className="flex items-center gap-2">
  <Button
    variant="outline"
    className="cursor-pointer"
    onClick={() => setPage((p) => Math.max(1, p - 1))}
    disabled={!canPrev || isLoading}
  >
    Previous
  </Button>
  <Button
    variant="outline"
    className="cursor-pointer"
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
