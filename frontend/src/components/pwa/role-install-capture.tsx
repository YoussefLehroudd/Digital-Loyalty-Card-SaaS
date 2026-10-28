"use client";
import {useEffect} from "react";
export type AppRole="customer"|"business"|"admin";
export type BrowserInstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
const captured:Partial<Record<AppRole,BrowserInstallPrompt>>={};
export function getRoleInstallPrompt(role:AppRole){return captured[role]||null;}
export function clearRoleInstallPrompt(role:AppRole){delete captured[role];}
export function RoleInstallCapture({role}:{role:AppRole}){
 useEffect(()=>{
  // Register the same offline/push Service Worker within authenticated PWA
  // routes too; the marketing install banner is intentionally not mounted here.
  if("serviceWorker" in navigator){
    void navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).catch(()=>{});
  }
  const listener=(event:Event)=>{
   // The event belongs to this role layout's own manifest identity.
   event.preventDefault();captured[role]=event as BrowserInstallPrompt;
   window.dispatchEvent(new Event("loyvance-install-prompt"));
  };
  const installed=()=>{delete captured[role];window.dispatchEvent(new Event("loyvance-install-prompt"));};
  window.addEventListener("beforeinstallprompt",listener);
  window.addEventListener("appinstalled",installed);
  return()=>{window.removeEventListener("beforeinstallprompt",listener);window.removeEventListener("appinstalled",installed);};
 },[role]);
 return null;
}
