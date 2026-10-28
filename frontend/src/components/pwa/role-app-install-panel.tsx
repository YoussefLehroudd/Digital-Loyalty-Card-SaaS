"use client";
import {useEffect,useRef,useState} from "react";
import {Download,Smartphone,ShieldCheck,CheckCircle2,ExternalLink} from "lucide-react";
import {AccountPasskeySettings} from "@/components/pwa/account-passkey-settings";
import {getRoleInstallPrompt,clearRoleInstallPrompt,type BrowserInstallPrompt} from "@/components/pwa/role-install-capture";
type Role="customer"|"business"|"admin";
type InstallPrompt=BrowserInstallPrompt;
const roles={
 customer:{name:"LOYVANCE Customer",url:"/user/dashboard",manifest:"/customer-app.webmanifest",icon:"/pwa/icon-192.png"},
 business:{name:"LOYVANCE Business",url:"/dashboard",manifest:"/business-app.webmanifest",icon:"/pwa/icon-192.png"},
 admin:{name:"LOYVANCE Admin",url:"/admin",manifest:"/admin-app.webmanifest",icon:"/pwa/icon-192.png"}
};
export function RoleAppInstallPanel({role,token}:{role:Role;token:string|null}){
 const app=roles[role],prompt=useRef<InstallPrompt|null>(null);
 const [available,setAvailable]=useState(false),[standalone,setStandalone]=useState(false),[ios,setIos]=useState(false);
 const [busy,setBusy]=useState(false),[instructions,setInstructions]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const media=window.matchMedia("(display-mode:standalone)");
  const check=()=>setStandalone(media.matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  const onPrompt=(event:Event)=>{event.preventDefault();prompt.current=event as InstallPrompt;setAvailable(true);};
  const onInstalled=()=>{check();setNotice("App installed successfully.");setAvailable(false);prompt.current=null;};
  check();setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  const sync=()=>setAvailable(Boolean(getRoleInstallPrompt(role)));
  sync();window.addEventListener("loyvance-install-prompt",sync);
  window.addEventListener("beforeinstallprompt",onPrompt);
  window.addEventListener("appinstalled",onInstalled);
  media.addEventListener("change",check);
  return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);window.removeEventListener("loyvance-install-prompt",sync);media.removeEventListener("change",check);};
 },[role]);
 const install=async()=>{
  if(standalone){setNotice("You are already using the installed app.");return;}
  const ev=prompt.current||getRoleInstallPrompt(role);
  if(!ev){setInstructions(true);return;}
  setBusy(true);
  try{
   await ev.prompt();const choice=await ev.userChoice;
   if(choice.outcome==="accepted"){setAvailable(false);setNotice("Installation accepted. Find the app on your Home Screen.");}
   else setInstructions(true);
  }catch{setInstructions(true);}finally{prompt.current=null;clearRoleInstallPrompt(role);setBusy(false);}
 };
 return <div className="space-y-5">
  <section className="rounded-2xl border border-[#edbc62]/25 bg-[#11130f] p-5 sm:p-6">
   <div className="flex items-center gap-4"><img src={app.icon} width={64} height={64} alt="LOYVANCE app icon" className="size-16 rounded-2xl border border-[#edbc62]/20"/>
    <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.19em] text-[#edbc62]">INSTALL YOUR APP</p><h2 className="mt-1 text-xl font-bold text-white">{app.name}</h2><p className="mt-1 text-sm text-white/55">Launch your own workspace from the Home Screen.</p></div>
   </div>
   <p className="mt-4 text-sm leading-6 text-white/65">
     {role==="admin"?"Install the separate administrator PWA to launch the private platform panel. Only authorized administrators can access its data.":role==="business"?"Open your business tools, QR scanner and dashboard quickly, without searching for the website.":"Keep your loyalty cards, rewards and QR code one tap away on your phone."}
   </p>
   <div className="mt-4 flex flex-wrap gap-3">
    <button type="button" disabled={busy||standalone} onClick={()=>void install()} className="flex items-center gap-2 rounded-xl bg-[#edbc62] px-5 py-3 text-sm font-bold text-black disabled:opacity-55">
     {standalone?<CheckCircle2 className="size-5"/>:<Download className="size-5"/>}{standalone?"App already installed":busy?"Opening installer…":"Install "+app.name}
    </button>
    <button type="button" onClick={()=>setInstructions(v=>!v)} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/75">Installation help</button>
    <a href={app.url} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-white/75"><ExternalLink className="size-4"/>Open workspace</a>
   </div>
   {notice?<p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>:null}
   {!available&&!standalone?<p className="mt-3 text-xs text-white/50">If the browser does not offer a one-tap installer, use its menu (Install app / Add to Home Screen). This is an installable PWA, not a downloadable Android APK.</p>:null}
   {instructions?<div className="mt-4 rounded-xl border border-[#edbc62]/15 bg-black/20 p-4 text-sm leading-6 text-white/70">
     {ios?<p>iPhone: open this page in Safari, tap Share → Add to Home Screen, and keep Open as Web App enabled. Open the installed icon to use this workspace.</p>:<p>Android: open this page in Chrome, tap ⋮ → Install app (or Add to Home Screen). If available, use the Install button above. On desktop use the install icon in your browser address bar.</p>}
     <p className="mt-2 text-xs text-white/45">Install from this {role} workspace so your device uses the correct app identity and launch screen.</p>
   </div>:null}
   <p className="mt-4 flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="size-4"/>Separate installation does not bypass login or role permissions. The normal account session remains server-verified.</p>
  </section>
  <AccountPasskeySettings token={token}/>
  <p className="text-xs leading-5 text-white/45"><Smartphone className="me-1 inline size-4"/>Stay signed in during ordinary app closes. Fingerprint / Face ID is an optional secure way to sign in again after the session expires or when signing into a new device.</p>
 </div>;
}
