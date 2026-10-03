"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CreditCard, Gift, Pencil, QrCode, RefreshCw, ScanLine, Sparkles, Store, UserPlus, Users, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview, getLoyaltyCard, type DashboardMetrics, type DashboardOverview, type LoyaltyCard } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useEcho } from "@/components/echo/echo-provider";

const formatter = new Intl.NumberFormat("en");

export function BusinessDashboard() {
  const { token, user } = useAuth();
  const echo = useEcho();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true); setError(null);
    try {
      const [dashboard, card] = await Promise.all([
        getDashboardOverview(token),
        getLoyaltyCard(token).catch(() => null),
      ]);
      setOverview(dashboard);
      setLoyaltyCard(card?.loyalty_card ?? null);
    } catch { setError("Dashboard metrics could not be loaded."); }
    finally { setIsLoading(false); }
  }

  async function loadDashboardSilent() {
    try { setOverview(await getDashboardOverview(token)); } catch {}
  }

  useEffect(() => { void loadDashboard(); }, [token]);

  useEffect(() => {
    if (!echo.echo) return;
    const businessId = user?.business?.id ?? user?.business_id ?? null;
    if (!businessId) return;
    const channel = echo.echo.private(`business.${businessId}`);
    ["StampAdded","RewardRedeemed","MembershipCreated","MembershipDeleted","BusinessBrandUpdated","BusinessCardUpdated"].forEach((event) => channel.listen(event, () => void loadDashboardSilent()));
    return () => { try { ["StampAdded","RewardRedeemed","MembershipCreated","MembershipDeleted","BusinessBrandUpdated","BusinessCardUpdated"].forEach((event) => channel.stopListening(event)); } catch {} };
  }, [echo.echo, user?.business?.id, user?.business_id, token]);

  const metrics = overview?.metrics;
  const businessName = overview?.business.name ?? user.business?.name ?? "Business";

  return (
    <DashboardShell activeItem="overview">
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl border border-[#e7b354]/15 bg-[radial-gradient(circle_at_85%_0%,rgba(190,122,12,.28),transparent_32%),linear-gradient(120deg,#11110d,#080907)] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,.28)]">
          <div className="absolute -right-16 -top-20 size-72 rounded-full bg-[#d99c28]/10 blur-3xl"/>
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div><p className="flex items-center gap-2 text-sm text-[#e7b354]"><Sparkles className="size-4"/> Welcome back,</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Your business is growing! <span className="text-[#f4bd4d]">↗</span></h1><p className="mt-2 text-sm text-white/55">Here’s an overview of {businessName} loyalty program performance.</p></div>
            <div className="flex items-center gap-3"><div className="flex h-11 items-center gap-2 rounded-xl border border-[#e7b354]/15 bg-black/35 px-4 text-sm text-white/65"><CalendarDays className="size-4 text-[#e7b354]"/> Live overview</div><Button disabled={isLoading} onClick={loadDashboard} variant="outline" className="h-11 border-[#e7b354]/20 bg-black/30 hover:bg-[#e7b354]/10"><RefreshCw className={cn("size-4 text-[#e7b354]",isLoading&&"animate-spin")}/>Refresh</Button></div>
          </div>
        </section>

        {error ? <Alert className="border-red-500/30 text-red-500">{error}</Alert> : null}
        {isLoading ? <DashboardSkeleton/> : null}
        {!isLoading && metrics ? <>
          <MetricGrid metrics={metrics}/>
          <div className="grid gap-5 xl:grid-cols-[1.7fr_.95fr]">
            <ActivityPanel metrics={metrics}/>
            <LoyaltyPreview businessName={businessName} card={loyaltyCard}/>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.7fr_.95fr]">
            <PerformancePanel metrics={metrics}/>
            <div className="space-y-5"><QuickActions/><BusinessInfo name={businessName}/></div>
          </div>
        </> : null}
      </div>
    </DashboardShell>
  );
}

function MetricGrid({metrics}:{metrics:DashboardMetrics}) {
  const cards=useMemo(()=>[
    ["Total Customers",metrics.total_customers,"Registered profiles",Users],
    ["Active Members",metrics.active_customers,"Active in last 30 days",BarChart3],
    ["Stamps Issued",metrics.visits_this_month,"Recorded this month",ScanLine],
    ["Rewards Redeemed",metrics.rewards_redeemed,"Completed claims",Gift],
  ] as const,[metrics]);
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,detail,Icon])=><div key={label} className="rounded-2xl border border-[#e7b354]/20 bg-[linear-gradient(145deg,#12130f,#090a08)] p-5 shadow-[0_15px_45px_rgba(0,0,0,.25)]"><div className="flex items-start justify-between"><div><p className="text-sm text-white/60">{label}</p><p className="mt-2 text-4xl font-black tracking-tight">{formatter.format(value)}</p></div><div className="flex size-12 items-center justify-center rounded-xl border border-[#e7b354]/15 bg-[#e7b354]/10 text-[#ffc857] shadow-[0_0_20px_rgba(231,179,84,.08)]"><Icon className="size-6"/></div></div><p className="mt-3 text-xs text-white/40">{detail}</p></div>)}</div>
}

