"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, Coins, CreditCard, Crown, Gift, Pencil, QrCode, Settings, Store, UserPlus, Users, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview, getLoyaltyCard, type DashboardMetrics, type DashboardOverview, type LoyaltyCard } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useEcho } from "@/components/echo/echo-provider";
import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";

const formatter = new Intl.NumberFormat("en");
type DashboardPeriod = "current_month" | "previous_month" | "last_30_days";

export function BusinessDashboard() {
  const { token, user } = useAuth();
  const echo = useEcho();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("current_month");

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
          <div className="space-y-5">
            <ActivityPanel activity={overview?.activity ?? []} period={period} setPeriod={setPeriod}/>
            <RecentCustomers customers={overview?.recent_customers ?? []}/>
            <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
              <QuickActions/>
              <BusinessInfo name={businessName} logoUrl={overview?.business.logo_url ?? user.business?.logo_url ?? null} createdAt={overview?.business.created_at ?? user.business?.created_at ?? null}/>
            </div>
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
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,growth,Icon])=><div key={label} className="relative min-h-[112px] overflow-hidden rounded-[16px] border border-[#c88b20]/35 bg-[linear-gradient(135deg,rgba(13,14,11,.88),rgba(8,9,7,.78))] px-4 py-3 backdrop-blur-md shadow-[0_10px_35px_rgba(0,0,0,.18)]"><div className="relative flex h-full items-center gap-4"><div className="flex size-[56px] shrink-0 items-center justify-center rounded-[16px] border border-[#d59a2c]/25 bg-[#8a5c13]/20 text-[#ffc64d]"><Icon className="size-7 stroke-[2.1]"/></div><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-white/70">{label}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="text-[32px] font-black leading-none tracking-[-.025em] text-white">{formatter.format(value)}</p><div className="pb-0.5 text-right"><p className={cn("flex items-center justify-end gap-1 text-[13px] font-bold",growth>=0?"text-[#45df71]":"text-red-400")}><ArrowUpRight className={cn("size-4 stroke-[2.5]",growth<0&&"rotate-90")}/>{growth>0?"+":""}{growth}%</p><p className="mt-1 whitespace-nowrap text-[10px] text-white/38">vs last month</p></div></div></div></div></div>)}</div>
}

