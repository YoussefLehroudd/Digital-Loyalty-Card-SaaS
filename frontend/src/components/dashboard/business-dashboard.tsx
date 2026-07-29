"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartNoAxesColumnIncreasing, Gift, RefreshCw, ScanLine, Users } from "lucide-react";

import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDashboardOverview,
  type DashboardMetrics,
  type DashboardOverview,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useEcho } from "@/components/echo/echo-provider";

const formatter = new Intl.NumberFormat("en");

export function BusinessDashboard() {
  const { token, user } = useAuth();
  const echo = useEcho();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getDashboardOverview(token);
      setOverview(response);
    } catch {
      setError("Dashboard metrics could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDashboardSilent() {
    try {
      const response = await getDashboardOverview(token);
      setOverview(response);
    } catch {
      // keep existing UI state on silent refresh failures
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Realtime updates for the business workspace
  useEffect(() => {
    if (!echo.echo) return;
    const businessId = user?.business?.id ?? user?.business_id ?? null;
    if (!businessId) return;

    const channel = `business.${businessId}`;

    const c = echo.echo.private(channel);
    c.listen("StampAdded", () => void loadDashboardSilent());
    c.listen("RewardRedeemed", () => void loadDashboardSilent());
    c.listen("MembershipCreated", () => void loadDashboardSilent());
    c.listen("MembershipDeleted", () => void loadDashboardSilent());
    c.listen("BusinessBrandUpdated", () => void loadDashboardSilent());
    c.listen("BusinessCardUpdated", () => void loadDashboardSilent());

    return () => {
      try {
        c.stopListening("StampAdded");
        c.stopListening("RewardRedeemed");
        c.stopListening("MembershipCreated");
        c.stopListening("MembershipDeleted");
        c.stopListening("BusinessBrandUpdated");
        c.stopListening("BusinessCardUpdated");
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo.echo, user?.business?.id, user?.business_id, token]);

  const metrics = overview?.metrics;
  const isEmpty = metrics ? Object.values(metrics).every((value) => value === 0) : false;
  const businessName = overview?.business.name ?? user.business?.name ?? "Business";

  return (
    <DashboardShell activeItem="overview">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit border-success/30 bg-secondary text-secondary-foreground">
                  <ChartNoAxesColumnIncreasing className="mr-1 size-3" />
                  Business overview
                </Badge>
                <div>
                  <h1 className="text-3xl font-semibold leading-tight">
                    {businessName} dashboard
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Customer growth, visit activity, and reward performance for
                    this business workspace.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={isLoading} onClick={loadDashboard} variant="outline">
                  <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>

            {error ? <Alert className="border-red-500/30 text-red-600">{error}</Alert> : null}

            {isLoading ? <DashboardSkeleton /> : null}

            {!isLoading && overview ? (
              <>
                <MetricGrid metrics={overview.metrics} />
                {isEmpty ? <EmptyDashboardState /> : <DashboardSummary metrics={overview.metrics} />}
              </>
            ) : null}
      </div>
    </DashboardShell>
  );
}

function MetricGrid({ metrics }: { metrics: DashboardMetrics }) {
  const cards = useMemo(
    () => [
      {
        label: "Total customers",
        value: metrics.total_customers,
        detail: "Registered customer profiles",
        icon: Users,
      },
      {
        label: "Active customers",
        value: metrics.active_customers,
        detail: "Visited in the last 30 days",
        icon: ChartNoAxesColumnIncreasing,
      },
      {
        label: "Visits this month",
        value: metrics.visits_this_month,
        detail: "Recorded stamp activity",
        icon: ScanLine,
      },
      {
        label: "Rewards redeemed",
        value: metrics.rewards_redeemed,
        detail: "Completed reward claims",
        icon: Gift,
      },
    ],
    [metrics],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardDescription>{card.label}</CardDescription>
            <card.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatter.format(card.value)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardSummary({ metrics }: { metrics: DashboardMetrics }) {
  const repeatSignal =
    metrics.total_customers > 0
      ? Math.round((metrics.active_customers / metrics.total_customers) * 100)
      : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Performance snapshot</CardTitle>
          <CardDescription>
            A compact view of customer engagement for this business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active customer share</span>
              <span className="font-medium">{repeatSignal}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.min(repeatSignal, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Customer base" value={metrics.total_customers} />
            <SummaryTile label="Monthly visits" value={metrics.visits_this_month} />
            <SummaryTile label="Rewards claimed" value={metrics.rewards_redeemed} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace status</CardTitle>
          <CardDescription>Current business dashboard health.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            "Tenant access verified",
            "Metrics scoped to business",
            "Dashboard API online",
          ].map((item) => (
            <div
              className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm"
              key={item}
            >
              <span>{item}</span>
              <span className="size-2 rounded-full bg-success" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{formatter.format(value)}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyDashboardState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Users className="size-5" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">No customer activity yet</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Once customers join and visits are recorded, this dashboard will show
          live totals for customers, visits, and redeemed rewards.
        </p>
      </CardContent>
    </Card>
  );
}
