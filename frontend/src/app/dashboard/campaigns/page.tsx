"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, CalendarClock, CheckCheck, Clock, Gift, Loader2, Mail, Megaphone, Play, Pencil, RefreshCcw, ShieldCheck, Trash2, Users, X, Zap } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/components/auth/auth-guard";
import { apiFetch } from "@/lib/api";

type Segment="all"|"inactive_30"|"one_away"|"new_7";
type Channel="inapp"|"inapp_email";
type Campaign={id:string;title:string;message:string;segment:Segment;channel:Channel;status:string;scheduled_at:string|null;sent_at:string|null;created_at:string};
type Automation={id:string;name:string;title:string;message:string;segment:Segment;channel:Channel;interval_days:number;is_active:boolean;next_run_at:string|null};
type Analytics={recipients:number;emails_sent:number;emails_waiting:number;viewed:number;returned_7d:number};
const segments:{value:Segment;name:string;description:string;icon:typeof Users}[]=[
 {value:"all",name:"All opted-in customers",description:"Customers who enabled Promotions",icon:Users},
 {value:"inactive_30",name:"Win back after 30 days",description:"Joined 30+ days ago, no recent visits",icon:Clock},
 {value:"one_away",name:"One stamp away",description:"Only 1 stamp remaining until a reward",icon:Gift},
 {value:"new_7",name:"Welcome new members",description:"Registered at the business within 7 days",icon:Bell}
];
const panel="min-w-0 rounded-2xl border border-[#ecb95e]/15 bg-[#10130f]/95 p-4 sm:p-6";
const input="mt-1.5 block w-full min-w-0 rounded-xl border border-white/15 bg-[#0a0d0a] px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ecb95e]/50";
const primary="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#f1bd5d] px-4 py-2.5 text-xs font-bold text-[#17130b] transition hover:bg-[#ffd181] disabled:opacity-40";
const secondary="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.025] px-4 py-2.5 text-xs font-semibold text-white/75 transition hover:border-[#ecb95e]/40 hover:text-white disabled:opacity-40";
const date=(s:string|null)=>s?new Date(s).toLocaleString("fr-MA",{dateStyle:"medium",timeStyle:"short"}):"—";
const defaultMessage="We miss you! Visit us again to collect stamps toward your next reward.";
function labelOf(s:Segment){return segments.find(x=>x.value===s)?.name??s;}

