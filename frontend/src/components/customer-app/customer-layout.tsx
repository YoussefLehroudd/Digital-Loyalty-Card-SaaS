"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChartSpline, CreditCard, Home, Trophy, User } from "lucide-react";

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
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => router.push("/user/notifications")}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background">
        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px]",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <footer className="mx-auto w-full max-w-md px-4 pb-28 text-center text-xs text-muted-foreground">
        {user && pathname === "/user/profile" ? `Signed in as ${user.email}` : ""}
      </footer>
    </div>
  );
}
