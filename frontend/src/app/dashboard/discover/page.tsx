"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useCallback,useEffect,useState} from "react";
import {Compass,MapPin,Users,Store,Save,LocateFixed,ShieldCheck,TrendingUp,RefreshCcw} from "lucide-react";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";
import {useAuth} from "@/components/auth/auth-guard";
import {apiFetch} from "@/lib/api";
type Settings={discover_visible:boolean;discover_city:string|null;discover_category:string|null;discover_latitude:number|null;discover_longitude:number|null};
type Stats={joins_all:number;joins_30d:number;joined_then_visited:number;visited_from_recent_joins:number};
type Trend={day:string;joins:number};
const categories=["Cafe","Restaurant","Bakery","Barber","Beauty & Spa","Retail","Fitness","Other"];
const field="w-full rounded-xl border border-white/15 bg-[#090b09] p-3 text-sm text-white outline-none focus:border-[#e7b354]/60";
export default function DiscoverForBusiness(){
 const {token}=useAuth();
 const {t:tr}=useI18n();
 const [settings,setSettings]=useState<Settings>({discover_visible:true,discover_city:null,discover_category:null,discover_latitude:null,discover_longitude:null});
 const [stats,setStats]=useState<Stats|null>(null),[trend,setTrend]=useState<Trend[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[geoBusy,setGeoBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const r=await apiFetch<{settings:Settings;stats:Stats;trend:Trend[]}>("/discover/business",{token,cache:"no-store"});if(r.settings)setSettings(r.settings);setStats(r.stats);setTrend(r.trend);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load Discover settings.");}finally{setLoading(false);}},[token]);
 useEffect(()=>{void load();},[load]);
 const set=(patch:Partial<Settings>)=>setSettings(v=>({...v,...patch}));
 const useLocation=()=>{
  if(!navigator.geolocation){setError("Your browser does not support location access.");return;}
  setError("");setGeoBusy(true);
  navigator.geolocation.getCurrentPosition(
   p=>{set({discover_latitude:Number(p.coords.latitude.toFixed(6)),discover_longitude:Number(p.coords.longitude.toFixed(6))});setGeoBusy(false);setNotice("Coordinates added to the form. Save to publish the location.");},
   ()=>{setGeoBusy(false);setError("Location permission denied or unavailable. You can enter coordinates manually.");},
   {enableHighAccuracy:false,timeout:12000,maximumAge:120000});
 };
 const save=async()=>{setBusy(true);setError("");setNotice("");try{
  const r=await apiFetch<{settings:Settings}>("/discover/business",{method:"PATCH",token,body:JSON.stringify({visible:settings.discover_visible,city:settings.discover_city??"",category:settings.discover_category||"Other",latitude:settings.discover_latitude,longitude:settings.discover_longitude})});
  setSettings(r.settings);setNotice("Discover profile saved. Public visitors can now filter your business by its details.");await load();
 }catch(e){setError(e instanceof Error?e.message:"Could not save Discover profile.");}finally{setBusy(false);}};
 const max=Math.max(1,...trend.map(t=>t.joins));
 return <DashboardShell activeItem="discover"><div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e7b354]">{tr("GET DISCOVERED")}</p><h1 className="mt-2 flex items-center gap-3 text-2xl font-bold"><Compass className="size-7 text-[#e7b354]"/>{tr("Loyvance Discover Pro")}</h1><p className="mt-2 text-sm text-white/55">{tr("Help customers find your business, view your rewards and join your loyalty program.")}</p></div><button type="button" onClick={()=>void load()} className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm"><RefreshCcw className="size-4"/>{tr("Refresh")}</button></div>
  {error?<p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>:null}{notice?<p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">{notice}</p>:null}
  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
   <section className="rounded-2xl border border-[#e7b354]/15 bg-[#11130f] p-4 sm:p-6"><div className="flex items-center gap-2"><Store className="size-5 text-[#e7b354]"/><h2 className="font-bold">{tr("Public Discover profile")}</h2></div><p className="mt-2 text-xs text-white/50">{tr("Your existing business name, logo, rewards and Google Maps link appear automatically.")}</p>
    <label className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><span><strong className="block">{tr("List my business on Discover")}</strong><span className="mt-1 block text-xs text-white/45">{tr("Turn this off to hide the listing from Explore without removing existing customer cards.")}</span></span><input type="checkbox" checked={settings.discover_visible} onChange={e=>set({discover_visible:e.target.checked})} className="mt-1 size-5 accent-[#e7b354]"/></label>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
     <label className="text-xs text-white/65">{tr("City")}<input maxLength={70} className={field+" mt-2"} placeholder={tr("Casablanca")} value={settings.discover_city??""} onChange={e=>set({discover_city:e.target.value})}/></label>
     <label className="text-xs text-white/65">{tr("Business category")}<select className={field+" mt-2"} value={settings.discover_category??"Other"} onChange={e=>set({discover_category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    </div>
    <div className="mt-5 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-[#e7b354]"/>{tr("Business location")}<span className="text-xs font-normal text-white/40">(optional)</span></div>
    <p className="mt-1 text-xs leading-5 text-white/45">{tr("Coordinates are published to customers when your business is listed. Only set the public shop location, not a personal home address.")}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/60">{tr("Latitude")}<input className={field+" mt-2"} type="number" step="any" min={-90} max={90} value={settings.discover_latitude??""} placeholder="33.5731" onChange={e=>set({discover_latitude:e.target.value===""?null:Number(e.target.value)})}/></label><label className="text-xs text-white/60">{tr("Longitude")}<input className={field+" mt-2"} type="number" step="any" min={-180} max={180} value={settings.discover_longitude??""} placeholder="-7.5898" onChange={e=>set({discover_longitude:e.target.value===""?null:Number(e.target.value)})}/></label></div>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={geoBusy} onClick={useLocation} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs"><LocateFixed className="size-4"/>{geoBusy?"Locating…":"Use my current location"}</button><button type="button" onClick={()=>set({discover_latitude:null,discover_longitude:null})} className="rounded-lg border border-white/15 px-3 py-2 text-xs">{tr("Clear coordinates")}</button></div>
    <button type="button" disabled={busy||loading} onClick={()=>void save()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e7b354] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"><Save className="size-4"/>{busy?"Saving…":"Save Discover profile"}</button>
   </section>
   <section className="space-y-4"><div className="grid grid-cols-2 gap-3">
     {([{title:"New members from Discover",count:stats?.joins_30d??0,note:"Last 30 days",icon:Users},{title:"Discover joins all-time",count:stats?.joins_all??0,note:"Verified new memberships",icon:Compass},{title:"Visited after Discover join",count:stats?.visited_from_recent_joins??0,note:"Of last 30 days joins",icon:TrendingUp},{title:"Joined members who visited",count:stats?.joined_then_visited??0,note:"All-time first visits",icon:ShieldCheck}]).map(item=>{const Icon=item.icon;return <div key={item.title} className="rounded-2xl border border-[#e7b354]/15 bg-[#11130f] p-4"><Icon className="size-5 text-[#e7b354]"/><p className="mt-3 text-2xl font-bold">{loading?"…":item.count}</p><p className="mt-2 text-xs font-semibold">{item.title}</p><p className="mt-1 text-[11px] text-white/45">{item.note}</p></div>})}
    </div>
    <div className="rounded-2xl border border-[#e7b354]/15 bg-[#11130f] p-5"><h2 className="font-semibold">{tr("New customers from Discover")}</h2><p className="mt-1 text-xs text-white/50">30-day attribution trend, counting only cards created through Explore.</p><div className="mt-5 flex h-36 items-end gap-[3px]">{trend.map(t=><div key={t.day} title={t.day+": "+t.joins+" joins"} className="min-w-1 flex-1 rounded-t-sm bg-[#e7b354]" style={{height:Math.max(1,t.joins/max*100)+"%"}}/>)}</div><p className="mt-2 text-[11px] text-white/40">{trend[0]?.day??""} — {trend.at(-1)?.day??""}</p></div>
    <p className="text-xs leading-5 text-white/40">These are first-time loyalty card signups attributed to Explore, not sales or guaranteed in-store acquisitions. Existing cards and visits from other sources are not counted as Discover joins.</p>
   </section>
  </div>
 </div></DashboardShell>;
}