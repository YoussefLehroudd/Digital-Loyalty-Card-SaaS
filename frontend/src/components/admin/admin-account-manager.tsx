"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound, Pencil, Plus, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useAdmin } from "@/components/admin/admin-shell";
import { adminRequest, type AdminDetail, type AdminCustomerDetail, type AdminRow } from "@/lib/admin";

type Kind="businesses"|"customers";
type Mode="create"|"edit"|"delete"|null;
type Target=AdminDetail|AdminCustomerDetail|AdminRow|null;
type Values={name:string;email:string;phone:string;business_name:string;business_email:string;owner_name:string;address:string;password:string};
const empty:Values={name:"",email:"",phone:"",business_name:"",business_email:"",owner_name:"",address:"",password:""};
const field="mt-1.5 w-full min-w-0 rounded-xl border border-white/15 bg-[#0e1114] px-3 py-3 text-sm text-white outline-none transition focus:border-[#efbd5d]/60";
const label="block min-w-0 text-xs font-medium text-white/65";
const button="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/5 disabled:opacity-40";
type Props={kind:Kind;mode:Mode;target:Target;onClose:()=>void;onSaved:(message:string)=>void};
export function AdminAccountManager({kind,mode,target,onClose,onSaved}:Props){
 const {token}=useAdmin(),isBusiness=kind==="businesses",deleting=mode==="delete",creating=mode==="create";
 const [form,setForm]=useState<Values>(empty),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [temporaryPassword,setTemporaryPassword]=useState("");
 const [confirmName,setConfirmName]=useState(""),[adminPassword,setAdminPassword]=useState("");
 useEffect(()=>{
  const item=target as (AdminDetail & {owner_name?:string|null;owner_email?:string|null})|null;
  setForm({
   name:isBusiness?(item?.name??""):(item?.name??""),
   email:isBusiness?(item?.owner_email??""):(item?.email??""),
   phone:item?.contact_details_visible===false?"":item?.phone??"",
   business_name:item?.name??"",business_email:item?.email??"",
   owner_name:item?.owner_name??"",address:item?.address??"",password:""
  });
  setError("");setTemporaryPassword("");setBusy(false);setConfirmName("");setAdminPassword("");
 },[mode,target,kind,isBusiness]);
 const set=(key:keyof Values,value:string)=>setForm(v=>({...v,[key]:value}));
 async function save(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   const payload:Record<string,string>={
    name:form.name,
    ...(isBusiness?{email:form.email,business_name:form.business_name,business_email:form.business_email,owner_name:form.owner_name,address:form.address,phone:form.phone}
      :target?.contact_details_visible===false?{}:{email:form.email,phone:form.phone})
   };
   if(form.password)payload.password=form.password;
   const url=creating?kind:`${kind}/${target?.id}`;
   const result=await adminRequest<{message:string;temporary_password?:string}>(url,token,{method:creating?"POST":"PUT",body:JSON.stringify(payload)});
   onSaved(result.message);
   if(result.temporary_password){setTemporaryPassword(result.temporary_password);setForm(v=>({...v,password:""}));}
   else onClose();
  }catch(e){setError(e instanceof Error?e.message:"Account update failed.");}finally{setBusy(false);}
 }
 async function deleteAccount(event:FormEvent){
  event.preventDefault();if(!target||busy||confirmName!==target.name||!adminPassword)return;
  setBusy(true);setError("");
  try{
   const result=await adminRequest<{message:string}>(`${kind}/${target.id}`,token,{method:"DELETE",body:JSON.stringify({confirm_name:confirmName,admin_password:adminPassword})});
   onSaved(result.message);onClose();
  }catch(e){setError(e instanceof Error?e.message:"Deletion failed.");}finally{setBusy(false);}
 }
 const title=deleting?(isBusiness?"Delete business":"Delete customer"):creating?(isBusiness?"Create business":"Create customer"):(isBusiness?"Edit business & owner":"Edit customer");
 return <Modal isOpen={mode!==null} onClose={onClose} closeDisabled={busy} className="sm:max-w-xl" title={title} description={deleting?target?.name:creating?"Create a new platform account":"Update the existing account details"} icon={deleting?<Trash2 className="size-5 text-rose-300"/>:creating?<Plus className="size-5"/>:<Pencil className="size-5"/>}>
  {error?<p role="alert" className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>:null}
  {temporaryPassword?<div className="space-y-4">
    <div className="flex items-center gap-2 font-semibold text-emerald-300"><CheckCircle2 className="size-5"/>Account successfully created</div>
    <p className="text-xs leading-5 text-white/60">This is the one-time initial password. Copy it now and send it to the user securely. The password is not stored in plaintext or shown again.</p>
    <div className="flex flex-wrap gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-black/30 p-3 font-mono text-sm text-[#efbd5d]">{temporaryPassword}</code>
      <button type="button" className={button} onClick={()=>void navigator.clipboard.writeText(temporaryPassword)}><Copy className="size-4"/>Copy</button>
    </div><button type="button" className={button} onClick={onClose}>Done</button>
   </div>:deleting?<form onSubmit={e=>void deleteAccount(e)} className="space-y-4">
    <div className="rounded-xl border border-rose-400/30 bg-rose-400/[.07] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-rose-300"><ShieldAlert className="size-5"/>Permanent deletion</p>
      <p className="mt-2 text-xs leading-6 text-white/65">{isBusiness?"Deleting a business also deletes its owner login, loyalty cards, membership records, visits and rewards. Other customers' accounts remain. Businesses with recorded payments/commissions cannot be deleted; suspend them instead.":"Deleting a customer removes their login, customer profile, loyalty cards, stamps, visits and rewards across associated businesses. This action cannot be undone."}</p></div>
    <label className={label}>Type the exact name to confirm: <strong className="text-white">{target?.name}</strong>
     <input className={field} autoComplete="off" required value={confirmName} onChange={e=>setConfirmName(e.target.value)}/></label>
    <label className={label}>Confirm your own administrator password
     <input type="password" autoComplete="current-password" className={field} required value={adminPassword} onChange={e=>setAdminPassword(e.target.value)}/></label>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className={button}>Cancel</button>
      <button type="submit" disabled={busy||confirmName!==target?.name||!adminPassword} className={button+" border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"}><Trash2 className="size-4"/>Delete permanently</button></div>
   </form>:<form onSubmit={e=>void save(e)} className="space-y-4">
    {isBusiness?<><div className="text-xs font-bold uppercase tracking-[.14em] text-[#efbd5d]">Business information</div>
       <label className={label}>Business name<input required minLength={2} maxLength={120} className={field} value={creating?form.business_name:form.name} onChange={e=>set(creating?"business_name":"name",e.target.value)}/></label>
       <label className={label}>Business contact email<input type="email" required className={field} value={form.business_email} onChange={e=>set("business_email",e.target.value)}/></label>
       <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Business phone<input className={field} value={form.phone} onChange={e=>set("phone",e.target.value)}/></label><label className={label}>Address<input className={field} value={form.address} onChange={e=>set("address",e.target.value)}/></label></div>
       <div className="border-t border-white/10 pt-4 text-xs font-bold uppercase tracking-[.14em] text-[#efbd5d]">Business owner login</div>
       <label className={label}>Owner full name<input required minLength={2} className={field} value={creating?form.name:form.owner_name} onChange={e=>set(creating?"name":"owner_name",e.target.value)}/></label>
       <label className={label}>Owner login email (may differ from business contact)<input type="email" required className={field} value={form.email} onChange={e=>set("email",e.target.value)}/></label>
     </>:<><label className={label}>Customer full name<input required minLength={2} className={field} value={form.name} onChange={e=>set("name",e.target.value)}/></label>
       {target?.contact_details_visible===false&&!creating?<div className="rounded-xl border border-[#efbd5d]/20 bg-[#efbd5d]/5 p-3 text-xs leading-5 text-[#efbd5d]">This customer's contact details are private. Email and phone cannot be read or edited by administrators; name and password changes are still available.</div>:<>
         <label className={label}>Customer login email<input type="email" required className={field} value={form.email} onChange={e=>set("email",e.target.value)}/></label>
         <label className={label}>Phone<input className={field} value={form.phone} onChange={e=>set("phone",e.target.value)}/></label>
       </>}
     </>}
    <label className={label}><span className="inline-flex items-center gap-2"><KeyRound className="size-4"/> {creating?"Initial password":"Set a new login password"}</span>
     <input type="password" autoComplete="new-password" minLength={10} className={field} value={form.password} onChange={e=>set("password",e.target.value)} placeholder={creating?"Leave blank to generate a secure password":"Leave blank to keep the current password"}/></label>
    <p className="text-xs leading-5 text-white/45">{creating?"New accounts start with regular platform access. Business accounts receive a 14-day trial.":"Changing the login email or password signs the user out of all existing sessions. It does not change loyalty or subscription history."}</p>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} onClick={onClose} disabled={busy}>Cancel</button>
     <button type="submit" disabled={busy} className={button+" border-[#efbd5d]/40 bg-[#efbd5d] text-black hover:bg-[#f9ca76]"}>{busy?"Saving...":creating?"Create account":"Save changes"}</button></div>
   </form>}
 </Modal>;
}
