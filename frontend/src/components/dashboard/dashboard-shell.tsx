"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
import { EchoProvider, useEcho } from "@/components/echo/echo-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBusinessNotifications, markAllBusinessNotificationsRead, markBusinessNotificationRead, type BusinessNotification } from "@/lib/auth";

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
  const { user, signOut, token } = useAuth();
  const businessName = user.business?.name ?? "Business";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);

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
    <main className="min-h-screen bg-[#070806] text-white">
      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] overflow-hidden border-r border-[#d9a52f]/15 bg-[#090a08] lg:block" style={{ backgroundImage: "url('/brand/Élégantes vagues dorées sur fond noir.png')", backgroundSize: "cover", backgroundPosition: "bottom", backgroundRepeat: "no-repeat" }}>
          <div className="absolute inset-0 bg-black/25" aria-hidden="true" />
          <div className="relative z-10 flex h-dvh flex-col">
            <div className="flex h-20 items-center gap-3 px-5">
              <div className="flex size-14 items-center justify-center">
                <Image
                  alt="LOYVANCE"
                  className="h-full w-full object-contain"
                  height={48}
                  priority
                  src="/brand/icon.png"
                  width={48}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-wide">LOYVANCE</p>
                <p className="truncate text-xs text-muted-foreground">
                  {businessName}
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-2 px-3 py-5">
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

            <div className="p-3">
              <Button className="h-12 w-full justify-start gap-3 rounded-xl border border-transparent text-white/55 transition-all hover:border-[#d9a52f]/20 hover:bg-[#d9a52f]/5 hover:text-white" onClick={signOut} variant="ghost">
                <LogOut className="size-4" />
                Log out
              </Button>
            </div>
          </div>
        </aside>

        <section className="relative min-h-screen min-w-0 bg-[#070806] lg:col-start-2">
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 left-0 z-0 bg-[#070806] bg-[url('/brand/Rubans_dorés_sur_fond_noir.png')] bg-cover bg-top bg-no-repeat lg:left-[264px]" style={{ backgroundImage: "linear-gradient(rgba(7,8,6,.18),rgba(7,8,6,.42)), url('/brand/Rubans dorés sur fond noir.png')" }} />
          <div className="relative z-10 min-h-screen">
          <TopNav
            activeItem={activeItem}
            userName={user.name ?? businessName}
            avatarUrl={user.avatar_url ?? null}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            notifications={[]}
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
                  <div className="flex min-w-0 items-center gap-2">
                    <Image
                      alt="LOYVANCE"
                      className="size-12 object-contain"
                      height={48}
                      priority
                      src="/brand/icon.png"
                      width={48}
                    />
                    <p className="truncate text-sm font-semibold">LOYVANCE</p>
                  </div>
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

          <EchoProvider token={token ?? null}>
            <DashboardRealtimeContent>{children}</DashboardRealtimeContent>
          </EchoProvider>
          </div>
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
  const className = cn("h-12 w-full justify-start gap-3 rounded-xl border transition-all", active ? "border-[#f6bd46]/40 bg-gradient-to-r from-[#b27a14]/35 to-[#e4a62e]/15 text-[#ffc857] shadow-[0_0_24px_rgba(224,165,46,.10)]" : "border-transparent text-white/55 hover:border-[#d9a52f]/20 hover:bg-[#d9a52f]/5 hover:text-white");

  if (!href) {
    return (
      <Button className={className} disabled variant="ghost">
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button asChild className={className} variant="ghost">
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


function DashboardRealtimeContent({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { echo } = useEcho();
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await getBusinessNotifications(token);
        if (!cancelled) setNotifications(result.data ?? []);
      } catch {}
    };
    void refresh();
    if (!echo) return () => { cancelled = true; };
    const channel = echo.private("business");
    channel.listen("data.changed", refresh);
    return () => {
      cancelled = true;
      channel.stopListening("data.changed", refresh);
    };
  }, [token, echo]);

  return (
    <>
      <DashboardNotificationBridge notifications={notifications} />
      {children}
    </>
  );
}

function DashboardNotificationBridge({ notifications }: { notifications: BusinessNotification[] }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("loyvance:notifications", { detail: notifications }));
  }, [notifications]);
  return null;
}

