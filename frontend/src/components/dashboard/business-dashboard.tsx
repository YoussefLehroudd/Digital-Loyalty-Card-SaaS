"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, Coins, CreditCard, Crown, Gift, Pencil, QrCode, Settings, Store, UserPlus, Users, Zap } from "lucide-react";
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
  const [period, setPeriod] = useState("current_month");

  async function loadDashboard() {
    setIsLoading(true); setError(null);
    try {
      const [dashboard, card] = await Promise.all([
        getDashboardOverview(token, period),
        getLoyaltyCard(token).catch(() => null),
      ]);
      setOverview(dashboard);
      setLoyaltyCard(card?.loyalty_card ?? null);
    } catch { setError("Dashboard metrics could not be loaded."); }
    finally { setIsLoading(false); }
  }

  async function loadDashboardSilent() {
    try { setOverview(await getDashboardOverview(token, period)); } catch {}
  }

  useEffect(() => { void loadDashboard(); }, [token, period]);

  useEffect(() => {
    if (!echo.echo) return;
    const businessId = user?.business?.id ?? user?.business_id ?? null;
    if (!businessId) return;
    const channel = echo.echo.private(`business.${businessId}`);
    ["StampAdded","RewardRedeemed","MembershipCreated","MembershipDeleted","BusinessBrandUpdated","BusinessCardUpdated"].forEach((event) => channel.listen(event, () => void loadDashboardSilent()));
    return () => { try { ["StampAdded","RewardRedeemed","MembershipCreated","MembershipDeleted","BusinessBrandUpdated","BusinessCardUpdated"].forEach((event) => channel.stopListening(event)); } catch {} };
  }, [echo.echo, user?.business?.id, user?.business_id, token, period]);

  const metrics = overview?.metrics;
  const businessName = overview?.business.name ?? user.business?.name ?? "Business";

  return (
    <DashboardShell activeItem="overview">
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative px-1 py-2">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="flex items-center gap-3 text-[13px] font-medium text-white/75"><Crown className="size-5 text-[#f6bd46]"/>Welcome back,</p>
              <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-.025em] text-white sm:text-[34px]">Your business is growing! <span className="text-[26px]">🚀</span></h1>
              <p className="mt-1.5 text-[14px] text-white/55">Here’s an overview of your loyalty program performance.</p>
            </div>
            <DateRangePicker value={period} onChange={setPeriod} />
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
            <div className="space-y-5"><QuickActions/><BusinessInfo name={businessName} logoUrl={overview?.business.logo_url ?? user.business?.logo_url ?? null}/></div>
          </div>
        </> : null}
      </div>
    </DashboardShell>
  );
}

function MetricGrid({metrics}:{metrics:DashboardMetrics}) {
  const cards=useMemo(()=>[
    ["Total Customers",metrics.total_customers,metrics.growth.total_customers,Users],
    ["Active Members",metrics.active_customers,metrics.growth.active_customers,Crown],
    ["Stamps Issued",metrics.visits_this_month,metrics.growth.visits_this_month,Coins],
    ["Rewards Redeemed",metrics.rewards_redeemed,metrics.growth.rewards_redeemed,Gift],
  ] as const,[metrics]);
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,growth,Icon])=><div key={label} className="relative min-h-[132px] overflow-hidden rounded-[16px] border border-[#c88b20]/35 bg-black/25 px-4 py-4 backdrop-blur-[2px]"><div className="relative flex h-full items-center gap-4"><div className="flex size-[64px] shrink-0 items-center justify-center rounded-[16px] border border-[#d59a2c]/25 bg-[#8a5c13]/20 text-[#ffc64d]"><Icon className="size-8 stroke-[2.1]"/></div><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-white/70">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="text-[32px] font-black leading-none tracking-[-.025em] text-white">{formatter.format(value)}</p><div className="pb-0.5 text-right"><p className={cn("flex items-center justify-end gap-1 text-[13px] font-bold",growth>=0?"text-[#45df71]":"text-red-400")}><ArrowUpRight className={cn("size-4 stroke-[2.5]",growth<0&&"rotate-90")}/>{growth>0?"+":""}{growth}%</p><p className="mt-1 whitespace-nowrap text-[10px] text-white/38">vs last month</p></div></div></div></div></div>)}</div>
}

function DateRangePicker({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [open,setOpen]=useState(false);
  const ranges=[
    {key:"current_month",label:"Sep 1, 2026 - Sep 30, 2026"},
    {key:"previous_month",label:"Aug 1, 2026 - Aug 31, 2026"},
    {key:"last_30_days",label:"Last 30 days"},
  ];
  const label=ranges.find(item=>item.key===value)?.label??ranges[0].label;
  return <div className="relative"><button type="button" onClick={()=>setOpen(v=>!v)} className="flex h-12 min-w-[244px] items-center gap-3 rounded-xl border border-white/15 bg-[#0d0e0d]/90 px-4 text-[13px] text-white/85 shadow-[0_8px_28px_rgba(0,0,0,.25)] transition hover:border-[#e7b354]/35"><CalendarDays className="size-5 text-white/65"/><span className="flex-1 text-left">{label}</span><ChevronDown className={cn("size-4 text-white/45 transition-transform",open&&"rotate-180")}/></button>{open?<div className="absolute right-0 top-[54px] z-30 w-[270px] rounded-xl border border-[#e7b354]/20 bg-[#0c0d0b] p-2 shadow-2xl">{ranges.map(item=><button type="button" key={item.key} onClick={()=>{onChange(item.key);setOpen(false)}} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-white/75 hover:bg-[#e7b354]/10 hover:text-white"><span>{item.label}</span>{value===item.key?<Check className="size-4 text-[#f3bd55]"/>:null}</button>)}</div>:null}</div>
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
function BusinessInfo({name,logoUrl}:{name:string;logoUrl:string|null}){return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl border border-[#d69b2d]/20 bg-[#8b5d12]/20 text-[#ffc857]"><Store className="size-6"/></div><div><h2 className="text-base font-bold text-white">Business Info</h2><p className="mt-0.5 text-xs text-white/45">Manage your business details.</p></div></div><Button asChild size="sm" variant="outline" className="h-10 border-[#e7b354]/55 bg-transparent px-4 font-semibold text-[#ffc857] hover:bg-[#e7b354]/10 hover:text-[#ffd36a]"><Link href="/dashboard/settings"><Settings className="size-4"/>View / Edit</Link></Button></div><div className="mt-4 flex items-center gap-4 border-t border-white/[.06] pt-4"><div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e7b354]/25 bg-black/40">{logoUrl?<img src={logoUrl} alt={name} className="h-full w-full object-contain p-1"/>:<Store className="size-7 text-[#ffc857]"/>}</div><div><p className="text-base font-semibold text-white">{name}</p><p className="mt-0.5 text-xs text-white/45">Business Account</p></div></div></section>}

function DashboardSkeleton(){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-2xl bg-white/5"/>)}</div>}
