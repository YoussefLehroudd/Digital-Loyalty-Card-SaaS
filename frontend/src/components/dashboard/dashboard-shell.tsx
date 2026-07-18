"use client";

import Link from "next/link";
import {
  Bell,
  CreditCard,
  Gift,
  Home,
  LogOut,
  Menu,
  ScanLine,
  Search,
  Settings,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-guard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  activeItem:
    | "overview"
    | "settings"
    | "loyalty"
    | "customers"
    | "scanner"
    | "rewards";
  children: React.ReactNode;
};

const sidebarItems = [
  { key: "overview", label: "Overview", icon: Home, href: "/dashboard" },
  { key: "customers", label: "Customers", icon: Users },
  { key: "loyalty", label: "Loyalty card", icon: CreditCard },
  { key: "scanner", label: "Scanner", icon: ScanLine, href: "/dashboard/scanner" },
  { key: "rewards", label: "Rewards", icon: Gift },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
  },
];

export function DashboardShell({ activeItem, children }: DashboardShellProps) {
  const { user, signOut } = useAuth();
  const businessName = user.business?.name ?? "Business";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="hidden min-h-screen border-r bg-card lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="flex h-16 items-center gap-3 border-b px-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CreditCard className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Digital Loyalty</p>
                <p className="truncate text-xs text-muted-foreground">
                  {businessName}
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
              {sidebarItems.map((item) => (
                <SidebarItem
                  active={item.key === activeItem}
                  href={item.href}
                  icon={item.icon}
                  key={item.key}
                  label={item.label}
                />
              ))}
            </nav>

            <div className="border-t p-3">
              <Button className="w-full justify-start" onClick={signOut} variant="ghost">
                <LogOut className="size-4" />
                Log out
              </Button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <TopNav businessName={businessName} onSignOut={signOut} />

          <div className="border-b px-4 py-2 lg:hidden">
            <div className="flex gap-2 overflow-x-auto">
              {sidebarItems.map((item) => (
                <MobileNavItem
                  active={item.key === activeItem}
                  href={item.href}
                  icon={item.icon}
                  key={item.key}
                  label={item.label}
                />
              ))}
            </div>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}

function SidebarItem({
  active,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  href?: string;
  icon: React.ElementType;
  label: string;
}) {
  const className = cn("w-full justify-start", !active && "text-muted-foreground");

  if (!href) {
    return (
      <Button className={className} disabled variant="ghost">
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button asChild className={className} variant={active ? "secondary" : "ghost"}>
      <Link href={href}>
        <Icon className="size-4" />
        {label}
      </Link>
    </Button>
  );
}

function MobileNavItem({
  active,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  href?: string;
  icon: React.ElementType;
  label: string;
}) {
  if (!href) {
    return (
      <Button className="shrink-0" disabled size="sm" variant="ghost">
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button asChild className="shrink-0" size="sm" variant={active ? "secondary" : "ghost"}>
      <Link href={href}>
        <Icon className="size-4" />
        {label}
      </Link>
    </Button>
  );
}

function TopNav({
  businessName,
  onSignOut,
}: {
  businessName: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label="Open menu" className="lg:hidden" size="icon" variant="ghost">
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{businessName}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Protected business workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button aria-label="Search" size="icon" variant="ghost">
            <Search className="size-4" />
          </Button>
          <Button aria-label="Notifications" size="icon" variant="ghost">
            <Bell className="size-4" />
          </Button>
          <ThemeToggle />
          <Button onClick={onSignOut} variant="outline">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
