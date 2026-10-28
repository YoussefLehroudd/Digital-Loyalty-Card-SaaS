import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";
type Sql=ReturnType<typeof getSql>;
type StaffRecord={id:string;name:string;email:string;active:boolean;created_at:string};
const output=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const idValid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function ensureStaffSchema(sql:Sql){
 await sql`CREATE TABLE IF NOT EXISTS business_staff(
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
 )`;
 await sql`CREATE INDEX IF NOT EXISTS business_staff_business_idx ON business_staff(business_id,active)`;
 // Visits already have an actor in the current stamp handler: keep it on older databases too.
 await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS actor_id uuid`;
 await sql`CREATE INDEX IF NOT EXISTS visits_business_actor_created_idx ON visits(business_id,created_at DESC)`;
}
export async function isActiveCashier(sql:Sql,userId:string,businessId:string){
 const rows=await sql`SELECT s.user_id FROM business_staff s
 JOIN app_users u ON u.id=s.user_id AND u.business_id=s.business_id AND u.role='staff'
 JOIN businesses b ON b.id=s.business_id AND COALESCE(b.status,'active')='active'
 WHERE s.user_id=${userId}::uuid AND s.business_id=${businessId}::uuid AND s.active=true LIMIT 1` as Array<{user_id:string}>;
 return rows.length===1;
}
export async function manageStaff(path:string[],req:Request,sql:Sql,businessId:string,
 hashPassword:(secret:string)=>Promise<string>){
 const id=path[1];
 if(id&&!idValid(id))return output({message:"Invalid staff ID."},422);
 if(req.method==="GET"&&!id){
  const staff=await sql`SELECT u.id,u.name,u.email,s.active,s.created_at::text
   FROM business_staff s JOIN app_users u ON u.id=s.user_id AND u.role='staff' AND u.business_id=s.business_id
   WHERE s.business_id=${businessId}::uuid ORDER BY s.created_at DESC LIMIT 100` as StaffRecord[];
  return output({staff});
 }
 if(req.method==="GET"&&id==="history")return output({message:"Not found."},404);
 if(req.method==="POST"&&!id){
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const name=typeof body?.name==="string"?body.name.trim():"";
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const password=typeof body?.password==="string"?body.password:"";
  if(name.length<2||name.length>100||/[<>]/.test(name)||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||password.length<12||password.length>128)
   return output({message:"Enter a valid employee name, email and password (12–128 characters)."},422);
  const count=await sql`SELECT count(*)::int AS n FROM business_staff WHERE business_id=${businessId}::uuid AND active=true` as Array<{n:number}>;
  if(count[0]?.n>=25)return output({message:"Maximum 25 active staff accounts."},409);
  const existing=await sql`SELECT id FROM app_users WHERE lower(email)=${email} LIMIT 1` as Array<{id:string}>;
  if(existing.length)return output({message:"This email already belongs to another account."},409);
  const hashed=await hashPassword(password),userId=randomUUID();
  try{
   const result=await sql.transaction([
    sql`INSERT INTO app_users(id,business_id,name,email,password_hash,role) VALUES(${userId},${businessId}::uuid,${name},${email},${hashed},'staff') RETURNING id,name,email`,
    sql`INSERT INTO business_staff(user_id,business_id) VALUES(${userId},${businessId}::uuid)`
   ]);
   return output({staff:{...(result[0] as Array<Record<string,unknown>>)[0],active:true}},201);
  }catch(e){if(e instanceof Error&&/unique|duplicate/i.test(e.message))return output({message:"Email already exists."},409);throw e;}
 }
 if(!id)return output({message:"Not found."},404);
 if(req.method==="PATCH"){
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(typeof body?.active!=="boolean")return output({message:"Specify active: true or false."},422);
  const changed=await sql`UPDATE business_staff s SET active=${body.active},updated_at=now()
   WHERE s.user_id=${id}::uuid AND s.business_id=${businessId}::uuid
   AND EXISTS (SELECT 1 FROM app_users u WHERE u.id=s.user_id AND u.role='staff' AND u.business_id=s.business_id)
   RETURNING s.user_id,s.active` as Array<{user_id:string;active:boolean}>;
  if(!changed.length)return output({message:"Staff member not found."},404);
  if(!body.active)await sql`DELETE FROM user_sessions WHERE user_id=${id}::uuid`;
  return output({staff:changed[0]});
 }
 if(req.method==="DELETE"){
  const changed=await sql`UPDATE business_staff s SET active=false,updated_at=now()
   WHERE s.user_id=${id}::uuid AND s.business_id=${businessId}::uuid
   AND EXISTS(SELECT 1 FROM app_users u WHERE u.id=s.user_id AND u.business_id=s.business_id AND u.role='staff') RETURNING s.user_id` as Array<{user_id:string}>;
  if(!changed.length)return output({message:"Staff member not found."},404);
  await sql`DELETE FROM user_sessions WHERE user_id=${id}::uuid`;
  return output({deactivated:true});
 }
 return output({message:"Method not allowed."},405);
}

export async function staffAudit(req:Request,sql:Sql,businessId:string){
 if(req.method!=="GET")return output({message:"Method not allowed."},405);
 const url=new URL(req.url),page=Math.max(0,Math.min(1000,Number.parseInt(url.searchParams.get("page")||"0",10)||0));
 const rows=await sql`SELECT v.id,v.created_at::text AS created_at,COALESCE(v.stamp_count,1) AS stamp_count,
   COALESCE(NULLIF(TRIM(CONCAT_WS(' ',p.first_name,p.last_name)),''),NULLIF(TRIM(CONCAT_WS(' ',c.first_name,c.last_name)),''),'Customer') AS customer_name,
   COALESCE(NULLIF(a.name,''),'Unknown / legacy') AS actor_name,
   CASE WHEN a.role='staff' THEN 'Cashier' WHEN a.role='business_owner' THEN 'Owner' ELSE 'Unknown' END AS actor_role,
   v.order_reference
   FROM visits v JOIN customers c ON c.id=v.customer_id AND c.business_id=v.business_id
   LEFT JOIN customer_profiles p ON p.user_id=c.user_id
   LEFT JOIN app_users a ON a.id=v.actor_id AND a.business_id=v.business_id
   WHERE v.business_id=${businessId}::uuid
   ORDER BY v.created_at DESC,v.id DESC LIMIT 50 OFFSET ${page*50}` as Array<Record<string,unknown>>;
 return output({history:rows,page,has_more:rows.length===50});
}