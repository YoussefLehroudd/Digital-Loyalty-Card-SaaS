"use client";
import {useEffect,useRef,useState} from "react";
import {Download,Smartphone,ShieldCheck,CheckCircle2,ExternalLink,Share2,Copy,Globe2,Check} from "lucide-react";
import {Modal} from "@/components/ui/modal";
import {AccountPasskeySettings} from "@/components/pwa/account-passkey-settings";
import {getRoleInstallPrompt,clearRoleInstallPrompt,getInstalledWindowRole,isStandaloneWindow,type BrowserInstallPrompt} from "@/components/pwa/role-install-capture";
type Role="customer"|"business"|"admin";
type InstallPrompt=BrowserInstallPrompt;
const roles={
 customer:{name:"LOYVANCE Wallet",url:"/user/dashboard",manifest:"/customer-app.webmanifest",icon:"/pwa-app-icon/customer/192"},
 business:{name:"LOYVANCE Business",url:"/dashboard",manifest:"/business-app.webmanifest",icon:"/pwa-app-icon/business/192"},
 admin:{name:"LOYVANCE Admin Hub",url:"/admin",manifest:"/admin-app.webmanifest",icon:"/pwa-app-icon/admin/192"}
};
export function RoleAppInstallPanel({role,token}:{role:Role;token:string|null}){
 const app=roles[role],prompt=useRef<InstallPrompt|null>(null);
 const [available,setAvailable]=useState(false),[standalone,setStandalone]=useState(false),[otherAppWindow,setOtherAppWindow]=useState(false),[ios,setIos]=useState(false);
 const [android,setAndroid]=useState(false),[mobile,setMobile]=useState(false),[inAppBrowser,setInAppBrowser]=useState(false);
 const [busy,setBusy]=useState(false),[instructions,setInstructions]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const media=window.matchMedia("(display-mode:standalone)");
  const check=()=>{
    const inStandalone=isStandaloneWindow();
    const windowRole=getInstalledWindowRole();
    setStandalone(inStandalone&&windowRole===role);
    setOtherAppWindow(inStandalone&&windowRole!==role);
  };
  const onPrompt=(event:Event)=>{event.preventDefault();prompt.current=event as InstallPrompt;setAvailable(true);};
  const onInstalled=()=>{check();setNotice("App installed successfully.");setAvailable(false);prompt.current=null;};
  check();
  const ua=navigator.userAgent;
  setIos(/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1));
  setAndroid(/Android/i.test(ua));
  setMobile(/Android|iPhone|iPad|iPod/i.test(ua));
  setInAppBrowser(/Instagram|FBAN|FBAV|FB_IAB|TikTok|BytedanceWebview|WhatsApp|Line\/|Telegram|Snapchat/i.test(ua));
  const sync=()=>setAvailable(Boolean(getRoleInstallPrompt(role)));
  sync();window.addEventListener("loyvance-install-prompt",sync);
  window.addEventListener("loyvance-pwa-context",check);
  window.addEventListener("beforeinstallprompt",onPrompt);
  window.addEventListener("appinstalled",onInstalled);
  media.addEventListener("change",check);
  return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled);window.removeEventListener("loyvance-install-prompt",sync);window.removeEventListener("loyvance-pwa-context",check);media.removeEventListener("change",check);};
 },[role]);
 const install=async()=>{
  if(standalone){setNotice("This exact app is already open as an installed PWA.");return;}
  if(otherAppWindow){setNotice("You are inside another LOYVANCE app. Open this page in Chrome or Safari to install a second one.");setInstructions(true);return;}
  const ev=prompt.current||getRoleInstallPrompt(role);
  if(!ev){setNotice("This browser cannot open the automatic installer. Follow the steps shown here.");setInstructions(true);return;}
  setBusy(true);
  try{
   await ev.prompt();const choice=await ev.userChoice;
   if(choice.outcome==="accepted"){setAvailable(false);setNotice("Installation accepted. Find the app on your Home Screen.");}
   else {setNotice("Installation cancelled. You can also install from the browser menu.");setInstructions(true);}
  }catch{setNotice("The automatic installation prompt is unavailable. Use the browser steps.");setInstructions(true);}finally{prompt.current=null;clearRoleInstallPrompt(role);setBusy(false);}
 };
 const copyInstallLink=async()=>{
  const installPath=role==="customer"?"/user/install":role==="business"?"/dashboard/app":"/admin/app";
  try{
   await navigator.clipboard.writeText(window.location.origin+installPath);
   setNotice("Installation link copied. Paste it into your phone browser.");
  }catch{
   setNotice("Copy this address from the browser bar: "+window.location.origin+installPath);
  }
 };
 return <div className="space-y-5">
  <section className="rounded-2xl border border-[#edbc62]/25 bg-[#11130f] p-5 sm:p-6">
   <div className="flex items-center gap-4"><img src={app.icon} width={64} height={64} alt="LOYVANCE app icon" className="size-16 rounded-2xl border border-[#edbc62]/20"/>
    <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.19em] text-[#edbc62]">INSTALL YOUR APP</p><h2 className="mt-1 text-xl font-bold text-white">{app.name}</h2><p className="mt-1 text-sm text-white/55">Launch your own workspace from the Home Screen.</p></div>
   </div>
   {otherAppWindow?<div role="status" className="mt-4 rounded-xl border border-[#edbc62]/25 bg-[#edbc62]/10 p-3 text-sm leading-6 text-[#edbc62]">
      You are currently using a different installed LOYVANCE app. To install <strong>{app.name}</strong> as a second app, open this page in your normal browser.
   </div>:null}
   <p className="mt-4 text-sm leading-6 text-white/65">
     {role==="admin"?"Install the separate administrator PWA to launch the private platform panel. Only authorized administrators can access its data.":role==="business"?"Open your business tools, QR scanner and dashboard quickly, without searching for the website.":"Keep your loyalty cards, rewards and QR code one tap away on your phone."}
   </p>
   <div className="mt-4 flex flex-wrap gap-3">
    <button type="button" disabled={busy||standalone} onClick={()=>void install()} className="flex items-center gap-2 rounded-xl bg-[#edbc62] px-5 py-3 text-sm font-bold text-black disabled:opacity-55">
     {standalone?<CheckCircle2 className="size-5"/>:<Download className="size-5"/>}{standalone?"This app is open":otherAppWindow?"Install as separate app":busy?"Opening installer…":"Install "+app.name}
    </button>
    <button type="button" onClick={()=>setInstructions(v=>!v)} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/75">Installation help</button>
    <a href={app.url} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-white/75"><ExternalLink className="size-4"/>Open workspace</a>
   </div>
   {notice?<p role="status" className="mt-4 text-sm text-[#edbc62]">{notice}</p>:null}
   {!available&&!standalone?<p className="mt-3 text-xs text-white/50">{mobile?"If the phone browser does not offer a one-tap installer, tap Install to see clear phone-specific steps.":"If the browser does not offer a one-tap installer, use its menu (Install app / Add to Home Screen)."} This is a PWA, not an APK.</p>:null}
   <Modal isOpen={instructions} onClose={()=>setInstructions(false)} title={"Install "+app.name} description="Follow these steps to add this app to your Home Screen." icon={<Smartphone className="size-6"/>}>
     <div className="space-y-4">
       {otherAppWindow?<div className="rounded-xl border border-[#edbc62]/25 bg-[#edbc62]/10 p-3 text-xs leading-5 text-[#edbc62]">Copy the link below and open it in Chrome (Android) or Safari (iPhone), outside the already-installed application. Then install <strong>{app.name}</strong> using its own name and icon.</div>:null}
       {inAppBrowser?<div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">You are viewing Loyvance inside another app. Open the browser menu and choose <strong>Open in browser</strong>. Use Chrome on Android or Safari on iPhone to install.</div>:null}
       {ios?<ol className="list-decimal space-y-3 ps-5 text-sm leading-6 text-white/80">
          <li>Open this install page in <strong className="text-white">Safari</strong>.</li>
          <li>Tap <Share2 className="inline size-4 text-[#edbc62]"/> <strong className="text-white">Share</strong> (square with upward arrow).</li>
          <li>Select <strong className="text-white">Add to Home Screen</strong>. Scroll in the Share menu if needed.</li>
          <li>Keep <strong className="text-white">Open as Web App</strong> enabled when offered, then tap <strong className="text-white">Add</strong>.</li>
        </ol>:android?<ol className="list-decimal space-y-3 ps-5 text-sm leading-6 text-white/80">
          <li>Open this page directly in <strong className="text-white">Chrome</strong> (or a browser that supports PWA installation).</li>
          <li>Tap the browser menu <strong className="text-white">⋮</strong> (usually in the top-right corner).</li>
          <li>Tap <strong className="text-white">Install app</strong>, or <strong className="text-white">Add to Home screen</strong> if that is the available option.</li>
          <li>Confirm <strong className="text-white">Install / Add</strong> to create the Home Screen icon.</li>
        </ol>:<ol className="list-decimal space-y-3 ps-5 text-sm leading-6 text-white/80">
          <li>Open this page in Chrome or Microsoft Edge.</li>
          <li>Select the <strong className="text-white">Install</strong> icon in the address bar, or use the browser menu → Install app.</li>
          <li>Confirm installation to open {app.name} in its own window.</li>
        </ol>}
       {android?<p className="flex items-start gap-2 rounded-xl border border-white/10 p-3 text-xs leading-5 text-white/60"><Globe2 className="mt-0.5 size-4 shrink-0 text-[#edbc62]"/>Some Android browsers, including in-app browsers, do not expose the automatic install popup. The menu method is the reliable alternative.</p>:null}
       <p className="text-xs leading-5 text-white/50">Each role has a separate manifest, icon and name. Install from this {role} page in the normal browser to create another shortcut. Login and role permissions still apply.</p>
       <div className="flex flex-wrap gap-2 pt-2">
         <button type="button" onClick={()=>void copyInstallLink()} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#edbc62]/30 px-4 py-2.5 text-sm font-semibold text-[#edbc62]"><Copy className="size-4"/>Copy installation link</button>
         <button type="button" onClick={()=>setInstructions(false)} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#edbc62] px-4 py-2.5 text-sm font-bold text-black"><Check className="size-4"/>Got it</button>
       </div>
       {notice?<p role="status" className="text-xs text-[#edbc62]">{notice}</p>:null}
     </div>
   </Modal>
   <p className="mt-4 flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="size-4"/>Separate installation does not bypass login or role permissions. The normal account session remains server-verified.</p>
  </section>
  <AccountPasskeySettings token={token} elevated={role!=="customer"}/>
  <p className="text-xs leading-5 text-white/45"><Smartphone className="me-1 inline size-4"/>Stay signed in during ordinary app closes. Fingerprint / Face ID is an optional secure way to sign in again after the session expires or when signing into a new device.</p>
 </div>;
}
