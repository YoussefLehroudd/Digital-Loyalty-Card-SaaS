import {apiFetch} from "@/lib/api";

export type PushConfig={configured:boolean;public_key:string|null};
export type PushDeviceStatus={devices:number};
export function supportsWebPush(){
 return typeof window!=="undefined" && window.isSecureContext &&
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function isIosPwaRequired(){
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
 const standalone=window.matchMedia("(display-mode: standalone)").matches||
  Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
 return ios&&!standalone;
}
export async function registeredSubscription(){
 if(!supportsWebPush())return null;
 const r=await navigator.serviceWorker.getRegistration("/");
 return r?await r.pushManager.getSubscription():null;
}
function publicKeyBytes(key:string){
 const chars=atob(key.replace(/-/g,"+").replace(/_/g,"/")+
  "=".repeat((4-key.length%4)%4));
 return Uint8Array.from(chars,c=>c.charCodeAt(0));
}
// Request permission directly from the button handler, before network calls,
// to satisfy browsers requiring a user gesture (especially installed iOS PWAs).
export async function enablePushOnDevice(token:string,publicKey:string){
 if(!supportsWebPush())throw Error("Web Push is unavailable in this browser or on insecure HTTP.");
 if(isIosPwaRequired())throw Error("On iPhone, first add Loyvance to your Home Screen, then open it as an app.");
 if(Notification.permission==="denied")throw Error("Notifications are blocked. Enable them in your phone or browser settings.");
 const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
 if(permission!=="granted")throw Error("Notifications permission was not granted.");
 const r=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
 await navigator.serviceWorker.ready;
 let subscription=await r.pushManager.getSubscription();
 if(!subscription){
  subscription=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKeyBytes(publicKey)});
 }
 try{
  await apiFetch("/user/push/subscriptions",{token,method:"POST",body:JSON.stringify({subscription:subscription.toJSON()})});
 }catch(error){
  // Keep a valid browser subscription so the user can retry without a second prompt.
  throw error;
 }
 return subscription;
}
export async function disablePushOnDevice(token:string){
 const subscription=await registeredSubscription();
 if(!subscription)return;
 await apiFetch("/user/push/subscriptions",{token,method:"DELETE",body:JSON.stringify({endpoint:subscription.endpoint})});
 await subscription.unsubscribe();
}
