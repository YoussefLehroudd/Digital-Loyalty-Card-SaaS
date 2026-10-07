"use client";
import { useEffect, useRef, useState } from "react";
import { Gift, Check, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { CustomerCardItem } from "@/lib/customerAuth";

export function RewardGoalChooser({card,token,onSaved}:{card:CustomerCardItem;token:string|null;onSaved:()=>void|Promise<unknown>}) {
  const [open,setOpen]=useState(false),[draft,setDraft]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const seen=useRef(new Set<string>()),saving=useRef(false);
  const levels=card.loyalty_card?.reward_levels??[],goal=card.loyalty_card?.selected_goal??null,current=card.loyalty?.current_stamps??0;
  const offered=levels.length>0;
  useEffect(()=>{if(offered&&!card.loyalty_card?.goal_confirmed&&!seen.current.has(card.id)){seen.current.add(card.id);setDraft(null);setError("");setOpen(true);}},[card.id,card.loyalty_card?.goal_confirmed,goal,offered]);
  if(!offered)return null;
  const chosen=levels.find(level=>level.stamps===draft);
  async function save(){if(!token||!chosen||saving.current)return;saving.current=true;setBusy(true);setError("");try{await apiFetch(`/user/cards/${card.id}/goal`,{token,method:"PATCH",body:JSON.stringify({stamps:chosen.stamps})});await onSaved();setOpen(false);}catch(cause){setError(cause instanceof Error?cause.message:"Unable to change your reward goal.");}finally{saving.current=false;setBusy(false);}}
  return <><Button type="button" variant="outline" size="icon" aria-label="Choose or edit reward goal" title="Choose or edit reward goal" className="relative z-50 size-9 shrink-0 rounded-full border-[#e7b354]/45 bg-black/85 text-[#ffc857] shadow-lg hover:bg-black" onPointerDown={event=>event.stopPropagation()} onTouchStart={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setDraft(card.loyalty_card?.goal_confirmed?goal:null);setError("");setOpen(true);}}><Pencil className="size-4"/></Button><Modal isOpen={open} onClose={()=>setOpen(false)} closeDisabled={busy||!card.loyalty_card?.goal_confirmed} className="sm:max-w-2xl" title="Choose your reward goal" description={card.business.name} icon={<Gift className="size-6"/>}>
    <p className="mb-4 text-sm leading-6 text-white/60">You have <span className="font-semibold text-[#ffc857]">{current} stamps</span>. Select how many stamps you want to collect and read the reward details below. Changing your goal keeps your stamps. The business deducts the selected reward’s stamps when you redeem.</p>
    <div className="grid gap-3 sm:grid-cols-2">{levels.map(level=><button type="button" key={level.stamps} disabled={busy} aria-pressed={draft===level.stamps} onClick={()=>setDraft(level.stamps)} className={`rounded-xl border p-4 text-left transition ${draft===level.stamps?"border-[#ffc857]/70 bg-[#ffc857]/10":"border-white/10 bg-white/[.025] hover:border-white/30"}`}><span className="flex items-center justify-between text-sm font-semibold text-[#ffc857]">{level.stamps} {level.stamps===1?"stamp":"stamps"}{draft===level.stamps?<Check className="size-4"/>:null}</span><span className="mt-2 block break-words text-sm font-semibold">{level.name}</span><span className="mt-1 block whitespace-pre-wrap break-words text-xs leading-5 text-white/55">{level.message}</span><span className="mt-3 block text-xs text-white/45">{current>=level.stamps?"Ready to redeem":`${level.stamps-current} more stamps to collect`}</span></button>)}</div>
    {error?<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>:null}<div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">{card.loyalty_card?.goal_confirmed?<Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Keep current goal</Button>:null}<Button disabled={busy||!chosen} onClick={()=>void save()}>{busy?"Saving…":draft?`Choose ${draft} stamps`:"Select a reward"}</Button></div>
  </Modal></>;
}
