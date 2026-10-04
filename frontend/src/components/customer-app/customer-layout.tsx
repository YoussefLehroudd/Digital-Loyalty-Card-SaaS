"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChartSpline, CreditCard, Home, LogOut, Sparkles, Trophy, User } from "lucide-react";

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
    <div className="min-h-dvh overflow-x-clip bg-[#080907] text-foreground lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[280px] lg:flex-col lg:border-r lg:border-[#d8a63f]/15 lg:bg-[linear-gradient(180deg,rgba(16,17,14,.98),rgba(8,9,7,.98))] lg:backdrop-blur-xl">
        <div className="border-b border-[#d8a63f]/10 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[#8b5d12]/20 text-[#ffc857]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">LOYVANCE</p>
              <p className="text-xs text-muted-foreground">Loyalty wallet</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 p-4 pt-5">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                active ? "border-[#e7b354]/25 bg-[#d79b16]/12 text-[#ffc857] shadow-[0_8px_24px_rgba(215,155,22,.08)]" : "border-transparent text-muted-foreground hover:border-white/5 hover:bg-white/[.035] hover:text-white",
              )}>
                <Icon className="h-5 w-5" /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#d8a63f]/10 p-4">
          {user ? <p className="mb-3 truncate px-2 text-xs text-muted-foreground">{user.email}</p> : null}
          <Button variant="outline" className="w-full justify-start gap-2 border-[#d8a63f]/15 bg-black/20 hover:bg-white/5" onClick={logout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-[280px]">
        <header className="sticky top-0 z-30 border-b border-[#d8a63f]/10 bg-[#080907]/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 lg:max-w-[1440px] lg:px-8 lg:py-5">
            <div>
              <h1 className="text-base font-bold text-white lg:text-2xl lg:tracking-tight">{title}</h1>
              {subtitle ? <p className="text-xs text-muted-foreground lg:mt-1 lg:text-sm">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => router.push("/user/notifications")} aria-label="Notifications" className="border border-transparent lg:rounded-xl hover:border-[#d8a63f]/15 hover:bg-[#d79b16]/10 hover:text-[#ffc857]">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={logout} className="lg:hidden">Logout</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4 lg:max-w-[1440px] lg:px-8 lg:pb-12 lg:pt-7">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-[100] translate-z-0 border-t border-[#d8a63f]/15 bg-[#0b0c0a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden [transform:translate3d(0,0,0)]">
          <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] transition-colors",
                  active ? "bg-[#d79b16]/12 text-[#ffc857]" : "text-muted-foreground",
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
