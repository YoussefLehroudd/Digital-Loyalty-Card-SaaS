"use client";
import { getFormattingLocale } from "@/components/i18n/language-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, CreditCard, Gift, Handshake, Home, Download, LogOut, Megaphone, Menu, Sparkles, ScanLine, Settings, Users, UserCog, BarChart3, MessageSquare, Cake, Compass, } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-guard";
import { EchoProvider, useEcho } from "@/components/echo/echo-provider";
import { Button } from "@/components/ui/button";
import { BusinessSubscriptionAlert, BusinessSubscriptionCard, BusinessSubscriptionModal, useBusinessSubscription } from "@/components/subscriptions/business-subscription";
import { cn } from "@/lib/utils";
import {usePersistentNavScroll} from "@/components/navigation/use-persistent-nav-scroll";
import { getBusinessNotifications, markAllBusinessNotificationsRead, markBusinessNotificationRead, type BusinessNotification } from "@/lib/auth";
type DashboardShellProps = {
    activeItem: "overview" | "settings" | "loyalty" | "customers" | "scanner" | "rewards" | "affiliate" | "campaigns" | "offers" | "staff" | "analytics" | "feedback" | "birthdays" | "discover" | "app" | "premium";
    children: React.ReactNode;
};
const sidebarItems = [
    { key: "overview", label: "Overview", icon: Home, href: "/dashboard" },
    { key: "app", label: "Install App", icon: Download, href: "/dashboard/app" },
    { key: "customers", label: "Customers", icon: Users, href: "/dashboard/customers" },
    {
        key: "loyalty",
        label: "Loyalty card",
        icon: CreditCard,
        href: "/dashboard/loyalty-card",
    },
    { key: "scanner", label: "Scanner", icon: ScanLine, href: "/dashboard/scanner" },
    { key: "rewards", label: "Rewards", icon: Gift, href: "/dashboard/rewards" },
    { key: "premium", label: "Request Features", icon: Sparkles, href: "/dashboard/premium" },
    { key: "campaigns", label: "Campaigns", icon: Megaphone, href: "/dashboard/campaigns" },
    { key: "offers", label: "Special Offers", icon: Sparkles, href: "/dashboard/offers" },
    { key: "staff", label: "Staff Management", icon: UserCog, href: "/dashboard/staff" },
    { key: "discover", label: "Discover Pro", icon: Compass, href: "/dashboard/discover" },
    { key: "analytics", label: "Analytics Pro", icon: BarChart3, href: "/dashboard/analytics" },
    { key: "feedback", label: "Feedback", icon: MessageSquare, href: "/dashboard/feedback" },
    { key: "birthdays", label: "Birthdays", icon: Cake, href: "/dashboard/birthdays" },
    { key: "affiliate", label: "Affiliate", icon: Handshake, href: "/dashboard/affiliate" },
    {
        key: "settings",
        label: "Settings",
        icon: Settings,
        href: "/dashboard/settings",
    },
];
export function DashboardShell({ activeItem, children }: DashboardShellProps) {
    const { t: tr } = useI18n();
    const { user, signOut, token } = useAuth();
    const businessName = user.business?.name ?? "Business";
    const subscription = useBusinessSubscription(user.role==="staff"?null:token ?? null);
    const expired = subscription.data?.subscription.state === "expired";
    const [subscriptionOpen, setSubscriptionOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
    const [isAffiliate, setIsAffiliate] = useState(false);
    useEffect(() => { if(user.role==="staff")return; let valid = true; apiFetch("/affiliate/me", {token,cache:"no-store"}).then(()=>{if(valid)setIsAffiliate(true);}).catch(()=>{if(valid)setIsAffiliate(false);});return()=>{valid=false;}; },[token]);
    const [premiumAccess,setPremiumAccess]=useState<Record<string,string>>({});
    useEffect(()=>{
      let active=true;
      const load=()=>apiFetch<{features:Record<string,string>}>("/premium-features",{token,cache:"no-store"})
        .then(data=>{if(active)setPremiumAccess(data.features);}).catch(()=>{if(active)setPremiumAccess({});});
      void load();
      const onFocus=()=>void load();
      window.addEventListener("focus",onFocus);
      return()=>{active=false;window.removeEventListener("focus",onFocus);};
    },[token]);
    const premiumKeys:Record<string,string>={birthdays:"birthdays",analytics:"analytics",staff:"staff",offers:"offers",campaigns:"campaigns"};
    const visibleItems = sidebarItems.filter(item => (item.key !== "affiliate" || isAffiliate) && (!premiumKeys[item.key] || premiumAccess[premiumKeys[item.key]]==="approved"));
    const desktopScroll=usePersistentNavScroll("business:"+user.id+":desktop",activeItem);
    const mobileScroll=usePersistentNavScroll("business:"+user.id+":mobile",activeItem);
    useEffect(() => {
        if (!isMobileMenuOpen)
            return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsMobileMenuOpen(false);
            }
        }
        const scrollY = window.scrollY;
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const previousBodyOverscroll = document.body.style.overscrollBehavior;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.body.style.overscrollBehavior = "none";
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overscrollBehavior = previousBodyOverscroll;
            window.scrollTo(0, scrollY);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isMobileMenuOpen]);
    if(user.role==="staff")return <main className="min-h-screen bg-[#070806] text-white">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#e7b354]/20 bg-[#080907] px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3"><ScanLine className="size-6 text-[#e7b354]"/><div><p className="font-bold">LOYVANCE · Cashier Scanner</p><p className="text-xs text-white/55">{businessName} · {user.name}</p></div></div>
        <Button variant="outline" onClick={()=>void signOut()}><LogOut className="size-4"/>Logout</Button>
      </header>
      {children}
    </main>;
    return (<main className="min-h-screen bg-[#070806] text-white">
      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-[264px] overflow-hidden border-e border-[#d9a52f]/15 bg-[#090a08] lg:block" style={{ backgroundImage: "url('/brand/Élégantes vagues dorées sur fond noir.png')", backgroundSize: "cover", backgroundPosition: "bottom", backgroundRepeat: "no-repeat" }}>
          <div className="absolute inset-0 bg-black/25" aria-hidden="true"/>
          <div className="relative z-10 flex h-dvh flex-col">
            <div className="flex h-20 items-center gap-3 px-5">
              <div className="flex size-14 items-center justify-center">
                <Image alt={"LOYVANCE"} className="h-full w-full object-contain" height={48} priority src="/brand/icon.png" width={48}/>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-wide">LOYVANCE</p>
                <p className="truncate text-xs text-muted-foreground">
                  {businessName}
                </p>
              </div>
            </div>

            <nav ref={desktopScroll.ref} onScroll={desktopScroll.onScroll} onClickCapture={desktopScroll.onClickCapture} className="loyvance-sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-5">
              {visibleItems.map((item) => (<SidebarItem active={item.key === activeItem} href={item.href} icon={item.icon} key={item.key} label={tr(item.label)}/>))}
            </nav>

            <div className="shrink-0 p-3">
              <BusinessSubscriptionCard {...subscription} onOpen={() => setSubscriptionOpen(true)}/>
              <Button className="h-12 w-full justify-start gap-3 rounded-xl border border-transparent text-white/55 transition-all hover:border-[#d9a52f]/20 hover:bg-[#d9a52f]/5 hover:text-white" onClick={signOut} variant="ghost">
                <LogOut className="size-4"/>{tr(" Log out ")}</Button>
            </div>
          </div>
        </aside>

        <section className="relative min-h-screen min-w-0 bg-[#070806] lg:col-start-2">
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 start-0 z-0 bg-[#070806] lg:start-[264px]">
            <div className="absolute inset-x-0 top-0 h-[460px] bg-[url('/brand/Rubans_dorés_sur_fond_noir.png')] bg-cover bg-top bg-no-repeat opacity-90 sm:h-[520px]"/>
            <div className="absolute inset-x-0 top-0 h-[620px] bg-gradient-to-b from-transparent via-[#070806]/75 to-[#070806] sm:h-[700px]"/>
          </div>
          <div className="relative z-10 min-h-screen">
          <TopNav activeItem={activeItem} userName={user.name ?? businessName} avatarUrl={user.avatar_url ?? null} onOpenMobileMenu={() => setIsMobileMenuOpen(true)} notifications={[]}/>
          <div aria-hidden="true" className="h-16 lg:hidden"/>

          {isMobileMenuOpen ? (<div className="fixed inset-0 z-[120] lg:hidden">
              <button aria-label={tr("Close mobile menu overlay")} className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setIsMobileMenuOpen(false)} type="button"/>
              <div className="absolute start-0 top-0 flex h-dvh w-[86%] max-w-[320px] flex-col overflow-hidden border-e border-[#d9a52f]/15 bg-[#090a08] shadow-2xl" style={{ backgroundImage: "linear-gradient(rgba(9,10,8,.88),rgba(9,10,8,.96)), url('/brand/Élégantes vagues dorées sur fond noir.png')", backgroundSize: "cover", backgroundPosition: "bottom", backgroundRepeat: "no-repeat" }}>
                <div className="flex h-20 shrink-0 items-center justify-between border-b border-[#d9a52f]/15 px-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Image alt={"LOYVANCE"} className="size-14 object-contain" height={48} priority src="/brand/icon.png" width={48}/>
                    <p className="truncate text-sm font-semibold">LOYVANCE</p>
                  </div>
                  <Button aria-label={tr("Close menu")} onClick={() => setIsMobileMenuOpen(false)} size="icon" variant="ghost">
                    <Menu className="size-5"/>
                  </Button>
                </div>
                <nav ref={mobileScroll.ref} onScroll={mobileScroll.onScroll} onClickCapture={mobileScroll.onClickCapture} className="loyvance-sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-5">
                  {visibleItems.map((item) => (<MobileDrawerItem active={item.key === activeItem} href={item.href} icon={item.icon} key={item.key} label={tr(item.label)} onNavigate={() => setIsMobileMenuOpen(false)}/>))}
                </nav>
                <div className="shrink-0 border-t border-[#d9a52f]/15 bg-[#090a08]/85 p-3 backdrop-blur-sm">
                  <BusinessSubscriptionCard {...subscription} onOpen={() => { setIsMobileMenuOpen(false); setSubscriptionOpen(true); }}/>
                  <Button className="h-12 w-full justify-start gap-3 rounded-xl border border-white/10 bg-black/20 text-white/75 hover:border-[#d9a52f]/25 hover:bg-[#d9a52f]/10 hover:text-white" onClick={() => {
                setIsMobileMenuOpen(false);
                signOut();
            }} variant="ghost">
                    <LogOut className="size-4"/>{tr(" Log out ")}</Button>
                </div>
              </div>
            </div>) : null}

          <BusinessSubscriptionModal data={subscription.data} name={businessName} open={subscriptionOpen} token={token ?? ""} onSaved={subscription.refresh} onClose={() => setSubscriptionOpen(false)}/>
          <BusinessSubscriptionAlert data={subscription.data} name={businessName} onOpen={() => setSubscriptionOpen(true)}/>
          <EchoProvider token={token ?? null}>
            <DashboardRealtimeContent><fieldset disabled={expired && activeItem !== "affiliate"} aria-label={expired && activeItem !== "affiliate" ? tr("Read-only business workspace") : tr("Business workspace")} className="min-w-0 border-0 p-0 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-40">{premiumKeys[activeItem] && premiumAccess[premiumKeys[activeItem]]!=="approved" ? <div className="mx-auto max-w-3xl space-y-4 p-8"><h1 className="text-2xl font-bold">{tr("Administrator approval required")}</h1><p className="text-sm text-white/60">{tr("This feature is locked until the platform administrator approves your request.")}</p><Link href="/dashboard/premium" className="inline-flex rounded-xl bg-[#e7b354] px-5 py-3 font-bold text-black">{tr("Request access")}</Link></div> : children}</fieldset></DashboardRealtimeContent>
          </EchoProvider>
          </div>
        </section>
      </div>
    </main>);
}
function SidebarItem({ active, href, icon: Icon, label, }: {
    active: boolean;
    href?: string;
    icon: React.ElementType;
    label: string;
}) {
    const { t: tr } = useI18n();
    const className = cn("h-12 w-full justify-start gap-3 rounded-xl border transition-all", active ? "border-[#f6bd46]/40 bg-gradient-to-r from-[#b27a14]/35 to-[#e4a62e]/15 text-[#ffc857] shadow-[0_0_24px_rgba(224,165,46,.10)]" : "border-transparent text-white/55 hover:border-[#d9a52f]/20 hover:bg-[#d9a52f]/5 hover:text-white");
    if (!href) {
        return (<Button className={className} disabled variant="ghost">
        <Icon className="size-4"/>
        {tr(label)}
      </Button>);
    }
    return (<Button asChild className={className} variant="ghost">
      <Link href={href}>
        <Icon className="size-4"/>
        {tr(label)}
      </Link>
    </Button>);
}
function MobileNavItem({ active, href, icon: Icon, label, }: {
    active: boolean;
    href?: string;
    icon: React.ElementType;
    label: string;
}) {
    const { t: tr } = useI18n();
    if (!href) {
        return (<Button className="shrink-0" disabled size="sm" variant="ghost">
        <Icon className="size-4"/>
        {tr(label)}
      </Button>);
    }
    return (<Button asChild className="shrink-0" size="sm" variant={active ? "secondary" : "ghost"}>
      <Link href={href}>
        <Icon className="size-4"/>
        {tr(label)}
      </Link>
    </Button>);
}
function MobileDrawerItem({ active, href, icon: Icon, label, onNavigate, }: {
    active: boolean;
    href?: string;
    icon: React.ElementType;
    label: string;
    onNavigate: () => void;
}) {
    const { t: tr } = useI18n();
    const className = cn("h-12 w-full justify-start gap-3 rounded-xl border transition-all", active ? "border-[#f6bd46]/40 bg-gradient-to-r from-[#b27a14]/35 to-[#e4a62e]/15 text-[#ffc857] shadow-[0_0_24px_rgba(224,165,46,.10)]" : "border-transparent text-white/55 hover:border-[#d9a52f]/20 hover:bg-[#d9a52f]/5 hover:text-white");
    if (!href) {
        return (<Button className={className} disabled variant="ghost">
        <Icon className="size-4"/>
        {tr(label)}
      </Button>);
    }
    return (<Button asChild className={className} variant="ghost">
      <Link href={href} onClick={onNavigate}>
        <Icon className="size-4"/>
        {tr(label)}
      </Link>
    </Button>);
}
function DashboardRealtimeContent({ children }: {
    children: React.ReactNode;
}) {
    const { t: tr } = useI18n();
    const { token } = useAuth();
    const { echo } = useEcho();
    const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
    const [isAffiliate, setIsAffiliate] = useState(false);
    useEffect(() => { let valid = true; apiFetch("/affiliate/me", {token,cache:"no-store"}).then(()=>{if(valid)setIsAffiliate(true);}).catch(()=>{if(valid)setIsAffiliate(false);});return()=>{valid=false;}; },[token]);
    const visibleItems = sidebarItems.filter(item => item.key !== "affiliate" || isAffiliate);
    useEffect(() => {
        if (!token)
            return;
        let cancelled = false;
        let timer: number | undefined;
        const refresh = async () => {
            try {
                const result = await getBusinessNotifications(token);
                if (!cancelled)
                    setNotifications(result.data ?? []);
            }
            catch { }
        };
        const poll = async () => {
            if (cancelled)
                return;
            if (document.visibilityState === "visible")
                await refresh();
            if (!cancelled)
                timer = window.setTimeout(poll, 1500);
        };
        void refresh();
        timer = window.setTimeout(poll, 1500);
        const channel = echo?.private("business");
        channel?.listen("data.changed", refresh);
        const onVisible = () => {
            if (document.visibilityState === "visible")
                void refresh();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            if (timer)
                window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
            channel?.stopListening("data.changed", refresh);
        };
    }, [token, echo]);
    return (<>
      <DashboardNotificationBridge notifications={notifications}/>
      {children}
    </>);
}
function DashboardNotificationBridge({ notifications }: {
    notifications: BusinessNotification[];
}) {
    useEffect(() => {
        window.dispatchEvent(new CustomEvent("loyvance:notifications", { detail: notifications }));
    }, [notifications]);
    return null;
}
function TopNav({ activeItem, userName, avatarUrl, onOpenMobileMenu, notifications, }: {
    activeItem: DashboardShellProps["activeItem"];
    userName: string;
    avatarUrl: string | null;
    onOpenMobileMenu: () => void;
    notifications: BusinessNotification[];
}) {
    const { t: tr } = useI18n();
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
        if (!notificationsOpen)
            return;
        const closeOnOutsidePress = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!notificationsRef.current?.contains(target))
                setNotificationsOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsidePress);
        return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
    }, [notificationsOpen]);
    const unreadNotifications = liveNotifications.filter((item) => !item.is_read);
    const refreshNotifications = async () => {
        if (!token)
            return;
        const result = await getBusinessNotifications(token);
        setLiveNotifications(result.data ?? []);
    };
    const markAllRead = async () => {
        if (!token || unreadNotifications.length === 0)
            return;
        try {
            await markAllBusinessNotificationsRead(token);
            await refreshNotifications();
        }
        catch {
            await refreshNotifications().catch(() => undefined);
        }
    };
    const markOneRead = async (item: BusinessNotification) => {
        if (!token || item.is_read)
            return;
        const key = `${item.type}-${item.id.replace(/:(ready|redeemed)$/, "")}`;
        try {
            await markBusinessNotificationRead(token, key);
            await refreshNotifications();
        }
        catch {
            await refreshNotifications().catch(() => undefined);
        }
    };
    const pageTitle: Record<DashboardShellProps["activeItem"], string> = {
        overview: "Dashboard",
        customers: "Customers",
        loyalty: "Loyalty Card",
        scanner: "QR Scanner",
        rewards: "Rewards",
        settings: "Settings",
        affiliate: "Affiliate",
        campaigns: "Campaigns",
        offers: "Special Offers",
        staff: "Staff Management",
        discover: "Discover Pro",
        app: "Install App",
        analytics: "Analytics Pro",
        feedback: "Feedback",
        birthdays: "Birthdays",
    };
    return (<header className="app-topbar fixed inset-x-0 top-0 z-30 border-b border-[#d9a52f]/15 bg-[#080907]/95 backdrop-blur-xl lg:sticky lg:inset-x-auto lg:z-20">
      <div className="flex h-16 items-center justify-between gap-2 px-3 sm:h-20 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label={tr("Open menu")} className="lg:hidden" onClick={onOpenMobileMenu} size="icon" type="button" variant="ghost">
            <Menu className="size-5"/>
          </Button>
          <h1 className="hidden text-xl font-bold tracking-tight lg:block">{pageTitle[activeItem]}</h1>
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Image alt={"LOYVANCE"} className="size-7 object-contain sm:size-8" height={32} priority src="/brand/icon.png" width={48}/>
            <p className="truncate text-sm font-semibold">LOYVANCE</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4"><LanguageSwitcher />
          <div ref={notificationsRef} className="relative">
            <Button aria-label={tr("Notifications")} onClick={() => setNotificationsOpen((open) => !open)} className="relative text-white/75 hover:bg-white/5 hover:text-white" size="icon" variant="ghost">
              <Bell className="size-5"/>
              {unreadNotifications.length > 0 ? <span className="absolute end-1.5 top-1.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-[#f3bd55] px-1 text-[9px] font-black text-black shadow-[0_0_8px_rgba(243,189,85,.8)]">{Math.min(unreadNotifications.length, 99)}</span> : null}
            </Button>
            {notificationsOpen ? <div className="fixed start-3 end-3 top-[72px] z-50 max-h-[calc(100dvh-84px)] overflow-hidden rounded-2xl border border-[#e7b354]/25 bg-[#090a08]/[.98] shadow-2xl backdrop-blur-xl sm:absolute sm:start-auto sm:end-0 sm:top-12 sm:w-[min(360px,calc(100vw-24px))] sm:max-h-none">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div className="min-w-0"><p className="font-bold text-white">{tr("Notifications")}</p><p className="text-xs text-white/45">{tr("Latest business activity")}</p></div>{unreadNotifications.length > 0 ? <button type="button" onClick={markAllRead} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#f3bd55] transition hover:bg-[#f3bd55]/10">{tr("Read all")}</button> : <span className="shrink-0 text-xs text-white/30">{tr("All read")}</span>}</div>
              <div className="max-h-[calc(100dvh-155px)] overscroll-contain overflow-y-auto p-2 sm:max-h-[420px]" onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>{liveNotifications.length ? liveNotifications.slice(0, 20).map((item) => <div key={item.type + "-" + item.id} onClick={() => void markOneRead(item)} className={`cursor-pointer rounded-xl px-3 py-3 hover:bg-white/[.04] ${item.is_read ? "opacity-55" : ""}`}><div className="flex items-start gap-3">{!item.is_read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-[#f3bd55]"/> : <span className="mt-1 size-2 shrink-0" aria-hidden="true"/>}<div className="min-w-0"><p className="text-sm font-semibold text-white">{tr(item.title)}</p><p className="mt-0.5 text-xs leading-5 text-white/55">{tr(item.message)}</p><p className="mt-1 whitespace-nowrap text-[10px] text-white/35">{new Date(item.created_at).toLocaleString(getFormattingLocale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div></div></div>) : <p className="px-3 py-8 text-center text-sm text-white/40">{tr("No notifications yet.")}</p>}</div>
            </div> : null}
          </div>
          <div className="h-8 w-px bg-white/10"/>
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e7b354]/25 bg-[#5b451b] font-bold text-white shadow-[0_0_14px_rgba(231,179,84,.10)]">{avatarUrl ? <img alt={userName} src={avatarUrl} className="h-full w-full object-cover object-center"/> : initial}</div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-44 truncate text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-white/40">{tr("Business Owner")}</p>
            </div>
          </div>
        </div>
      </div>
    </header>);
}
