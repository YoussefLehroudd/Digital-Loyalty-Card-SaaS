"use client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartSpline, CreditCard, Home, LogOut, Mail, Trophy, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { cn } from "@/lib/utils";
import { CustomerNotificationBell } from "@/components/customer-app/customer-notification-bell";
const nav = [
    { href: "/user/dashboard", label: "Home", icon: Home },
    { href: "/user/cards", label: "Cards", icon: CreditCard },
    { href: "/user/rewards", label: "Rewards", icon: Trophy },
    { href: "/user/activity", label: "Activity", icon: ChartSpline },
    { href: "/user/profile", label: "Profile", icon: User },
];
export function CustomerLayout({ children, title, subtitle, }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
}) {
    const { t: tr } = useI18n();
    const pathname = usePathname();
    const { user, logout } = useCustomerAuth();
    return (<div className="relative min-h-dvh overflow-x-clip bg-[#080907] bg-fixed bg-center bg-no-repeat text-foreground lg:flex" style={{
            backgroundImage: "url('/brand/%C3%89l%C3%A9gance%20noire%20aux%20rubans%20dor%C3%A9s.png')",
            backgroundSize: "100% 100%",
        }}>
      <aside className="hidden lg:fixed lg:inset-y-0 lg:start-0 lg:z-40 lg:flex lg:w-[280px] lg:flex-col lg:border-e lg:border-[#d8a63f]/15 lg:bg-[linear-gradient(180deg,rgba(16,17,14,.98),rgba(8,9,7,.98))] lg:backdrop-blur-xl">
        <div className="px-5 pb-2 pt-6">
          <Link href="/user/dashboard" aria-label={tr("LOYVANCE home")} className="group flex items-center gap-3 rounded-2xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#e7b354]/20 bg-[linear-gradient(145deg,rgba(231,179,84,.12),rgba(231,179,84,.025))] shadow-[0_8px_24px_rgba(0,0,0,.2)] transition group-hover:border-[#e7b354]/40">
              <img src="/brand/icon.png" alt="" width={40} height={40} className="size-10 object-contain"/>
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold tracking-tight text-white">LOYVANCE</span>
              <span className="mt-0.5 block text-[10px] font-medium tracking-[.16em] text-[#e7b354]/65">{tr("LOYALTY WALLET")}</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1.5 p-4 pt-5">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (<Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all", active ? "border-[#e7b354]/25 bg-[#d79b16]/12 text-[#ffc857] shadow-[0_8px_24px_rgba(215,155,22,.08)]" : "border-transparent text-muted-foreground hover:border-white/5 hover:bg-white/[.035] hover:text-white")}>
                <Icon className="h-5 w-5"/><span>{tr(item.label)}</span>
              </Link>);
        })}
        </nav>
        <div className="border-t border-[#d8a63f]/10 p-4">
          {user ? <AccountIdentity email={user.email} className="mb-3"/> : null}
          <Button variant="outline" className="w-full justify-start gap-2 border-[#d8a63f]/15 bg-black/20 hover:bg-white/5" onClick={logout}>
            <LogOut className="h-4 w-4"/>{tr(" Logout ")}</Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ms-[280px]">
        <header className="app-topbar sticky top-0 z-30 border-b border-[#d8a63f]/10 bg-[#080907]/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3 lg:max-w-[1440px] lg:px-8 lg:py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link href="/user/dashboard" aria-label={tr("LOYVANCE home")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e7b354]/20 bg-[#e7b354]/5 outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55] lg:hidden">
                <img src="/brand/icon.png" alt="" width={32} height={32} className="size-8 object-contain"/>
              </Link>
              <div className="min-w-0 lg:flex lg:items-center lg:gap-3">
                <p className="text-[9px] font-semibold tracking-[.15em] text-[#e7b354]/70 lg:hidden">LOYVANCE</p>
              <h1 className="text-base font-bold text-white lg:shrink-0 lg:text-xl lg:tracking-tight">{tr(title)}</h1>
              {subtitle ? (<>
                  <span aria-hidden="true" className="hidden text-[#d8a63f]/40 lg:block">|</span>
                  <p className="text-xs text-muted-foreground lg:truncate lg:text-sm">{tr(subtitle)}</p>
                </>) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 ps-3">
              <LanguageSwitcher /><CustomerNotificationBell />
              <Button variant="outline" size="sm" onClick={logout} className="lg:hidden">{tr("Logout")}</Button>
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
            return (<Link key={item.href} href={item.href} className={cn("flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] transition-colors", active ? "bg-[#d79b16]/12 text-[#ffc857]" : "text-muted-foreground")}>
                  <Icon className="h-4 w-4"/><span>{tr(item.label)}</span>
                </Link>);
        })}
          </div>
        </nav>

        {user ? (<footer className="mx-auto w-full max-w-md px-4 pb-28 lg:hidden">
            <AccountIdentity email={user.email}/>
          </footer>) : null}
      </div>
    </div>);
}
function AccountIdentity({ email, className }: {
    email: string;
    className?: string;
}) {
    const { t: tr } = useI18n();
    return (<Link href="/user/profile" className={cn("flex min-w-0 items-center gap-3 rounded-2xl border border-[#e7b354]/15 bg-[linear-gradient(135deg,rgba(231,179,84,.07),rgba(255,255,255,.015))] p-3 text-start transition hover:border-[#e7b354]/30 hover:bg-[#e7b354]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e7b354]/10 text-[#f3bd55]"><Mail aria-hidden="true" className="size-4"/></span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium tracking-wide text-white/40">{tr("Your account")}</span>
        <span title={email} className="mt-0.5 block truncate text-xs font-medium text-white/80">{email}</span>
      </span>
    </Link>);
}
