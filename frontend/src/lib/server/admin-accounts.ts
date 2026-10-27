import { randomBytes, randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type Q = { (s: TemplateStringsArray, ...args: unknown[]): Promise<Row[]> };
type Admin = {id:string;name:string;business_id:string|null};
type Deps = {hashPassword:(s:string)=>Promise<string>;verifyPassword:(s:string,h:string)=>Promise<boolean>;rateLimit:(bucket:string,limit:number,window:number)=>Promise<Response|null>};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const str=(value:unknown)=>typeof value==="string"?value.trim():"";
const goodName=(s:string)=>s.length>=2&&s.length<=120;
const goodEmail=(s:string)=>s.length<=200&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"business";
const duplicate=(e:unknown)=>e instanceof Error&&/23505|duplicate key|unique constraint/i.test(e.message);
const nameParts=(s:string)=>{const arr=s.split(/\s+/);return {first:arr.shift()||s,last:arr.join(" ")};};

export async function handleAdminAccounts(path:string[],req:Request,sql:Sql,admin:Admin,deps:Deps):Promise<Response>{
 const q=sql as unknown as Q, business=path[1]==="businesses", entity=business?"business":"customer", id=path[2];
 if(id&&!uuid.test(id))return reply({message:"Invalid account identifier."},422);
 const body=await req.json().catch(()=>null) as Row|null;
 if(!body||Array.isArray(body))return reply({message:"Enter valid account details."},422);
 if(req.method==="POST"&&!id){
  const name=str(body.name),email=str(body.email).toLowerCase();
  const password=str(body.password)||randomBytes(15).toString("base64url")+"aA1!";
  if(!goodName(name)||!goodEmail(email)||password.length<10||password.length>200)return reply({message:"Provide a valid name, login email and a password of at least 10 characters."},422);
  if((await q`SELECT id FROM app_users WHERE email=${email} LIMIT 1`).length)return reply({message:"This login email is already registered."},409);
  const hash=await deps.hashPassword(password),userId=randomUUID(),phone=str(body.phone).slice(0,40)||null, auditId=randomUUID();
  try{
   if(business){
    const businessName=str(body.business_name),businessEmail=str(body.business_email).toLowerCase();
    if(!goodName(businessName)||!goodEmail(businessEmail))return reply({message:"Provide a valid business name and contact email."},422);
    const businessId=randomUUID(),cardId=randomUUID(),businessSlug=slug(businessName)+"-"+randomBytes(4).toString("hex"),address=str(body.address).slice(0,240)||null;
    await sql.transaction([
     sql`INSERT INTO businesses(id,slug,name,email,phone,address,primary_color) VALUES(${businessId},${businessSlug},${businessName},${businessEmail},${phone},${address},'#111827')`,
     sql`INSERT INTO app_users(id,business_id,name,email,password_hash,role) VALUES(${userId},${businessId},${name},${email},${hash},'business_owner')`,
     sql`INSERT INTO loyalty_cards(id,business_id,reward_name,required_stamps,reward_description) VALUES(${cardId},${businessId},'Free Coffee',10,'Collect stamps to unlock your reward.')`,
     sql`INSERT INTO business_subscriptions(business_id,trial_started_at,trial_ends_at) VALUES(${businessId},now(),now()+interval '14 days') ON CONFLICT(business_id) DO NOTHING`,
     sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(${auditId},${admin.id},${admin.name},'admin_create','business',${businessId},${businessName},'Created by platform admin')`
    ]);
    return reply({message:"Business account created with 14-day trial.",id:businessId,temporary_password:password},201);
   }
   const parts=nameParts(name);
   await sql.transaction([
    sql`INSERT INTO app_users(id,name,email,password_hash,role) VALUES(${userId},${name},${email},${hash},'customer')`,
    sql`INSERT INTO customer_profiles(user_id,first_name,last_name,phone) VALUES(${userId},${parts.first},${parts.last},${phone})`,
    sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(${auditId},${admin.id},${admin.name},'admin_create','customer',${userId},${name},'Created by platform admin')`
   ]);
   return reply({message:"Customer account created.",id:userId,temporary_password:password},201);
  }catch(e){if(duplicate(e))return reply({message:"An account with these details already exists."},409);throw e;}
 }
 if(!id)return reply({message:"Account ID required."},422);
 if(req.method==="PUT"){
  const name=str(body.name),email=str(body.email).toLowerCase(),password=str(body.password),phone=str(body.phone).slice(0,40)||null;
  if(!goodName(name)||(business&&!goodEmail(email)))return reply({message:"A valid name and login email are required."},422);
  if(password&&(password.length<10||password.length>200))return reply({message:"New password must be at least 10 characters."},422);
  const hash=password?await deps.hashPassword(password):null,auditId=randomUUID();
  try{
   if(business){
    const current=(await q`SELECT id,name FROM businesses WHERE id=${id} LIMIT 1`)[0];
    if(!current)return reply({message:"Business not found."},404);
    const owners=await q`SELECT id,name,email FROM app_users WHERE business_id=${id}::uuid AND role='business_owner' ORDER BY created_at LIMIT 2`;
    if(owners.length!==1)return reply({message:"Cannot safely edit credentials: this business has no unique owner account."},409);
    const ownerName=str(body.owner_name),contact=str(body.business_email).toLowerCase(),address=str(body.address).slice(0,240)||null;
    if(!goodName(ownerName)||!goodEmail(contact))return reply({message:"Valid owner name and business contact email required."},422);
    if((await q`SELECT id FROM app_users WHERE email=${email} AND id<>${owners[0].id}::uuid LIMIT 1`).length)return reply({message:"Owner login email already exists."},409);
    const revoke=Boolean(hash)||email!==owners[0].email;
    await sql.transaction([
     sql`UPDATE businesses SET name=${name},email=${contact},phone=${phone},address=${address},updated_at=now() WHERE id=${id}::uuid`,
     sql`UPDATE app_users SET name=${ownerName},email=${email},password_hash=COALESCE(${hash},password_hash),updated_at=now() WHERE id=${owners[0].id}::uuid`,
     sql`DELETE FROM user_sessions WHERE user_id=${owners[0].id}::uuid AND ${revoke}`,
     sql`DELETE FROM password_reset_tokens WHERE user_id=${owners[0].id}::uuid AND ${revoke}`,
     sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(${auditId},${admin.id},${admin.name},'admin_update','business',${id}::uuid,${name},${revoke?'Owner credentials updated':'Profile details updated'})`
    ]);
    return reply({message:"Business and owner updated."+(revoke?" Owner sessions revoked; sign in again.":"")});
   }
   const user=(await q`SELECT id,email FROM app_users WHERE id=${id}::uuid AND role='customer' LIMIT 1`)[0];
   if(!user)return reply({message:"Customer not found."},404);
   const privacy=await q`SELECT EXISTS(SELECT 1 FROM customers c JOIN businesses b ON b.id=c.business_id WHERE c.user_id=${id}::uuid AND b.admin_contact_private=true) AS private`;
   const protectedContact=privacy[0]?.private===true;
   if(protectedContact&&(body.email!==undefined||body.phone!==undefined))return reply({message:"Customer contact details are private. Do not send email or phone updates."},403);
   const effectiveEmail=protectedContact?String(user.email):email;
   if(!goodEmail(effectiveEmail))return reply({message:"Valid customer email required."},422);
   if((await q`SELECT id FROM app_users WHERE email=${effectiveEmail} AND id<>${id}::uuid LIMIT 1`).length)return reply({message:"Email already in use."},409);
   const parts=nameParts(name),revoke=Boolean(hash)||effectiveEmail!==user.email;
   await sql.transaction([
    sql`UPDATE app_users SET name=${name},email=${effectiveEmail},password_hash=COALESCE(${hash},password_hash),updated_at=now() WHERE id=${id}::uuid AND role='customer'`,
    sql`INSERT INTO customer_profiles(user_id,first_name,last_name,phone) VALUES(${id}::uuid,${parts.first},${parts.last},${phone})
      ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,phone=CASE WHEN ${protectedContact} THEN customer_profiles.phone ELSE excluded.phone END,updated_at=now()`,
    sql`UPDATE customers SET first_name=${parts.first},last_name=${parts.last},email=CASE WHEN ${protectedContact} THEN email ELSE ${effectiveEmail} END,phone=CASE WHEN ${protectedContact} THEN phone ELSE ${phone} END,updated_at=now() WHERE user_id=${id}::uuid`,
    sql`DELETE FROM user_sessions WHERE user_id=${id}::uuid AND ${revoke}`,
    sql`DELETE FROM password_reset_tokens WHERE user_id=${id}::uuid AND ${revoke}`,
    sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(${auditId},${admin.id},${admin.name},'admin_update','customer',${id}::uuid,${name},${revoke?'Credentials updated':'Profile details updated'})`
   ]);
   return reply({message:"Customer updated."+(revoke?" Sessions revoked; customer must sign in again.":"")});
  }catch(e){if(duplicate(e))return reply({message:"Email already in use."},409);throw e;}
 }
 if(req.method==="DELETE"){
  const limited=await deps.rateLimit("admin-permanent-delete",8,60*60*1000);if(limited)return limited;
  const target=business?(await q`SELECT id,name FROM businesses WHERE id=${id}::uuid LIMIT 1`)[0]:(await q`SELECT id,name FROM app_users WHERE id=${id}::uuid AND role='customer' LIMIT 1`)[0];
  if(!target)return reply({message:"Account not found."},404);
  if(id===admin.id||(business&&id===admin.business_id))return reply({message:"You cannot delete your own administrator account."},403);
  if(str(body.confirm_name)!==target.name)return reply({message:"Type the exact name to confirm permanent deletion."},422);
  const current=(await q`SELECT password_hash FROM app_users WHERE id=${admin.id}::uuid LIMIT 1`)[0];
  if(!str(body.admin_password)||!current||!(await deps.verifyPassword(str(body.admin_password),String(current.password_hash))))return reply({message:"Administrator password confirmation failed."},403);
  if(business){
   const money=await q`SELECT EXISTS(
     SELECT 1 FROM subscription_events WHERE business_id=${id}::uuid AND (amount_centimes>0 OR receipt_number IS NOT NULL)
     UNION ALL SELECT 1 FROM affiliate_commissions WHERE business_id=${id}::uuid
   ) AS protected`;
   if(money[0]?.protected)return reply({message:"Permanent deletion is blocked: this business has payment receipts or affiliate commissions. Suspend it to preserve the financial records."},409);
   await sql.transaction([
    sql`UPDATE affiliate_partners SET is_active=false WHERE user_id IN (SELECT id FROM app_users WHERE business_id=${id}::uuid AND role='business_owner')`,
    sql`DELETE FROM affiliate_sessions WHERE affiliate_id IN (SELECT p.id FROM affiliate_partners p JOIN app_users u ON u.id=p.user_id WHERE u.business_id=${id}::uuid AND u.role='business_owner')`,
    sql`DELETE FROM app_users WHERE business_id=${id}::uuid AND role='business_owner'`,
    sql`DELETE FROM businesses WHERE id=${id}::uuid`,
    sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(${randomUUID()},${admin.id},${admin.name},'admin_delete','business',${id}::uuid,${String(target.name)},'Permanent deletion by admin')`
   ]);
   return reply({message:"Business, owners and dependent data permanently deleted."});
  }
  await sql.transaction([
   sql`UPDATE affiliate_partners SET is_active=false WHERE user_id=${id}::uuid`,
   sql`DELETE FROM affiliate_sessions WHERE affiliate_id IN (SELECT id FROM affiliate_partners WHERE user_id=${id}::uuid)`,
   sql`DELETE FROM customers WHERE user_id=${id}::uuid`,
   sql`DELETE FROM app_users WHERE id=${id}::uuid AND role='customer'`,
   sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason) VALUES(${randomUUID()},${admin.id},${admin.name},'admin_delete','customer',${id}::uuid,${String(target.name)},'Permanent deletion by admin')`
  ]);
  return reply({message:"Customer, profile, memberships and activity permanently deleted."});
 }
 return reply({message:"Method not allowed."},405);
}
