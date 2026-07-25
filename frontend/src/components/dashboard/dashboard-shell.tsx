"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CreditCard,
  Gift,
  Home,
  LogOut,
  Menu,
  ScanLine,
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
  { key: "customers", label: "Customers", icon: Users, href: "/dashboard/customers" },
  {
    key: "loyalty",
    label: "Loyalty card",
    icon: CreditCard,
    href: "/dashboard/loyalty-card",
  },
  { key: "scanner", label: "Scanner", icon: ScanLine, href: "/dashboard/scanner" },
  { key: "rewards", label: "Rewards", icon: Gift, href: "/dashboard/rewards" },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileMenuOpen]);

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
          <TopNav
            onSignOut={signOut}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          />

          {isMobileMenuOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                aria-label="Close mobile menu overlay"
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsMobileMenuOpen(false)}
                type="button"
              />
              <div className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] border-r bg-background shadow-xl">
                <div className="flex h-16 items-center justify-between border-b px-4">
                  <p className="text-sm font-semibold">Navigation</p>
                  <Button
                    aria-label="Close menu"
                    onClick={() => setIsMobileMenuOpen(false)}
                    size="icon"
                    variant="ghost"
                  >
                    <Menu className="size-5" />
                  </Button>
                </div>
                <nav className="space-y-1 p-3">
                  {sidebarItems.map((item) => (
                    <MobileDrawerItem
                      active={item.key === activeItem}
                      href={item.href}
                      icon={item.icon}
                      key={item.key}
                      label={item.label}
                      onNavigate={() => setIsMobileMenuOpen(false)}
                    />
                  ))}
                </nav>
              </div>
            </div>
          ) : null}

          <div className="border-b px-4 py-2 lg:hidden">
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
              />
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

function MobileDrawerItem({
  active,
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  active: boolean;
  href?: string;
  icon: React.ElementType;
  label: string;
  onNavigate: () => void;
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
      <Link href={href} onClick={onNavigate}>
        <Icon className="size-4" />
        {label}
      </Link>
    </Button>
  );
}

function TopNav({
  onSignOut,
  onOpenMobileMenu,
}: {
  onSignOut: () => Promise<void>;
  onOpenMobileMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-label="Open menu"
            className="lg:hidden"
            onClick={onOpenMobileMenu}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold">Digital Loyalty</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