function ActivityPanel({metrics}:{metrics:DashboardMetrics}) {
  const bars=[32,38,29,46,58,43,35,52,68,57,48,63,76,60,51,69,82,73,64,79,92,70,62,80,96,88,75,91,84,100];
  return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Customer Activity</h2><p className="mt-1 text-xs text-white/40">A visual pulse of your loyalty activity this month.</p></div><div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">Last 30 days</div></div><div className="mt-8 flex h-52 items-end gap-[2.2%] border-b border-white/10 px-2">{bars.map((h,i)=><div key={i} className="group relative flex-1 rounded-t bg-gradient-to-t from-[#81530b]/60 to-[#f3bd55]" style={{height:`${Math.max(8,h*(.55+(metrics.visits_this_month>0?.35:0)))}%`}}><span className="absolute inset-x-0 top-0 h-px bg-[#ffe29b] shadow-[0_0_10px_#f3bd55]"/></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-white/30"><span>Sep 1</span><span>Sep 10</span><span>Sep 20</span><span>Sep 30</span></div></section>
}

function LoyaltyPreview({businessName,card}:{businessName:string;card:LoyaltyCard|null}) {
  const required=card?.required_stamps??5;
  return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Your Loyalty Card</h2><p className="mt-1 text-xs text-white/40">This is how your card looks to customers.</p></div><Button asChild size="sm" variant="outline" className="border-[#e7b354]/40 text-[#ffc857]"><Link href="/dashboard/loyalty-card"><Pencil className="size-3"/>Edit Card</Link></Button></div><div className="relative mt-6 overflow-hidden rounded-2xl border border-[#e7b354]/55 bg-[radial-gradient(circle_at_100%_100%,rgba(213,145,25,.28),transparent_36%),linear-gradient(135deg,#171309,#080907)] p-5 shadow-[0_0_28px_rgba(231,179,84,.12)]"><div className="flex items-center justify-between"><div><p className="text-lg font-black text-[#f5c85f]">{businessName}</p><p className="text-xs text-white/45">Digital Loyalty Card</p></div><QrCode className="size-16 rounded-lg bg-white p-2 text-black"/></div><div className="mt-6 flex gap-2">{Array.from({length:Math.min(required,7)}).map((_,i)=><span key={i} className={cn("flex size-9 items-center justify-center rounded-full border",i<Math.min(3,required)?"border-[#ffd36a] bg-[#f3bd55] text-black":"border-white/25 bg-black/30 text-white/20")}>{i<3?"✓":""}</span>)}</div><p className="mt-4 text-xs text-white/65">{card?.reward_name??"Collect stamps & get a reward!"}</p></div></section>
}

function PerformancePanel({metrics}:{metrics:DashboardMetrics}) {
 const share=metrics.total_customers?Math.min(100,Math.round(metrics.active_customers/metrics.total_customers*100)):0;
 return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Performance Snapshot</h2><p className="mt-1 text-xs text-white/40">Customer engagement for this business.</p></div><BarChart3 className="size-5 text-[#ffc857]"/></div><div className="mt-6"><div className="flex justify-between text-sm"><span className="text-white/55">Active customer share</span><b>{share}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#a76c12] to-[#ffd36a]" style={{width:`${share}%`}}/></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Mini label="Customer base" value={metrics.total_customers}/><Mini label="Monthly visits" value={metrics.visits_this_month}/><Mini label="Rewards claimed" value={metrics.rewards_redeemed}/></div></section>
}
function Mini({label,value}:{label:string;value:number}){return <div className="rounded-xl border border-[#e7b354]/12 bg-black/25 p-4"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-xl font-bold">{formatter.format(value)}</p></div>}

function QuickActions(){return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-center gap-2"><Zap className="size-5 text-[#ffc857]"/><div><h2 className="font-bold">Quick Actions</h2><p className="text-xs text-white/40">Perform common tasks quickly.</p></div></div><div className="mt-4 grid grid-cols-3 gap-2"><Action href="/dashboard/customers" icon={UserPlus} label="Customers"/><Action href="/dashboard/scanner" icon={QrCode} label="Scan QR"/><Action href="/dashboard/loyalty-card" icon={CreditCard} label="Edit Card"/></div></section>}
function Action({href,icon:Icon,label}:{href:string;icon:React.ElementType;label:string}){return <Link href={href} className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-[#e7b354]/12 bg-[#e7b354]/[.035] text-center text-xs font-semibold transition hover:border-[#e7b354]/35 hover:bg-[#e7b354]/10"><Icon className="mb-2 size-6 text-[#ffc857]"/>{label}</Link>}
function BusinessInfo({name}:{name:string}){return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-[#e7b354]/10 text-[#ffc857]"><Store className="size-5"/></div><div><h2 className="font-bold">Business Info</h2><p className="text-xs text-white/40">{name} · Business account</p></div></div></section>}

function DashboardSkeleton(){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-2xl bg-white/5"/>)}</div>}
