import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Building2,
  ChartNoAxesColumnIncreasing,
  Check,
  CreditCard,
  Gift,
  Menu,
  QrCode,
  ScanLine,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
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

const metrics = [
  {
    label: "Total customers",
    value: "12,480",
    change: "+18.4%",
    icon: Users,
  },
  {
    label: "Visits this month",
    value: "4,862",
    change: "+11.2%",
    icon: ScanLine,
  },
  {
    label: "Rewards redeemed",
    value: "738",
    change: "+7.9%",
    icon: Gift,
  },
  {
    label: "Repeat rate",
    value: "64%",
    change: "+4.1%",
    icon: ChartNoAxesColumnIncreasing,
  },
];

const navigation = [
  { label: "Workspace", icon: Building2 },
  { label: "Scanner", icon: ScanLine },
  { label: "Loyalty card", icon: CreditCard },
  { label: "Analytics", icon: ChartNoAxesColumnIncreasing },
];

const visits = [
  { name: "Maya Chen", status: "Stamp added", time: "2 min ago" },
  { name: "Alex Morgan", status: "Reward redeemed", time: "18 min ago" },
  { name: "Jordan Lee", status: "Customer joined", time: "41 min ago" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Open menu"
              className="md:hidden"
              size="icon"
              variant="ghost"
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CreditCard className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">
                Digital Loyalty
              </p>
              <p className="text-xs text-muted-foreground">SaaS console</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            {["Customers", "Rewards", "Billing"].map((item) => (
              <Button key={item} variant="ghost">
                {item}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild className="hidden sm:inline-flex" variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/register">Create account</Link>
            </Button>
            <Button aria-label="Search" size="icon" variant="ghost">
              <Search className="size-4" />
            </Button>
            <Button aria-label="Notifications" size="icon" variant="ghost">
              <Bell className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-2">
            {navigation.map((item, index) => {
              const Icon = item.icon;

              return (
                <Button
                  key={item.label}
                  className="w-full justify-start"
                  variant={index === 0 ? "secondary" : "ghost"}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit border-success/30 bg-secondary text-secondary-foreground">
                <Sparkles className="mr-1 size-3" />
                Starter workspace
              </Badge>
              <div>
                <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                  Star Coffee loyalty overview
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Customers, QR visits, stamp progress, and reward activity in
                  one focused operator console.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline">
                <QrCode className="size-4" />
                Preview card
              </Button>
              <Button asChild>
                <Link href="/dashboard">
                  <ScanLine className="size-4" />
                  Open scanner
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <Card key={metric.label}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardDescription>{metric.label}</CardDescription>
                    <Icon className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold">{metric.value}</p>
                      <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        {metric.change}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Customer activity</CardTitle>
                    <CardDescription>
                      Live visit and reward events for this business.
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="outline">
                    View all
                    <ArrowUpRight className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {visits.map((visit) => (
                  <div
                    key={`${visit.name}-${visit.status}`}
                    className="flex items-center justify-between rounded-lg border bg-background p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                        {visit.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {visit.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {visit.status}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {visit.time}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Loyalty card</CardTitle>
                <CardDescription>Free Coffee after 10 stamps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border bg-primary p-4 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Star Coffee</p>
                      <p className="text-xs opacity-70">Member card</p>
                    </div>
                    <QrCode className="size-7" />
                  </div>
                  <div className="mt-6 grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex aspect-square items-center justify-center rounded-md bg-primary-foreground/12"
                      >
                        {index < 7 ? <Check className="size-4" /> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">7 of 10 stamps</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[70%] rounded-full bg-success" />
                  </div>
                </div>

                <div className="grid grid-cols-[96px_1fr] gap-4">
                  <div className="flex aspect-square items-center justify-center rounded-lg border bg-background">
                    <QrCode className="size-12" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
