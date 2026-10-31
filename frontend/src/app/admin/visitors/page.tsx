"use client";
import "flag-icons/css/flag-icons.min.css";
import { CountryFlag } from "@/components/ui/country-flag";
import { DailyVisitsChart } from "@/components/admin/daily-visits-chart";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Clock3, Computer, ExternalLink, Globe2, Link2, Loader2, MapPin, MousePointerClick, RefreshCw, Smartphone, Users, X } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-shell";
import { adminRequest } from "@/lib/admin";

type Row={ [key:string]: string|number|null|undefined };
type Summary={ sessions:number; pageviews:number; clicks:number; avg_seconds:number; recently_active:number; signed_in_sessions:number };
type Visitor={id:string;first_seen:string;last_seen:string;entry_path:string;current_path:string;referrer:string;traffic_source:string;country_code:string|null;city:string|null;region:string|null;device:string;browser:string;os:string;active_seconds:number;pageviews:number;clicks:number;user_name:string|null;user_role:string|null};
type Event={event_type:"page"|"click";page_path:string;target:string|null;happened_at:string};
type Analytics={days:number;totals:Summary;daily:Array<{day:string;sessions:number;pageviews:number}>;pages:Array<{name:string;views:number;sessions:number}>;countries:Array<{country_code:string;sessions:number}>;cities:Array<{country_code:string;city:string;region:string;sessions:number}>;sources:Array<{name:string;sessions:number}>;devices:Array<{name:string;sessions:number}>;clicks:Array<{name:string;clicks:number}>;sessions:Visitor[]};
const card="admin-panel min-w-0 rounded-2xl border border-white/10 bg-[#101318] p-4 sm:p-5";
const formatNumber=(value:number)=>new Intl.NumberFormat("en").format(Number(value||0));
const seconds=(n:number)=>n>=3600?Math.floor(n/3600)+"h "+Math.floor(n%3600/60)+"m":n>=60?Math.floor(n/60)+"m "+n%60+"s":n+"s";
const date=(value:string)=>{try{return new Date(value).toLocaleString(undefined,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});}catch{return value;}};
const nameCountry=(code:string|null)=>{if(!code||code==="Unknown")return "Unknown country";try{return new Intl.DisplayNames(["en"],{type:"region"}).of(code)||code;}catch{return code;}};
const number=(value:unknown)=>Number(value||0);
function Metric({label,value,note,icon:Icon}:{label:string;value:string;note:string;icon:typeof Users}){
 return <div className={card}><div className="flex min-w-0 items-start justify-between gap-3"><p className="text-xs font-semibold text-white/50">{label}</p><Icon className="size-5 shrink-0 text-[#efbd5d]"/></div><p className="mt-3 text-2xl font-bold text-white sm:text-3xl">{value}</p><p className="mt-1 text-[11px] leading-5 text-white/40">{note}</p></div>;
}
function Ranking({title,items,formatter,scrollable=false}:{title:string;items:Array<{label:string;value:number;subtitle?:string;flagCode?:string|null}>;formatter?:(value:number)=>string;scrollable?:boolean}){
 const max=Math.max(1,...items.map(x=>number(x.value)));
 return <section className={card}>
  <h2 className="mb-5 text-base font-semibold text-white">{title}</h2>
  {!items.length?<p className="py-5 text-xs text-white/40">No data collected yet.</p>:
  <div className={`space-y-4 ${scrollable?"admin-visitors-ranking-scroll max-h-[360px] overflow-y-auto overscroll-y-contain pe-2 sm:max-h-[400px]":""}`} role={scrollable?"region":undefined} aria-label={scrollable?title:undefined} tabIndex={scrollable?0:undefined}>{items.map((item,i)=><div key={item.label+"_"+i} className="min-w-0 space-y-1.5">
   <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
    <div className="min-w-0"><p className="flex min-w-0 items-center gap-2 break-all font-medium text-white/80">{item.flagCode!==undefined?<CountryFlag code={item.flagCode}/>:null}<span className="min-w-0 break-words">{item.label}</span></p>{item.subtitle?<p className="mt-0.5 text-[10px] text-white/35">{item.subtitle}</p>:null}</div>
    <span className="shrink-0 tabular-nums font-semibold text-[#efbd5d]">{formatter?formatter(item.value):formatNumber(item.value)}</span>
   </div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#efbd5d]/80" style={{width:Math.max(2,item.value/max*100)+"%"}}/></div>
  </div>)}</div>}
 </section>;
}
export default function AdminVisitorsPage(){
 const {token}=useAdmin();
 const [days,setDays]=useState<7|30|90>(7);
 const [report,setReport]=useState<Analytics|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [selected,setSelected]=useState<Visitor|null>(null);
 const [events,setEvents]=useState<Event[]|null>(null);
 const [detailError,setDetailError]=useState("");
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{
   const response=await adminRequest<Analytics>("visitors?days="+days,token,{signal,cache:"no-store"});
   if(signal?.aborted)return;
   setReport(response);setError("");
  }catch(e){if(signal?.aborted)return;setError(e instanceof Error?e.message:"Could not load analytics.");}
  finally{if(!signal?.aborted)setLoading(false);}
 },[days,token]);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setReport(null);
  void load(controller.signal);
  const interval=window.setInterval(()=>{if(!document.hidden)void load(controller.signal);},30000);
  return()=>{controller.abort();window.clearInterval(interval);};
 },[load]);
 async function details(visitor:Visitor){
  setSelected(visitor);setEvents(null);setDetailError("");
  try{
   const response=await adminRequest<{session:Visitor;events:Event[]}>("visitors/session/"+visitor.id+"?days="+days,token);
   setEvents(response.events);
  }catch(e){setDetailError(e instanceof Error?e.message:"Cannot load visitor timeline.");}
 }
 const summary=report?.totals;
 return <div className="min-w-0 space-y-5 overflow-x-clip text-white sm:space-y-6">
  <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
   <div className="min-w-0"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#efbd5d]">Website intelligence</p>
    <h1 className="flex items-center gap-3 text-2xl font-semibold sm:text-3xl"><BarChart3 className="size-7 shrink-0 text-[#efbd5d]"/>Visitor Analytics</h1>
    <p className="mt-2 max-w-2xl text-xs leading-6 text-white/45 sm:text-sm">Page visits, traffic sources, link clicks and time spent. Locations are approximate IP-based estimates; exact city or GPS position cannot be determined.</p>
   </div>
   <div className="flex min-w-0 flex-wrap items-center gap-2">
    <div className="flex rounded-xl border border-white/10 bg-[#101318] p-1">{([7,30,90] as const).map(d=><button key={d} type="button" onClick={()=>setDays(d)} className={`min-h-9 rounded-lg px-3 text-xs font-bold transition ${days===d?"bg-[#efbd5d] text-black":"text-white/55 hover:text-white"}`}>{d} days</button>)}</div>
    <button onClick={()=>void load()} type="button" aria-label="Refresh visitors" className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-[#efbd5d] hover:bg-white/10"><RefreshCw className="size-4"/></button>
   </div>
  </div>
  {error?<div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-3 text-sm text-rose-300">{error}</div>:null}
  {loading&&!report?<div className="flex items-center gap-2 py-12 text-sm text-white/50"><Loader2 className="size-4 animate-spin"/>Loading visitor analytics...</div>:null}
  {report&&summary?<div className="space-y-5">
   <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
    <Metric icon={Users} label="Sessions" value={formatNumber(summary.sessions)} note="Browser tab sessions, not unique people"/>
    <Metric icon={Activity} label="Active recently" value={formatNumber(summary.recently_active)} note="Activity within last 2 min"/>
    <Metric icon={Globe2} label="Page views" value={formatNumber(summary.pageviews)} note="Recorded page changes"/>
    <Metric icon={MousePointerClick} label="Link clicks" value={formatNumber(summary.clicks)} note="Internal and outbound links"/>
    <Metric icon={Clock3} label="Average active time" value={seconds(number(summary.avg_seconds))} note="Approx. foreground time"/>
    <Metric icon={Users} label="Logged-in sessions" value={formatNumber(summary.signed_in_sessions)} note="Recognized authenticated users"/>
   </div>
   <DailyVisitsChart data={report.daily} days={days}/>
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
    <Ranking title="Most visited pages" scrollable items={report.pages.map(p=>({label:p.name,value:number(p.views),subtitle:p.sessions+" sessions"}))}/>
    <Ranking title="Links visitors clicked" scrollable items={report.clicks.map(p=>({label:p.name,value:number(p.clicks)}))}/>
    <Ranking title="Countries" items={report.countries.map(c=>({label:nameCountry(c.country_code),flagCode:c.country_code,value:number(c.sessions)}))}/>
    <Ranking title="Cities (estimated)" items={report.cities.map(c=>({label:c.city+(c.region?" · "+c.region:""),flagCode:c.country_code,value:number(c.sessions),subtitle:nameCountry(c.country_code)}))}/>
    <Ranking title="Where they came from" items={report.sources.map(s=>({label:s.name,value:number(s.sessions)}))}/>
    <Ranking title="Device types" items={report.devices.map(d=>({label:d.name,value:number(d.sessions)}))}/>
   </div>
   <section className={card}>
    <div className="mb-4"><h2 className="text-base font-semibold">Recent visitor sessions</h2><p className="mt-1 text-xs leading-5 text-white/40">Latest 80 sessions. Select one to see page-by-page history and clicked links. Anonymous visitors cannot be personally identified.</p></div>
    <div className="space-y-2">{report.sessions.map(v=><button key={v.id} type="button" onClick={()=>void details(v)} className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#efbd5d]/40 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="min-w-0">
       <div className="flex min-w-0 items-center gap-2"><CountryFlag code={v.country_code}/><span className="truncate text-sm font-semibold text-white">{v.user_name||"Anonymous visitor"}</span><span className="shrink-0 text-[10px] text-white/30">#{v.id.slice(0,8)}</span></div>
       <p className="mt-1 break-words text-[11px] leading-5 text-white/45"><MapPin className="me-1 inline size-3"/>{[v.city||"City unknown",nameCountry(v.country_code)].join(", ")} · {v.device} · {v.browser} / {v.os}</p>
       <p className="mt-1 break-all text-[11px] text-white/40">{v.traffic_source} · Entered {v.entry_path}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
       <div className="text-left text-[11px] text-white/50 sm:text-right"><p>{date(v.first_seen)}</p><p className="mt-1">{v.pageviews} pages · {v.clicks} clicks · {seconds(number(v.active_seconds))}</p></div><ArrowUpRight className="size-4 shrink-0 text-[#efbd5d]"/>
      </div>
     </button>)}
     {!report.sessions.length&&<p className="py-8 text-center text-xs text-white/40">No visits yet. New sessions will appear here.</p>}
    </div>
   </section>
   <p className="text-[11px] leading-5 text-white/35">Analytics records are purged after 90 days when reporting runs. Analytics tables do not contain raw IP addresses, GPS, typed form values or URL query parameters. Do Not Track / Global Privacy Control signals are respected. Referrers and geo headers may be absent.</p>
  </div>:null}
  {selected?<div role="dialog" aria-modal="true" aria-label="Visitor session timeline" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={()=>{setSelected(null);setEvents(null);}}>
    <div className="max-h-[90dvh] w-full min-w-0 max-w-xl overflow-y-auto rounded-t-2xl border border-white/15 bg-[#12151b] p-4 shadow-2xl sm:rounded-2xl sm:p-6" onClick={e=>e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0">
       <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#efbd5d]">Session details</p>
       <h3 className="mt-2 flex min-w-0 items-center gap-2 break-words text-xl font-semibold"><CountryFlag code={selected.country_code}/><span className="min-w-0">{selected.user_name||"Anonymous visitor"}</span></h3>
       <p className="mt-1 text-xs text-white/45">{selected.city||"Unknown city"}, {nameCountry(selected.country_code)} · {selected.device} · {selected.browser}</p>
      </div><button type="button" aria-label="Close details" onClick={()=>{setSelected(null);setEvents(null);}} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 text-white/75"><X className="size-4"/></button></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><p className="text-[11px] text-white/40">Active time</p><p className="mt-1 font-bold">{seconds(number(selected.active_seconds))}</p></div><div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><p className="text-[11px] text-white/40">Arrival source</p><p className="mt-1 break-words text-xs font-semibold">{selected.traffic_source}</p></div></div>
      <div className="mt-4 space-y-1 text-[11px] leading-5 text-white/45"><p className="break-all"><strong className="text-white/70">Entry page:</strong> {selected.entry_path}</p><p className="break-all"><strong className="text-white/70">Referring URL:</strong> {selected.referrer||"Direct / unavailable"}</p><p><strong className="text-white/70">Last seen:</strong> {date(selected.last_seen)}</p></div>
       <p className="mt-5 mb-3 text-sm font-semibold">Page & click timeline</p>
      {detailError?<p className="text-sm text-rose-300">{detailError}</p>:events===null?<p className="flex items-center gap-2 text-xs text-white/40"><Loader2 className="size-4 animate-spin"/>Loading timeline...</p>:
       <div className="space-y-2">{events.map((event,i)=><div key={i} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-start gap-3">
        {event.event_type==="page"?<Globe2 className="mt-0.5 size-4 shrink-0 text-sky-300"/>:<MousePointerClick className="mt-0.5 size-4 shrink-0 text-[#efbd5d]"/>}
        <div className="min-w-0 flex-1"><p className="break-all text-xs font-semibold">{event.event_type==="page"?"Viewed "+event.page_path:"Clicked "+(event.target||"a link")}</p>
         <p className="mt-1 break-all text-[11px] text-white/45">{event.event_type==="click"?"On "+event.page_path+" · ":""}{date(event.happened_at)}</p></div></div></div>)}
        {!events.length?<p className="text-xs text-white/40">No individual page events recorded.</p>:null}
       </div>}
    </div>
   </div>:null}
 </div>;
}
