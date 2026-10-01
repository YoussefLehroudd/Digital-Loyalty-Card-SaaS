"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChartSpline, CreditCard, Home, LogOut, Trophy, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/user/dashboard", label: "Home", icon: Home },
  { href: "/user/cards", label: "Cards", icon: CreditCard },
  { href: "/user/rewards", label: "Rewards", icon: Trophy },
  { href: "/user/activity", label: "Activity", icon: ChartSpline },
  { href: "/user/profile", label: "Profile", icon: User },
];

export function CustomerLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useCustomerAuth();
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-card/40 lg:backdrop-blur-xl">
        <div className="border-b px-6 py-6">
          <p className="text-lg font-semibold tracking-tight">Loyalty Wallet</p>
          <p className="mt-1 text-xs text-muted-foreground">Your rewards, all in one place</p>
        </div>
        <nav className="flex-1 space-y-1.5 p-4">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
                <Icon className="h-5 w-5" /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          {user ? <p className="mb-3 truncate px-2 text-xs text-muted-foreground">{user.email}</p> : null}
          <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 lg:max-w-7xl lg:px-8 lg:py-5">
            <div>
              <h1 className="text-base font-semibold lg:text-2xl lg:tracking-tight">{title}</h1>
              {subtitle ? <p className="text-xs text-muted-foreground lg:mt-1 lg:text-sm">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => router.push("/user/notifications")} aria-label="Notifications" className="lg:rounded-xl">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={logout} className="lg:hidden">Logout</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4 lg:max-w-7xl lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px]",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}>
                  <Icon className="h-4 w-4" /><span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <footer className="mx-auto w-full max-w-md px-4 pb-28 text-center text-xs text-muted-foreground lg:hidden">
          {user && pathname === "/user/profile" ? `Signed in as ${user.email}` : ""}
        </footer>
      </div>
    </div>
  );
}
