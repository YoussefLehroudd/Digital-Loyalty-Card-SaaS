"use client";
import { useEffect, useRef, useState } from "react";
import { Gift, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RewardLevel } from "@/lib/server/reward-levels";

export type MainReward = { required_stamps: number; reward_name: string; reward_description: string | null };

export function RewardLevelSettings({ token,onSaved,baseCard }: { token: string;onSaved?:()=>Promise<unknown>;baseCard?:MainReward }) {
  const [levels, setLevels] = useState<RewardLevel[]>([]), [loading, setLoading] = useState(true), [loaded,setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const saving = useRef(false);
  useEffect(() => { let active=true; apiFetch<{levels:RewardLevel[];base_stamps:number}>("/business/reward-levels",{token}).then(data=>{if(active){const main=data.levels.find(level=>level.stamps===data.base_stamps);
      setLevels([...data.levels.filter(level=>level.stamps!==data.base_stamps&&level.stamps!==1),{stamps:1,name:main?.name??"",message:main?.message??""}].sort((a,b)=>a.stamps-b.stamps));setLoaded(true);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Unable to load reward levels.");}).finally(()=>{if(active)setLoading(false);}); return()=>{active=false;}; },[token]);
  const mainName=baseCard?.reward_name, mainMessage=baseCard?.reward_description;
  useEffect(() => {
    if (mainName===undefined) return;
    setLevels(previous => [...previous.filter(level => level.stamps !== 1), {stamps:1,name:mainName,message:mainMessage ?? ""}].sort((a,b) => a.stamps-b.stamps));
  }, [mainName,mainMessage]);
  function update(stamps:number, field:"name"|"message", value:string) { setMessage("");setLevels(previous=>{const next=previous.filter(level=>level.stamps!==stamps);const old=previous.find(level=>level.stamps===stamps)??{stamps,name:"",message:""};return [...next,{...old,[field]:value}].sort((a,b)=>a.stamps-b.stamps);}); }
  async function save() { if(saving.current||!loaded)return; saving.current=true;setBusy(true);setError("");setMessage("");try {const active=levels.filter(level=>level.stamps===1||level.name.trim()||level.message.trim());const result=await apiFetch<{message:string}>("/business/reward-levels",{token,method:"PUT",body:JSON.stringify({levels:active,main_reward_at_one:true})});setLevels(active);setMessage(result.message);await onSaved?.();}catch(cause){setError(cause instanceof Error?cause.message:"Unable to save levels.");}finally{saving.current=false;setBusy(false);} }
  if(loading)return <Skeleton className="h-96 rounded-2xl"/>;
  const input="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-[#ffc857]/60 disabled:opacity-50";
  return <section className="rounded-2xl border border-[#d6a33d]/25 bg-black/25 p-4 sm:p-6"><div className="flex items-start gap-3"><Gift className="mt-1 size-5 shrink-0 text-[#ffc857]"/><div><h2 className="text-lg font-semibold">10 reward milestones</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Your main reward is the first milestone: 1 stamp. Configure levels 2–10 below, or leave them empty to skip them. Saving sets the main reward to 1 stamp; collected stamps are kept.</p></div></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2">{Array.from({length:10},(_,i)=>i+1).map(stamps=>{const level=levels.find(row=>row.stamps===stamps);return <div key={stamps} className="space-y-3 rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-center justify-between"><p className="font-semibold text-[#ffc857]">{stamps} {stamps===1?"stamp":"stamps"}</p><span className="text-xs text-white/40">{stamps===1?"Main reward":level?.name.trim()?"Available goal":"Not offered"}</span></div><div><label htmlFor={`level-${stamps}-name`} className="mb-1.5 block text-xs font-medium">Reward</label><input id={`level-${stamps}-name`} maxLength={120} disabled={busy} value={level?.name??""} onChange={e=>update(stamps,"name",e.target.value)} placeholder="e.g. 10% off your next purchase" className={input}/></div><div><label htmlFor={`level-${stamps}-message`} className="mb-1.5 block text-xs font-medium">Details for the customer</label><textarea id={`level-${stamps}-message`} rows={2} maxLength={160} disabled={busy} value={level?.message??""} onChange={e=>update(stamps,"message",e.target.value)} placeholder="Explain the benefit and its conditions" className={input}/></div></div>;})}</div>
    {error?<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>:null}{message?<p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>:null}<div className="mt-5 flex justify-end"><Button disabled={busy||!loaded} onClick={()=>void save()}><Save className="size-4"/>{busy?"Saving…":"Save reward levels"}</Button></div>
  </section>;
}
