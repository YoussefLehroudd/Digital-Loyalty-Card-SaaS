"use client";
import {useEffect,useState} from "react";
import {BellRing,Smartphone,Send} from "lucide-react";
import {apiFetch} from "@/lib/api";
import {supportsWebPush,isIosPwaRequired,registeredSubscription} from "@/lib/web-push-client";
type Config={configured:boolean;public_key:string|null};
const bytes=(key:string)=>Uint8Array.from(atob(key.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-key.length%4)%4)),c=>c.charCodeAt(0));
export function PushTestPanel({token}:{token:string|null|undefined}){
 const [config,setConfig]=useState<Config|null>(null);
 const [subscribed,setSubscribed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{if(!token)return;let active=true;
  void (async()=>{try{
   const c=await apiFetch<Config>("/push-test/config",{token,cache:"no-store"});
   const sub=await registeredSubscription();
   const state=sub?await apiFetch<{subscribed:boolean}>("/push-test/device?endpoint="+encodeURIComponent(sub.endpoint),{token,cache:"no-store"}):null;
   if(active){setConfig(c);setSubscribed(!!state?.subscribed);}
  }catch(e){if(active)setError(e instanceof Error?e.message:"Cannot check push configuration.");}})();
  return ()=>{active=false};
 },[token]);
 const enable=async()=>{
  if(!token||!config?.public_key)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(!supportsWebPush())throw Error("Web Push requires HTTPS and a supported browser.");
   if(isIosPwaRequired())throw Error("Install the app on your Home Screen first.");
   if(Notification.permission==="denied")throw Error("Notifications are blocked in Android settings.");
   const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
   if(permission!=="granted")throw Error("Notification permission was not granted.");
   const sw=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
   const ready=await navigator.serviceWorker.ready;
   const existing=await ready.pushManager.getSubscription();
   const sub=existing??await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(config.public_key)});
   await apiFetch("/push-test/subscribe",{token,method:"POST",body:JSON.stringify({subscription:sub.toJSON()})});
   setSubscribed(true);setNotice("This device is registered. Tap Send test notification.");
  }catch(e){setError(e instanceof Error?e.message:"Could not enable notifications.");}
  finally{setBusy(false);}
 };
 const send=async()=>{
  if(!token)return;setBusy(true);setError("");setNotice("");
  try{
   const sub=await registeredSubscription();
   if(!sub)throw Error("No push subscription on this device. Enable notifications first.");
   const result=await apiFetch<{accepted:boolean;message:string}>("/push-test/send",{token,method:"POST",body:JSON.stringify({endpoint:sub.endpoint})});
   setNotice(result.message);
  }catch(e){setError(e instanceof Error?e.message:"Test failed.");}finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-[#e7b354]/25 bg-[#e7b354]/5 p-4 sm:p-5" aria-label="Test phone notifications">
  <div className="flex items-center gap-2"><BellRing className="size-5 text-[#e7b354]"/><h2 className="font-semibold">Test phone notification</h2></div>
  <p className="mt-2 text-sm opacity-75">Send a real Web Push to this device only. No customer campaigns are created.</p>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={busy||!token||config?.configured!==true||!supportsWebPush()} onClick={()=>void enable()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e7b354]/40 px-4 text-sm font-semibold disabled:opacity-40"><Smartphone className="size-4"/>{subscribed?"Re-register this device":"Enable on this device"}</button>
   <button type="button" disabled={busy||!token||!subscribed||config?.configured!==true} onClick={()=>void send()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e7b354] px-4 text-sm font-semibold text-black disabled:opacity-40"><Send className="size-4"/>{busy?"Working…":"Send test notification"}</button>
  </div>
  {config&&!config.configured?<p role="alert" className="mt-3 text-sm text-amber-500">VAPID is not configured on this server. Add the VAPID environment variables in Vercel first.</p>:null}
  {notice?<p role="status" className="mt-3 text-sm text-emerald-500">{notice}</p>:null}
  {error?<p role="alert" className="mt-3 text-sm text-red-500">{error}</p>:null}
  <p className="mt-2 text-xs opacity-60">An accepted push request does not guarantee Android displayed it. Lock your screen to check delivery.</p>
 </section>;
}
