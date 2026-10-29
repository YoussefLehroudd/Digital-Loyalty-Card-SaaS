"use client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import {ThemeToggle} from "@/components/theme-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, ArchiveRestore, ArrowUpRight, Building2, Handshake, LayoutDashboard, LogOut, Download, Settings2, ShieldCheck, Users, ChartNoAxesCombined } from "lucide-react";
import { adminRequest, clearAdminToken, getAdminToken, type AdminUser } from "@/lib/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {usePersistentNavScroll} from "@/components/navigation/use-persistent-nav-scroll";
type LiveStatus = "connecting" | "live" | "retrying";
type AdminContextValue = {
    token: string;
    user: AdminUser;
    liveStatus: LiveStatus;
    setLiveStatus: (status: LiveStatus) => void;
    logout: () => Promise<void>;
};
const AdminContext = createContext<AdminContextValue | null>(null);
export const adminNavigation = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/businesses", label: "Businesses", icon: Building2 },
    { href: "/admin/premium", label: "Feature Approvals", icon: ShieldCheck },
    { href: "/admin/affiliates", label: "Affiliates", icon: Handshake },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/activity", label: "Activity", icon: Activity },
    { href: "/admin/visitors", label: "Visitors", icon: ChartNoAxesCombined },
    { href: "/admin/archived", label: "Archived", icon: ArchiveRestore },
    { href: "/admin/settings", label: "Settings", icon: Settings2 },
    { href: "/admin/app", label: "Install Admin App", icon: Download },
];
export function useAdmin() {
    const context = useContext(AdminContext);
    if (!context)
        throw new Error("Admin context is required.");
    return context;
}
export function AdminSkeleton() {
    const { t: tr } = useI18n();
    return <div role="status" aria-label={tr("Loading administration")} className="space-y-6 p-5 sm:p-8"><Skeleton className="h-10 w-64"/><Skeleton className="h-5 w-80 max-w-full"/><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl"/>)}</div><Skeleton className="h-80 rounded-3xl"/></div>;
}
function AdminWorkspace({ children }: {
    children: ReactNode;
}) {
    const { t: tr } = useI18n();
    const router = useRouter(), pathname = usePathname();
    const [session, setSession] = useState<{
        token: string;
        user: AdminUser;
    } | null>(null);
    const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
    const [authError, setAuthError] = useState("");
    const sidebarScroll=usePersistentNavScroll("admin:"+(session?.user.id??"none")+":desktop",pathname);
    const mobileTabsScroll=usePersistentNavScroll("admin:"+(session?.user.id??"none")+":mobile",pathname,"x");
    useEffect(() => {
        const controller = new AbortController();
        const token = getAdminToken();
        if (!token) {
            router.replace("/admin/login");
            return;
        }
        adminRequest<{
            user: AdminUser;
        }>("me", token, { signal: controller.signal }).then(res => setSession({ token, user: res.user })).catch(error => {
            if (controller.signal.aborted)
                return;
            if (error instanceof ApiError && [401, 403].includes(error.status)) {
                clearAdminToken();
                router.replace("/admin/login");
            }
            else
                setAuthError("We could not connect. Please try again.");
        });
        return () => controller.abort();
    }, [router]);
    const logout = useCallback(async () => {
        try {
            if (session)
                await adminRequest("logout", session.token, { method: "POST" });
        }
        finally {
            clearAdminToken();
            setSession(null);
            router.replace("/admin/login");
        }
    }, [router, session]);
    if (!session)
        return <main className="min-h-screen bg-[#090b0e] text-white">{authError ? <div role="alert" className="mx-auto max-w-md p-8 text-center"><p>{tr(authError)}</p><button onClick={() => location.reload()} className="mt-4 rounded-xl bg-[#edbc62] px-5 py-3 font-semibold text-black">{tr("Try again")}</button></div> : <AdminSkeleton />}</main>;
    const title = adminNavigation.find(item => item.href === pathname)?.label || "Overview";
    return <AdminContext.Provider value={{ ...session, liveStatus, setLiveStatus, logout }}>
    <div className="admin-workspace min-h-dvh bg-[#090b0e] text-[#f3f4f6] selection:bg-[#edbc62]/30">
      <aside ref={sidebarScroll.ref} onScroll={sidebarScroll.onScroll} onClickCapture={sidebarScroll.onClickCapture} className="admin-sidebar loyvance-sidebar-scroll fixed inset-y-0 start-0 z-40 hidden w-64 flex-col overflow-y-auto overscroll-contain border-e border-white/[.07] bg-[#0d1015] p-5 lg:flex">
        <Link href="/admin" aria-label={tr("LOYVANCE administrator home")} className="flex items-center gap-3 rounded-2xl p-2"><span className="grid size-12 place-items-center rounded-2xl border border-[#edbc62]/25 bg-[#edbc62]/10"><img src="/brand/icon.png" alt="" className="size-10 object-contain"/></span><span><span className="block text-lg font-black tracking-[.13em]">LOYVANCE</span><span className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#edbc62]">{tr("Admin workspace")}</span></span></Link>
        <p className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/30">{tr("Platform management")}</p>
        <nav aria-label={tr("Administration")} className="space-y-2 pb-4">{adminNavigation.map(item => { const active = pathname === item.href; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? "border border-[#edbc62]/20 bg-[#edbc62]/10 text-[#f4cb80]" : "border border-transparent text-white/55 hover:bg-white/[.04] hover:text-white"}`}><item.icon className="size-[18px]"/>{tr(item.label)}{active ? <span className="ms-auto size-1.5 rounded-full bg-[#edbc62]"/> : null}</Link>; })}</nav>
        <div className="mt-auto space-y-4"><div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><ShieldCheck className="mb-2 size-5 text-[#edbc62]"/><p className="text-sm font-semibold">{tr("Your platform, in focus.")}</p><p className="mt-1 text-xs leading-5 text-white/40">{tr("One workspace for every business and customer.")}</p></div><button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-white/50 hover:bg-white/[.04] hover:text-white"><LogOut className="size-4"/>{tr("Sign out")}</button></div>
      </aside>
      <div className="lg:ps-64">
        <header className="app-topbar sticky top-0 z-30 border-b border-white/[.07] bg-[#090b0e]/95 px-3 py-2.5 backdrop-blur-xl sm:px-6 lg:flex lg:h-[76px] lg:items-center lg:px-8 lg:py-0">
          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 lg:flex lg:justify-between">
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5">
              <img src="/brand/icon.png" alt="LOYVANCE" className="size-9 shrink-0 object-contain lg:hidden"/>
              <div className="min-w-0 lg:hidden">
                <h1 title={tr(title)} className="truncate text-sm font-semibold leading-5 text-white min-[380px]:text-base">{tr(title)}</h1>
                <p className="truncate text-[10px] leading-4 text-white/40">{tr("Administration")}</p>
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="text-[10px] uppercase tracking-[.2em] text-white/35">{tr("Administration")}</p>
                <p className="mt-1 truncate text-sm font-semibold">{tr(title)}</p>
              </div>
            </div>
            <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-1.5 sm:gap-3">
              <ThemeToggle/><LanguageSwitcher/>
              <span role="status" className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium lg:flex ${liveStatus === 'live' ? "border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300" : "border-amber-400/20 bg-amber-400/5 text-amber-200"}`}>
                <span className={`size-1.5 rounded-full ${liveStatus === 'live' ? "bg-emerald-400" : "bg-amber-300"}`}/>{liveStatus === 'live' ? tr("Live") : liveStatus === 'retrying' ? tr("Reconnecting") : tr("Connecting")}
              </span>
              <div className="hidden text-end lg:block"><p className="text-xs font-semibold">{session.user.name}</p><p className="text-[10px] text-white/40">{tr("Super administrator")}</p></div>
              <Link href="/admin/settings" aria-label={tr("Administrator settings")} className="hidden size-9 shrink-0 place-items-center rounded-full border border-[#edbc62]/25 bg-[#edbc62]/10 text-xs font-bold text-[#edbc62] sm:grid">{session.user.name.slice(0, 2).toUpperCase()}</Link>
              <button type="button" onClick={() => void logout()} aria-label={tr("Log out")} title={tr("Log out")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.025] text-white/70 transition hover:border-[#edbc62]/25 hover:bg-[#edbc62]/10 hover:text-[#f4cb80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62] lg:hidden"><LogOut className="size-4" aria-hidden="true"/></button>
            </div>
          </div>
        </header>
        <main className="admin-content admin-light-content mx-auto min-w-0 max-w-[1500px] px-3 pb-28 pt-6 sm:px-4 sm:px-8 sm:pt-8 lg:pb-10">{children}</main>
      </div>
      <nav aria-label={tr("Mobile administration")} ref={mobileTabsScroll.ref} onScroll={mobileTabsScroll.onScroll} onClickCapture={mobileTabsScroll.onClickCapture} tabIndex={0} className="admin-mobile-nav customer-bottom-nav-scroll fixed inset-x-0 bottom-0 z-40 flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain border-t border-white/10 bg-[#0d1015] px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">{adminNavigation.map(item => { const active = pathname === item.href; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-w-[76px] w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-[10px] font-semibold ${active ? "text-[#edbc62]" : "text-white/45"}`}><item.icon className="size-5"/><span className="max-w-full truncate px-0.5">{tr(item.label)}</span></Link>; })}</nav>
    </div>
  </AdminContext.Provider>;
}
export function AdminShell({ children }: {
    children: ReactNode;
}) {
    const { t: tr } = useI18n();
    const pathname = usePathname();
    return pathname === "/admin/login" ? <>{children}</> : <AdminWorkspace>{children}</AdminWorkspace>;
}
export function useAdminLive<T>(path: string | null) {
    const { token, setLiveStatus } = useAdmin();
    const router = useRouter();
    const [data, setData] = useState<T | null>(null), [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const refresh = useCallback(() => setRevision(n => n + 1), []);
    useEffect(() => {
        setData(null);
        setError("");
        if (!path)
            return;
        let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, active: AbortController | null = null, failures = 0;
        async function fetchData() {
            if (stopped || active)
                return;
            const controller = new AbortController();
            active = controller;
            try {
                const result = await adminRequest<T>(path!, token, { signal: controller.signal });
                if (stopped)
                    return;
                setData(result);
                setError("");
                setLiveStatus("live");
                failures = 0;
            }
            catch (cause) {
                if (stopped || controller.signal.aborted)
                    return;
                if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
                    clearAdminToken();
                    router.replace("/admin/login");
                    return;
                }
                setError("Live updates are unavailable. Retrying automatically.");
                setLiveStatus("retrying");
                failures++;
            }
            finally {
                active = null;
                if (!stopped)
                    timer = setTimeout(fetchData, document.hidden ? 30000 : Math.min(30000, 3000 * 2 ** Math.min(failures, 3)));
            }
        }
        const wake = () => { if (!document.hidden) {
            clearTimeout(timer);
            void fetchData();
        } };
        void fetchData();
        document.addEventListener("visibilitychange", wake);
        window.addEventListener("focus", wake);
        return () => { stopped = true; clearTimeout(timer); active?.abort(); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
    }, [path, token, revision, router, setLiveStatus]);
    return { data, error, refresh };
}
