"use client";
import {useEffect} from "react";
export type AppRole="customer"|"business"|"admin";
export type BrowserInstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};
const captured:Partial<Record<AppRole,BrowserInstallPrompt>>={};
const installedWindowRoleKey="loyvance:installed-pwa-window-role";
const isRole=(role:string|null):role is AppRole=>role==="customer"||role==="business"||role==="admin";
export function getInstalledWindowRole():AppRole|null{
 try{
  const value=window.sessionStorage.getItem(installedWindowRoleKey);
  return isRole(value)?value:null;
 }catch{return null;}
}
export function isStandaloneWindow(){
 if(typeof window==="undefined")return false;
 return window.matchMedia("(display-mode: standalone)").matches||
  Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
}

export function getRoleInstallPrompt(role:AppRole){return captured[role]||null;}
export function clearRoleInstallPrompt(role:AppRole){delete captured[role];}
export function RoleInstallCapture({role}:{role:AppRole}){
 useEffect(()=>{
  // Track which installed application's window was launched. Standalone mode
  // by itself is NOT evidence that the currently viewed role is installed.
  // A customer app can navigate to the Admin panel on the same origin.
  if(isStandaloneWindow()){
    const launchRole=new URLSearchParams(window.location.search).get("loyvance_app");
    try{
      if(launchRole===role)window.sessionStorage.setItem(installedWindowRoleKey,role);
      else if(!getInstalledWindowRole())window.sessionStorage.setItem(installedWindowRoleKey,role);
    }catch{/* Still allow installation help when browser storage is disabled. */}
    window.dispatchEvent(new Event("loyvance-pwa-context"));
  }
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
