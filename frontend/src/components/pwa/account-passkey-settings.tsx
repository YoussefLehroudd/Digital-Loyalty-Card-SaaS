"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useCallback,useEffect,useState} from "react";
import {Fingerprint,ShieldCheck,Trash2,KeyRound} from "lucide-react";
import {canUsePasskeys,registerCustomerPasskey,customerPasskeys,removeCustomerPasskey,type PasskeyDevice} from "@/lib/passkeys-client";
import {Button} from "@/components/ui/button";
export function AccountPasskeySettings({token,elevated=false}:{token:string|null;elevated?:boolean}){
 const {t}=useI18n();
 const [supported,setSupported]=useState(false),[devices,setDevices]=useState<PasskeyDevice[]>([]),[busy,setBusy]=useState(false);
 const [currentPassword,setCurrentPassword]=useState("");
 const [error,setError]=useState(""),[success,setSuccess]=useState("");
 const load=useCallback(async()=>{
  if(!token)return;
  try{setDevices((await customerPasskeys(token)).devices);}catch(e){setError(e instanceof Error?e.message:"Unable to load your passkeys.");}
 },[token]);
 useEffect(()=>{setSupported(canUsePasskeys());void load();},[load]);
 const register=async()=>{
  if(!token)return;
  setBusy(true);setError("");setSuccess("");
  try{
   await registerCustomerPasskey(token,elevated?currentPassword:undefined);
   setCurrentPassword("");
   await load();
   setSuccess("Fingerprint / Face ID passkey is ready. You can use it next time your session expires.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to set up a passkey.");}
  finally{setBusy(false);}
 };
 const remove=async(device:PasskeyDevice)=>{
  if(!token||!window.confirm("Remove this passkey from Loyvance? You can still sign in with your password."))return;
  setBusy(true);setError("");setSuccess("");
  try{await removeCustomerPasskey(token,device.credential_id);await load();setSuccess("Passkey removed from Loyvance.");}
  catch(e){setError(e instanceof Error?e.message:"Unable to remove passkey.");}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-[#e7b354]/20 bg-[#11130f] p-4 sm:p-5">
  <div className="flex items-center gap-3"><Fingerprint className="size-7 text-[#e7b354]"/><div><h2 className="font-semibold text-white">{t("Fingerprint / Face ID login")}</h2><p className="mt-1 text-xs text-white/55">{t("Secure sign-in without typing your password every time.")}</p></div></div>
  <p className="mt-3 text-sm leading-6 text-white/60">{t("Enable a passkey once on your phone. Next time your session expires, use Fingerprint, Face ID or your device screen lock. No fingerprint or face image is shared with Loyvance.")}</p>
  {!supported?<p className="mt-3 text-xs text-amber-300">{t("Passkeys need a compatible device and HTTPS. You can always continue using email and password.")}</p>:null}
  {error?<p className="mt-3 text-sm text-red-300" role="alert">{error}</p>:null}
  {success?<p className="mt-3 text-sm text-emerald-300" role="status">{success}</p>:null}
  {elevated?<label className="mt-4 block text-xs text-white/65">{t("Confirm your account password to protect this privileged workspace")}<input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Current account password" className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm text-white" /></label>:null}
  <Button type="button" disabled={!supported||busy||!token||(elevated&&!currentPassword)} className="mt-4 w-full gap-2 bg-[#e7b354] text-black hover:bg-[#efc775]" onClick={()=>void register()}><KeyRound className="size-4"/>{busy?"Please wait…":"Set up Fingerprint / Face ID"}</Button>
  {devices.length>0?<div className="mt-4 space-y-2"><p className="text-xs font-semibold text-white/55">Saved passkeys ({devices.length})</p>
   {devices.map(d=><div key={d.credential_id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><ShieldCheck className="size-4 shrink-0 text-emerald-400"/><div className="min-w-0 flex-1"><p className="text-sm text-white">{t("Passkey")}</p><p className="text-[11px] text-white/45">Added {new Date(d.created_at).toLocaleDateString("fr-MA")}{d.last_used_at?" · Last used "+new Date(d.last_used_at).toLocaleDateString("fr-MA"):""}</p></div><button type="button" disabled={busy} aria-label="Remove passkey" onClick={()=>void remove(d)} className="rounded-lg border border-white/10 p-2 text-white/70 hover:text-red-300"><Trash2 className="size-4"/></button></div>)}
  </div>:null}
  <p className="mt-4 text-xs text-white/40">{t("Your normal login stays available as a fallback. You can register or remove multiple passkeys from this account.")}</p>
 </section>;
}