export default function BusinessCampaignsPage(){
 const {token}=useAuth();
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [automations,setAutomations]=useState<Automation[]>([]);
 const [title,setTitle]=useState("");
 const [message,setMessage]=useState(defaultMessage);
 const [segment,setSegment]=useState<Segment>("inactive_30");
 const [channel,setChannel]=useState<Channel>("inapp");
 const [automationName,setAutomationName]=useState("Win-back reminder");
 const [automationInterval,setAutomationInterval]=useState(14);
 const [selected,setSelected]=useState<string|null>(null);
 const [analytics,setAnalytics]=useState<Analytics|null>(null);
 const [audience,setAudience]=useState<{eligible:number;limited:boolean}|null>(null);
 const [schedule,setSchedule]=useState("");
 const [editingId,setEditingId]=useState<string|null>(null);
 const [copyFrom,setCopyFrom]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const data=await apiFetch<{campaigns:Campaign[];automations:Automation[]}>("/campaigns/business",{token,cache:"no-store"});
   setCampaigns(data.campaigns);setAutomations(data.automations);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Cannot load campaigns.");}
  finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void refresh();},[refresh]);
 const inspect=useCallback(async(id:string)=>{
  setSelected(id);setAudience(null);setAnalytics(null);
  try{
   const [detail,preview]=await Promise.all([
    apiFetch<{analytics:Analytics}>(`/campaigns/business/${id}`,{token}),
    apiFetch<{eligible:number;limited:boolean}>(`/campaigns/business/${id}/audience`,{token})
   ]);
   setAnalytics(detail.analytics);setAudience(preview);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load campaign details.");}
 },[token]);
 const perform=async(task:()=>Promise<unknown>,messageText:string)=>{
  if(busy)return;
  setBusy(true);setError("");setSuccess("");
  try{await task();setSuccess(messageText);await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Action failed.");}
  finally{setBusy(false);}
 };
 const clearEditor=()=>{setEditingId(null);setCopyFrom(null);setTitle("");setMessage(defaultMessage);setSegment("inactive_30");setChannel("inapp");};
 const editCampaign=(c:Campaign)=>{
  if(busy||c.status==="processing")return;
  setError("");setSuccess("");setTitle(c.title);setMessage(c.message);setSegment(c.segment);setChannel(c.channel);
  if(c.status==="draft"||c.status==="scheduled"){setEditingId(c.id);setCopyFrom(null);}
  else {setEditingId(null);setCopyFrom(c.id);}
  window.requestAnimationFrame(()=>document.getElementById("campaign-editor")?.scrollIntoView({behavior:"smooth",block:"start"}));
 };
 const create=async(e:FormEvent)=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setError("");setSuccess("");
  const isEdit=Boolean(editingId),isCopy=Boolean(copyFrom);
  try{
   const result=await apiFetch<{campaign:Campaign}>(editingId?`/campaigns/business/${editingId}`:"/campaigns/business",
    {token,method:isEdit?"PATCH":"POST",body:JSON.stringify({title,message,segment,channel})});
   clearEditor();
   await refresh();await inspect(result.campaign.id);
   setSuccess(isEdit?"Campaign updated.":isCopy?"An editable draft copy was created; previously sent notifications stay unchanged.":"Draft campaign created. Review your eligible audience before sending or scheduling.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save campaign.");}
  finally{setBusy(false);}
 };
 const deleteCampaign=(c:Campaign)=>{
  if(busy)return;
  const explanation=c.status==="sent"?" This removes it from history but cannot recall delivered notifications or emails; queued email jobs may still run.":c.status==="scheduled"?" This cancels its scheduled delivery.":"";
  if(!window.confirm(`Delete campaign "${c.title}"?${explanation}`))return;
  void perform(async()=>{
   const result=await apiFetch<{deleted:boolean}>(`/campaigns/business/${c.id}`,{token,method:"DELETE"});
   if(!result.deleted)throw Error("Campaign was not deleted. Refresh and try again.");
   if(selected===c.id){setSelected(null);setAnalytics(null);setAudience(null);}
   if(editingId===c.id||copyFrom===c.id)clearEditor();
  },c.status==="sent"?"Campaign removed from history. Previously delivered messages remain.":"Campaign deleted from history.");
 };
 const action=(id:string,name:"send"|"cancel"|"schedule")=>{
  const note=name==="send"?"Send this campaign to eligible customers now? Only opted-in customers will be notified.":null;
  if(note&&!window.confirm(note))return;
  return perform(async()=>{
   await apiFetch(`/campaigns/business/${id}/${name}`,{token,method:"POST",body:JSON.stringify(name==="schedule"?{scheduled_at:new Date(schedule).toISOString()}:{})});
   await inspect(id);
  },name==="send"?"Notifications processed. Promotional email delivery follows the scheduled queue.":name==="cancel"?"Campaign cancelled.":"Campaign scheduled. It will run at the next scheduled processing cycle.");
 };
 const createAutomation=async(e:FormEvent)=>{
  e.preventDefault();
  if(segment==="all"){setError("Choose an activity-based segment for automation.");return;}
  await perform(async()=>{
   await apiFetch("/campaigns/automations",{token,method:"POST",body:JSON.stringify({name:automationName,title: title||"A reason to visit",message,segment,channel,interval_days:automationInterval})});
  },"Automation created in Paused mode. Review it, then enable explicitly.");
 };
 const toggleAutomation=(a:Automation)=>perform(async()=>{
  await apiFetch(`/campaigns/automations/${a.id}`,{token,method:"PATCH",body:JSON.stringify({is_active:!a.is_active})});
 },a.is_active?"Automation paused.":"Automation enabled. It is processed by the scheduled daily job.");
 const removeAutomation=(a:Automation)=>{if(!window.confirm("Delete automation "+a.name+"?"))return;
  return perform(async()=>{await apiFetch(`/campaigns/automations/${a.id}`,{token,method:"DELETE"});},"Automation removed.");};
 const selectedCampaign=campaigns.find(c=>c.id===selected);
 return <DashboardShell activeItem="campaigns">
  <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 overflow-x-clip px-3 pb-14 pt-6 sm:px-6 lg:px-8">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.23em] text-[#efbd5d]">CUSTOMER ENGAGEMENT</p>
     <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl"><Megaphone className="size-7 shrink-0 text-[#efbd5d]"/>Smart Campaigns</h1>
     <p className="mt-2 text-sm text-white/55">Bring customers back with targeted, consent-based loyalty reminders.</p></div>
    <button type="button" onClick={()=>void refresh()} className={secondary}><RefreshCcw className="size-4"/>Refresh</button>
   </header>
   {error?<p role="alert" className="break-words rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>:null}
   {success?<p role="status" className="break-words rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{success}</p>:null}
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,.95fr)]">
    <section className={panel}>
     <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Megaphone className="size-5 text-[#efbd5d]"/>Create a campaign</h2>
     <form onSubmit={e=>void create(e)} className="mt-4 space-y-4">
      <label className="block text-xs font-medium text-white/60">Campaign title<input className={input} maxLength={80} minLength={3} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="A special offer from your business"/></label>
      <label className="block text-xs font-medium text-white/60">Message<textarea className={input+" min-h-28 resize-y"} maxLength={300} minLength={10} required value={message} onChange={e=>setMessage(e.target.value)}/><span className="mt-1 block text-right text-[11px] text-white/40">{message.length}/300</span></label>
      <fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-white/70">Target audience</legend>
       {segments.map(item=><label key={item.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${segment===item.value?"border-[#efbd5d]/50 bg-[#efbd5d]/10":"border-white/10 hover:border-white/25"}`}>
        <input type="radio" name="segment" className="accent-[#efbd5d]" checked={segment===item.value} onChange={()=>setSegment(item.value)}/><item.icon className="size-5 shrink-0 text-[#efbd5d]"/>
        <span className="min-w-0"><span className="block text-sm font-semibold text-white">{item.name}</span><span className="block text-xs text-white/45">{item.description}</span></span>
       </label>)}
      </fieldset>
      <fieldset><legend className="mb-2 text-xs font-semibold text-white/70">Delivery channel</legend>
       <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs ${channel==="inapp"?"border-[#efbd5d]/50 text-[#efbd5d]":"border-white/10 text-white/65"}`}><input type="radio" checked={channel==="inapp"} onChange={()=>setChannel("inapp")}/><Bell className="size-4"/>In-app notifications</label>
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs ${channel==="inapp_email"?"border-[#efbd5d]/50 text-[#efbd5d]":"border-white/10 text-white/65"}`}><input type="radio" checked={channel==="inapp_email"} onChange={()=>setChannel("inapp_email")}/><Mail className="size-4"/>In-app + email</label>
       </div>
      </fieldset>
      <p className="flex items-start gap-2 rounded-xl bg-[#efbd5d]/5 p-3 text-xs leading-5 text-white/60"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#efbd5d]"/>Only members who opted in to promotions are eligible. Email also requires Email updates consent; no contact lists are exported.</p>
      <button type="submit" disabled={busy||title.trim().length<3||message.trim().length<10} className={primary+" w-full"}>{busy?<Loader2 className="size-4 animate-spin"/>:<Megaphone className="size-4"/>}Save draft campaign</button>
     </form>
    </section>
    <div className="min-w-0 space-y-4">
     <section className={panel}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-white"><CalendarClock className="size-5 text-[#efbd5d]"/>Campaign history</h2>
      {loading?<p className="mt-4 flex items-center gap-2 text-sm text-white/50"><Loader2 className="size-4 animate-spin"/>Loading…</p>:!campaigns.length?<p className="mt-4 text-sm text-white/45">No campaigns created yet. Save a draft to start.</p>:<div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto">
        {campaigns.map(c=><button key={c.id} type="button" onClick={()=>void inspect(c.id)} className={`flex w-full min-w-0 items-start justify-between gap-2 rounded-xl border p-3 text-left transition ${selected===c.id?"border-[#efbd5d]/45 bg-[#efbd5d]/10":"border-white/10 hover:border-white/25"}`}>
         <span className="min-w-0"><span className="block break-words text-sm font-semibold text-white">{c.title}</span><span className="mt-1 block text-[11px] text-white/45">{labelOf(c.segment)} · {date(c.created_at)}</span></span>
         <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${c.status==="sent"?"bg-emerald-400/10 text-emerald-300":c.status==="scheduled"?"bg-blue-400/10 text-blue-300":"bg-white/10 text-white/60"}`}>{c.status}</span>
        </button>)}
       </div>}
     </section>
     {selectedCampaign?<section className={panel}>
      <h2 className="break-words text-base font-semibold text-white">{selectedCampaign.title}</h2>
      <p className="mt-2 break-words text-sm leading-6 text-white/60">{selectedCampaign.message}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
       {([{label:"Eligible",value:audience?.eligible??"…",icon:Users},{label:"Notified",value:analytics?.recipients??"…",icon:Bell},{label:"Viewed",value:analytics?.viewed??"…",icon:CheckCheck},{label:"Emails sent",value:analytics?.emails_sent??"…",icon:Mail},{label:"Visited in 7d",value:analytics?.returned_7d??"…",icon:Users}]).map(k=><div key={k.label} className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-2.5"><k.icon className="size-4 text-[#efbd5d]"/><p className="mt-2 break-words text-lg font-bold text-white">{k.value}</p><p className="text-[10px] text-white/45">{k.label}</p></div>)}
      </div>
      {audience?.limited?<p className="mt-3 text-xs text-amber-200">Audience exceeds the 500-recipient limit; narrow the segment before sending.</p>:null}
      <p className="mt-3 text-[11px] leading-5 text-white/40">7-day visits show observed activity after notification, not proof the campaign caused the visit.</p>
      {selectedCampaign.status==="draft"?<div className="mt-4 space-y-3">
        <button disabled={busy||!audience||audience.limited} className={primary+" w-full"} type="button" onClick={()=>void action(selectedCampaign.id,"send")}><Play className="size-4"/>Send now</button>
        <label className="block text-xs text-white/55">Schedule delivery (local time)<input type="datetime-local" className={input} value={schedule} onChange={e=>setSchedule(e.target.value)}/></label>
        <button disabled={busy||!schedule} className={secondary+" w-full"} type="button" onClick={()=>void action(selectedCampaign.id,"schedule")}><CalendarClock className="size-4"/>Schedule campaign</button>
        <button disabled={busy} className={secondary+" w-full text-rose-300"} onClick={()=>void perform(async()=>{await apiFetch(`/campaigns/business/${selectedCampaign.id}`,{token,method:"DELETE"});setSelected(null);},"Draft deleted.")} type="button"><Trash2 className="size-4"/>Delete draft</button>
       </div>:selectedCampaign.status==="scheduled"?<div className="mt-4"><p className="text-xs text-white/55">Scheduled: {date(selectedCampaign.scheduled_at)}. The daily delivery processor runs campaigns at or after the chosen time.</p><button type="button" disabled={busy} className={secondary+" mt-3 w-full"} onClick={()=>void action(selectedCampaign.id,"cancel")}>Cancel scheduled campaign</button></div>:<p className="mt-4 text-xs text-white/45">{selectedCampaign.status==="sent"?"Delivered to opted-in members; email processing may continue on the next run.":"Campaign cancelled."} Email jobs pending: {analytics?.emails_waiting??0}.</p>}
     </section>:null}
     <section className={panel}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Zap className="size-5 text-[#efbd5d]"/>Smart automations</h2>
      <p className="mt-2 text-xs leading-5 text-white/50">Recurring reminders are created paused, and run at most once per configured interval. Global and business send limits still apply.</p>
      <form className="mt-4 space-y-3" onSubmit={e=>void createAutomation(e)}>
       <label className="block text-xs text-white/60">Automation name<input className={input} value={automationName} minLength={3} maxLength={60} required onChange={e=>setAutomationName(e.target.value)}/></label>
       <label className="block text-xs text-white/60">Repeat interval<select className={input} value={automationInterval} onChange={e=>setAutomationInterval(Number(e.target.value))}><option value={7}>Every 7 days</option><option value={14}>Every 14 days</option><option value={30}>Every 30 days</option></select></label>
       <p className="text-xs leading-5 text-white/45">Uses the title, message, channel and segment from the campaign form. Select Win-back, One stamp away or Welcome first.</p>
       <button type="submit" disabled={busy||segment==="all"||message.length<10} className={secondary+" w-full"}><Zap className="size-4"/>Create paused automation</button>
      </form>
      <div className="mt-4 space-y-2">{automations.map(a=><div key={a.id} className="min-w-0 rounded-xl border border-white/10 p-3">
       <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold text-white">{a.name}</p><p className="mt-1 text-[11px] text-white/40">{labelOf(a.segment)} · every {a.interval_days} days</p></div><span className={a.is_active?"text-xs text-emerald-300":"text-xs text-white/45"}>{a.is_active?"Active":"Paused"}</span></div>
       <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>void toggleAutomation(a)}>{a.is_active?"Pause":"Enable"}</button><button type="button" className={secondary+" text-rose-300"} disabled={busy} onClick={()=>void removeAutomation(a)} aria-label={"Delete "+a.name}><Trash2 className="size-4"/></button></div>
      </div>)}</div>
     </section>
    </div>
   </div>
  </div>
 </DashboardShell>;
}