function DateRangePicker({value,onChange}:{value:DashboardPeriod;onChange:(value:DashboardPeriod)=>void}) {
  const [open,setOpen]=useState(false);
  const ranges=[
    {key:"current_month",label:"Sep 1, 2026 - Sep 30, 2026"},
    {key:"previous_month",label:"Aug 1, 2026 - Aug 31, 2026"},
    {key:"last_30_days",label:"Last 30 days"},
  ];
  const label=ranges.find(item=>item.key===value)?.label??ranges[0].label;
  return <div className="relative"><button type="button" onClick={()=>setOpen(v=>!v)} className="flex h-12 min-w-[244px] items-center gap-3 rounded-xl border border-white/15 bg-[#0d0e0d]/90 px-4 text-[13px] text-white/85 shadow-[0_8px_28px_rgba(0,0,0,.25)] transition hover:border-[#e7b354]/35"><CalendarDays className="size-5 text-white/65"/><span className="flex-1 text-left">{label}</span><ChevronDown className={cn("size-4 text-white/45 transition-transform",open&&"rotate-180")}/></button>{open?<div className="absolute right-0 top-[54px] z-30 w-[270px] rounded-xl border border-[#e7b354]/20 bg-[#0c0d0b] p-2 shadow-2xl">{ranges.map(item=><button type="button" key={item.key} onClick={()=>{onChange(item.key as DashboardPeriod);setOpen(false)}} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-white/75 hover:bg-[#e7b354]/10 hover:text-white"><span>{item.label}</span>{value===item.key?<Check className="size-4 text-[#f3bd55]"/>:null}</button>)}</div>:null}</div>
}
function ActivityPanel({activity,period,setPeriod}:{activity:Array<{date:string;new_customers:number;stamps_issued:number;rewards_redeemed:number}>;period:DashboardPeriod;setPeriod:(p:DashboardPeriod)=>void}) {
  const [hovered,setHovered]=useState<number|null>(null);
  const width=820,height=205,left=48,right=18,top=14,bottom=36;
  const max=Math.max(1,...activity.flatMap(d=>[d.new_customers,d.stamps_issued,d.rewards_redeemed]));
  const y=(v:number)=>top+(height-top-bottom)*(1-v/max);
  const x=(i:number)=>left+(activity.length<=1?0:i*(width-left-right)/(activity.length-1));
  const customerPoints=activity.map((d,i)=>`${x(i)},${y(d.new_customers)}`).join(" ");
  const grid=[0,.25,.5,.75,1];
  const labels=activity.filter((_,i)=>i===0||i===activity.length-1||i%Math.max(1,Math.floor(activity.length/6))===0);
  return <section className="self-start rounded-[18px] border border-[#b67a18]/35 bg-[linear-gradient(145deg,rgba(15,15,12,.94),rgba(8,9,7,.90))] p-5 shadow-[0_15px_45px_rgba(0,0,0,.26)]">
    <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl border border-[#d69b2d]/20 bg-[#8b5d12]/25 text-[#ffc857]"><Users className="size-6"/></div><div><h2 className="text-base font-bold text-white">Customer Activity</h2><p className="mt-0.5 text-sm text-white/50">New customers, stamps and rewards over time.</p></div></div><DateRangePicker value={period} onChange={setPeriod}/></div>
    <div className="relative mt-3 overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="block min-w-[680px] w-full" role="img" aria-label="Customer activity chart">
      <defs><linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d99c2b" stopOpacity=".72"/><stop offset="100%" stopColor="#7a4b08" stopOpacity=".25"/></linearGradient><filter id="lineGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {grid.map((g,i)=>{const yy=top+(height-top-bottom)*g;return <g key={i}><line x1={left} x2={width-right} y1={yy} y2={yy} stroke="rgba(255,255,255,.10)" strokeDasharray="3 3"/><text x="8" y={yy+4} fill="rgba(255,255,255,.55)" fontSize="11">{Math.round(max*(1-g))}</text></g>})}
      {activity.map((d,i)=>{const bw=Math.max(5,Math.min(15,(width-left-right)/Math.max(activity.length,1)*.55));const xx=x(i)-bw/2;return <g key={d.date}><rect x={xx} y={y(d.stamps_issued)} width={bw} height={height-bottom-y(d.stamps_issued)} rx="2" fill="url(#barGold)"/><rect x={x(i)-Math.max(12,bw)} y={top} width={Math.max(24,bw*2)} height={height-top-bottom} fill="transparent" className="cursor-crosshair" onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}/></g>})}
      {activity.length>1?<polyline points={customerPoints} fill="none" stroke="#f6c34f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" filter="url(#lineGlow)"/>:null}
      {activity.map((d,i)=><circle key={d.date+"p"} cx={x(i)} cy={y(d.new_customers)} r="3.5" fill="#ffd66d"/>)}
      {labels.map((d)=>{const i=activity.indexOf(d);const dt=new Date(d.date+"T00:00:00");return <text key={d.date+"l"} x={x(i)} y={height-14} textAnchor={i===0?"start":i===activity.length-1?"end":"middle"} fill="rgba(255,255,255,.55)" fontSize="10">{dt.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</text>})}
    </svg>{hovered!==null&&activity[hovered]?<div className="pointer-events-none absolute right-3 top-3 z-10 min-w-[170px] rounded-xl border border-[#d69b2d]/35 bg-[#090a08]/95 p-3 text-xs shadow-2xl backdrop-blur-md"><p className="mb-2 font-semibold text-white">{new Date(activity[hovered].date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p><p className="flex justify-between gap-5 text-white/65"><span>New Customers</span><b className="text-[#ffd66d]">{activity[hovered].new_customers}</b></p><p className="mt-1 flex justify-between gap-5 text-white/65"><span>Stamps Issued</span><b className="text-[#c58a22]">{activity[hovered].stamps_issued}</b></p><p className="mt-1 flex justify-between gap-5 text-white/65"><span>Rewards Redeemed</span><b className="text-white/80">{activity[hovered].rewards_redeemed}</b></p></div>:null}</div>
    <div className="-mt-2 flex flex-wrap justify-center gap-x-8 gap-y-2 pb-1 text-xs text-white/55"><span className="flex items-center gap-2"><i className="size-3 rounded-full bg-[#f6c34f]"/>New Customers</span><span className="flex items-center gap-2"><i className="size-3 rounded-full bg-[#a86f12]"/>Stamps Issued</span><span className="flex items-center gap-2"><i className="size-3 rounded-full bg-white/25"/>Rewards Redeemed</span></div>
  </section>
}
function RecentCustomers({customers}:{customers:Array<{id:string;name:string;email:string|null;activity:{type:string;date:string}}>}){
  const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"C";
  const badge=(type:string)=>type==="reward"?["Redeemed reward","bg-[#253d92]/45 text-[#6d8cff]"]:type==="stamp"?["+1 stamp","bg-[#123c1c]/65 text-[#55dc72]"]:["Joined","bg-[#5a3d08]/55 text-[#ffc54c]"];
  return <section className="overflow-hidden rounded-[18px] border border-[#b67a18]/40 bg-[linear-gradient(145deg,rgba(15,15,12,.96),rgba(8,9,7,.92))] p-5 shadow-[0_15px_45px_rgba(0,0,0,.26)]">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl border border-[#d69b2d]/20 bg-[#8b5d12]/25 text-[#ffc857]"><Users className="size-6"/></div><div><h2 className="text-base font-bold text-white">Recent Customers</h2><p className="mt-0.5 text-sm text-white/50">Latest customer activity in your loyalty program.</p></div></div><Button asChild variant="outline" className="h-11 border-[#e7b354]/60 bg-transparent px-4 font-semibold text-[#ffc857] hover:bg-[#e7b354]/10 hover:text-[#ffd36a]"><Link href="/dashboard/customers">View all <ArrowUpRight className="size-4"/></Link></Button></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-white/10 bg-white/[.035] text-sm text-white/60"><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Email</th><th className="px-4 py-2.5 font-medium">Activity</th><th className="px-4 py-2.5 font-medium">Date</th></tr></thead><tbody>{customers.map(c=>{const [label,cls]=badge(c.activity?.type);const dt=c.activity?.date?new Date(c.activity.date):null;return <tr key={c.id} className="border-b border-white/[.07] last:border-0"><td className="px-4 py-2"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full border border-[#f2b93f]/35 bg-[linear-gradient(145deg,#c99125,#7a500b)] text-xs font-bold text-white">{initials(c.name)}</span><span className="text-sm text-white/75">{c.name||"Customer"}</span></div></td><td className="px-4 py-2 text-sm text-white/55">{c.email||"—"}</td><td className="px-4 py-2"><span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium",cls)}>{label}</span></td><td className="px-4 py-2 text-sm text-white/55">{dt?dt.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}</td></tr>})}{customers.length===0?<tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-white/40">No customer activity yet.</td></tr>:null}</tbody></table></div>
  </section>
}

function QuickActions(){return <section className="h-full rounded-[18px] border border-[#e7b354]/20 bg-[linear-gradient(145deg,rgba(13,14,11,.96),rgba(8,9,7,.94))] p-4 shadow-[0_18px_45px_rgba(0,0,0,.18)]"><div className="flex items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#d69b2d]/20 bg-[#8b5d12]/20 text-[#ffc857]"><Zap className="size-6 stroke-[2.2]"/></div><div><h2 className="text-base font-bold text-white">Quick Actions</h2><p className="text-xs text-white/50">Perform common tasks quickly.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Action href="/dashboard/customers" icon={UserPlus} label="Add Customer" detail="Manually add a customer"/><Action href="/dashboard/scanner" icon={QrCode} label="Scan QR Code" detail="Scan customer loyalty card"/><Action href="/dashboard/loyalty-card" icon={CreditCard} label="Edit Loyalty Card" detail="Customize your card design"/></div></section>}

function Action({href,icon:Icon,label,detail}:{href:string;icon:React.ElementType;label:string;detail:string}){return <Link href={href} className="group flex min-h-[86px] items-center gap-3 rounded-[14px] border border-[#e7b354]/15 bg-[linear-gradient(145deg,rgba(31,28,19,.72),rgba(14,15,12,.92))] px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#e7b354]/45 hover:bg-[#e7b354]/10"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#8b5d12]/25 text-[#ffc857] shadow-[0_0_18px_rgba(225,163,44,.08)]"><Icon className="size-5 stroke-[2]"/></div><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold leading-tight text-white">{label}</p><p className="mt-1 truncate text-[11px] leading-[1.25] text-white/48">{detail}</p></div><div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[.035] text-[#ffc857] transition group-hover:bg-[#8b5d12]/25"><ChevronRight className="size-3.5"/></div></Link>}
function BusinessInfo({name,logoUrl,createdAt}:{name:string;logoUrl:string|null;createdAt:string|null}){return <section className="flex h-full flex-col rounded-2xl border border-[#e7b354]/20 bg-[#0d0e0b]/95 p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl border border-[#d69b2d]/20 bg-[#8b5d12]/20 text-[#ffc857]"><Store className="size-6"/></div><div><h2 className="text-base font-bold text-white">Business Info</h2><p className="mt-0.5 text-xs text-white/45">Manage your business details.</p></div></div><Button asChild size="sm" variant="outline" className="h-10 border-[#e7b354]/55 bg-transparent px-4 font-semibold text-[#ffc857] hover:bg-[#e7b354]/10 hover:text-[#ffd36a]"><Link href="/dashboard/settings"><Settings className="size-4"/>View / Edit</Link></Button></div><div className="mt-4 flex flex-1 items-center justify-center gap-5 border-t border-white/[.06] pt-4"><div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden">{logoUrl?<img src={logoUrl} alt={name} className="h-full w-full object-contain"/>:<Store className="size-7 text-[#ffc857]"/>}</div><div><p className="text-base font-semibold text-white">{name}</p><p className="mt-0.5 text-xs text-white/45">Business Account</p></div><div className="mx-3 hidden h-12 w-px bg-white/10 sm:block"/><div className="flex items-center gap-3"><CalendarDays className="size-6 text-white/55"/><div><p className="text-sm text-white/55">Member since</p><p className="mt-0.5 text-base text-white/75">{createdAt ? new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(createdAt)) : "—"}</p></div></div></div></section>}

function DashboardSkeleton(){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-36 rounded-2xl bg-white/5"/>)}</div>}
