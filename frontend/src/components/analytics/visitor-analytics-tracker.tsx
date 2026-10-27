"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const KEY="loyvance.analytics.session.v1";
const DAY=86400000;
const keys=["loyvance_admin_token","digital_loyalty_token","digital_loyalty_customer_token"];
function trackingDisabled(){
 try{
  // Brave enables GPC by default. GPC is an opt-out of selling/sharing personal
  // information with third parties, not a ban on this site's first-party metrics.
  // LOYVANCE neither sells nor shares these analytics records.
  // Still respect the stronger Do Not Track signal and the explicit site opt-out.
  const nav=navigator;
  return nav.doNotTrack==="1"||localStorage.getItem("loyvance.analytics.optout")==="1";
 }catch{return true;}
}
function sessionId(){
 try{
  const stored=JSON.parse(sessionStorage.getItem(KEY)||"null") as {id?:string;created?:number}|null;
  if(stored?.id&&/^[0-9a-f-]{36}$/i.test(stored.id)&&Number(stored.created)>Date.now()-DAY)return stored.id;
  const value={id:crypto.randomUUID(),created:Date.now()};
  sessionStorage.setItem(KEY,JSON.stringify(value));
  return value.id;
 }catch{return crypto.randomUUID();}
}
function destination(input:string){
 try{
  const u=new URL(input,location.href);
  if(!["https:","http:"].includes(u.protocol))return "";
  return u.origin===location.origin?u.pathname.slice(0,180):(u.hostname+u.pathname).slice(0,180);
 }catch{return "";}
}
export function VisitorAnalyticsTracker(){
 const pathname=usePathname();
 const visitor=useRef<string|null>(null);
 const page=useRef("/");
 const active=useRef(0);
 const lastPath=useRef("");
 const send=useRef<(kind:"page"|"click"|"heartbeat",target?:string)=>void>(()=>{});
 useEffect(()=>{
  if(trackingDisabled())return;
  visitor.current=sessionId();
  page.current=location.pathname;
  const sendEvent=(kind:"page"|"click"|"heartbeat",target?:string)=>{
   if(!visitor.current)return;
   const seconds=Math.min(60,active.current);active.current=0;
   let auth="";
   try{for(const k of keys){const v=localStorage.getItem(k);if(v){auth=v;break;}}}catch{}
   const ref=document.referrer;
   const data={
    session_id:visitor.current,type:kind,path:page.current,seconds,
    target:kind==="click"?target||"":undefined,
    referrer:ref?ref.split(/[?#]/)[0]:""
   };
   try{void fetch("/api/visitors/collect",{
     method:"POST",headers:{"Content-Type":"application/json",...(auth?{Authorization:"Bearer "+auth}:{})},
     body:JSON.stringify(data),keepalive:true,cache:"no-store",credentials:"same-origin"
   }).then(response=>{
     if(response.status===409){
       try{sessionStorage.removeItem(KEY);}catch{}
       visitor.current=sessionId();
     }
   }).catch(()=>{});}catch{}
  };
  send.current=sendEvent;
  const onClick=(event:MouseEvent)=>{
   if(!(event.target instanceof Element))return;
   const anchor=event.target.closest("a[href]") as HTMLAnchorElement|null;
   if(!anchor?.href)return;
   const url=destination(anchor.href);
   if(url)send.current("click",url);
  };
  let last=Date.now();
  const interval=window.setInterval(()=>{
   const now=Date.now();
   if(!document.hidden&&document.hasFocus())active.current+=Math.min(15,Math.round((now-last)/1000));
   last=now;
   if(active.current>=15)send.current("heartbeat");
  },15000);
  const onVisibility=()=>{last=Date.now();if(document.hidden&&active.current>0)send.current("heartbeat");};
  const onPageHide=()=>{if(active.current>0)send.current("heartbeat");};
  document.addEventListener("click",onClick,true);
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("pagehide",onPageHide);
  return()=>{
   clearInterval(interval);
   document.removeEventListener("click",onClick,true);
   document.removeEventListener("visibilitychange",onVisibility);
   window.removeEventListener("pagehide",onPageHide);
  };
 },[]);
 useEffect(()=>{
  if(!pathname||lastPath.current===pathname)return;
  lastPath.current=pathname;
  page.current=pathname;
  if(trackingDisabled())return;
  send.current("page");
 },[pathname]);
 return null;
}
