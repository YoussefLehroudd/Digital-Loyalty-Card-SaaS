"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useCallback,useEffect,useState} from "react";
import {BellRing,Send,RefreshCcw} from "lucide-react";
import {useAdmin} from "@/components/admin/admin-shell";
import {adminRequest} from "@/lib/admin";
type Recipient={id:string;name:string;role:string;devices:number};
function AdminNotificationsContent(){
 const {token}=useAdmin();
 const {t:tr}=useI18n();
 const [users,setUsers]=useState<Recipient[]>([]);
 const [configured,setConfigured]=useState(false);
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const load=useCallback(async()=>{setError("");try{const data=await adminRequest<{configured:boolean;users:Recipient[]}>("push-test",token);setUsers(data.users);setConfigured(data.configured);}catch(e){setError(e instanceof Error?e.message:"Could not load devices.");}},[token]);
 useEffect(()=>{void load();},[load]);
 const send=async()=>{if(!selected||busy)return;setBusy(true);setError("");setNotice("");try{
  const r=await adminRequest<{message:string;accepted:number;failed:number}>("push-test",token,{method:"POST",body:JSON.stringify({user_id:selected})});
  setNotice(r.message);
 }catch(e){setError(e instanceof Error?e.message:"Notification test failed.");}finally{setBusy(false);}};
 return <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-7">
  <div className="flex items-center gap-3"><BellRing className="size-7 text-amber-400"/><div><h1 className="text-2xl font-bold">{tr("Test notifications")}</h1><p className="text-sm opacity-65">{tr("Administrator-only Web Push test for registered customer and business devices.")}</p></div></div>
  <section className="space-y-4 rounded-2xl border border-white/15 p-5">
   <div className="flex justify-between gap-3"><h2 className="font-semibold">{tr("Choose a recipient")}</h2><button onClick={()=>void load()} type="button" aria-label={tr("Refresh devices")}><RefreshCcw className="size-4"/></button></div>
   <label className="block text-sm">{tr("Registered account")}<select className="mt-2 w-full rounded-xl border border-white/20 bg-neutral-900 p-3 text-white" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{tr("Select account")}</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} · {u.role==="business_owner"?"Business":"Customer"} · {u.devices} device(s)</option>)}</select></label>
   {!configured?<p role="alert" className="text-sm text-amber-400">{tr("Web Push VAPID configuration is missing on the server.")}</p>:null}
   {!users.length?<p className="text-sm opacity-65">{tr("No registered push-enabled devices. The recipient must enable notifications in their installed app first.")}</p>:null}
   <button onClick={()=>void send()} disabled={!selected||!configured||busy} type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 font-semibold text-black disabled:opacity-40"><Send className="size-4"/>{busy?"Sending…":"Send test notification"}</button>
   {notice?<p role="status" className="text-sm text-emerald-400">{notice}</p>:null}
   {error?<p role="alert" className="text-sm text-red-400">{error}</p>:null}
   <p className="text-xs opacity-60">{tr("A successful request means the browser push provider accepted the message, not that Android displayed it. No marketing campaign is created.")}</p>
  </section>
 </div>;
}
export default function AdminNotificationsPage(){return <AdminNotificationsContent/>;}