function TopNav({
  activeItem,
  userName,
  avatarUrl,
  onOpenMobileMenu,
  notifications,
}: {
  activeItem: DashboardShellProps["activeItem"];
  userName: string;
  avatarUrl: string | null;
  onOpenMobileMenu: () => void;
  notifications: BusinessNotification[];
}) {
  const { token } = useAuth();
  const initial = userName.trim().charAt(0).toUpperCase() || "Y";
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const [liveNotifications, setLiveNotifications] = useState<BusinessNotification[]>(notifications);

  useEffect(() => {
    const handler = (event: Event) => setLiveNotifications((event as CustomEvent<BusinessNotification[]>).detail ?? []);
    window.addEventListener("loyvance:notifications", handler);
    return () => window.removeEventListener("loyvance:notifications", handler);
  }, []);
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notificationsRef.current?.contains(target)) setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [notificationsOpen]);

  const unreadNotifications = liveNotifications.filter((item) => !item.is_read);
  const markAllRead = async () => {
    if (!token || unreadNotifications.length === 0) return;
    setLiveNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    try { await markAllBusinessNotificationsRead(token); } catch {
      try { const result = await getBusinessNotifications(token); setLiveNotifications(result.data ?? []); } catch {}
    }
  };
  const markOneRead = async (item: BusinessNotification) => {
    if (!token || item.is_read) return;
    const key = `${item.type}-${item.id}`;
    setLiveNotifications((items) => items.map((entry) => entry.type === item.type && entry.id === item.id ? { ...entry, is_read: true } : entry));
    try { await markBusinessNotificationRead(token, key); } catch {
      try { const result = await getBusinessNotifications(token); setLiveNotifications(result.data ?? []); } catch {}
    }
  };
  const pageTitle: Record<DashboardShellProps["activeItem"], string> = {
    overview: "Dashboard",
    customers: "Customers",
    loyalty: "Loyalty Card",
    scanner: "QR Scanner",
    rewards: "Rewards",
    settings: "Settings",
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#d9a52f]/15 bg-[#080907]/95 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
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
          <h1 className="hidden text-xl font-bold tracking-tight lg:block">{pageTitle[activeItem]}</h1>
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Image alt="LOYVANCE" className="size-8 object-contain" height={32} priority src="/brand/icon.png" width={48}/>
            <p className="truncate text-sm font-semibold">LOYVANCE</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div ref={notificationsRef} className="relative">
            <Button aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)} className="relative text-white/75 hover:bg-white/5 hover:text-white" size="icon" variant="ghost">
              <Bell className="size-5" />
              {unreadNotifications.length > 0 ? <span className="absolute right-1.5 top-1.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#f3bd55] px-1 text-[9px] font-black text-black shadow-[0_0_8px_rgba(243,189,85,.8)]">{Math.min(unreadNotifications.length,99)}</span> : null}
            </Button>
            {notificationsOpen ? <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#e7b354]/25 bg-[#090a08]/[.98] shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div className="min-w-0"><p className="font-bold text-white">Notifications</p><p className="text-xs text-white/45">Latest business activity</p></div>{unreadNotifications.length > 0 ? <button type="button" onClick={markAllRead} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#f3bd55] transition hover:bg-[#f3bd55]/10">Read all</button> : <span className="shrink-0 text-xs text-white/30">All read</span>}</div>
              <div className="max-h-[420px] overscroll-contain overflow-y-auto p-2" onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>{liveNotifications.length ? liveNotifications.slice(0,20).map((item) => <div key={item.type+"-"+item.id} onClick={() => void markOneRead(item)} className={`cursor-pointer rounded-xl px-3 py-3 hover:bg-white/[.04] ${item.is_read ? "opacity-55" : ""}`}><div className="flex items-start gap-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-[#f3bd55]"/><div className="min-w-0"><p className="text-sm font-semibold text-white">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-white/55">{item.message}</p><p className="mt-1 whitespace-nowrap text-[10px] text-white/35">{new Date(item.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p></div></div></div>) : <p className="px-3 py-8 text-center text-sm text-white/40">No notifications yet.</p>}</div>
            </div> : null}
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e7b354]/25 bg-[#5b451b] font-bold text-white shadow-[0_0_14px_rgba(231,179,84,.10)]">{avatarUrl ? <img alt={userName} src={avatarUrl} className="h-full w-full object-cover object-center" /> : initial}</div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-44 truncate text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-white/40">Business Owner</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
