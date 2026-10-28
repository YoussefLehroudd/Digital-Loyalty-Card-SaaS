import type {getSql} from "@/lib/server/db";
type Sql=ReturnType<typeof getSql>;
export const premiumFeatures=["birthdays","analytics","staff","offers","campaigns"] as const;
export type PremiumFeature=typeof premiumFeatures[number];
export function isPremiumFeature(value:string):value is PremiumFeature{return (premiumFeatures as readonly string[]).includes(value);}
export async function ensurePremiumAccessSchema(sql:Sql){
 await sql`CREATE TABLE IF NOT EXISTS business_premium_access (
 business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 feature text NOT NULL CHECK(feature IN ('birthdays','analytics','staff','offers','campaigns')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz, reviewed_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
 PRIMARY KEY(business_id,feature))`;
}
export async function premiumStatus(sql:Sql,businessId:string){
 await ensurePremiumAccessSchema(sql);
 const rows=await sql`SELECT feature,status FROM business_premium_access WHERE business_id=${businessId}` as {feature:string;status:string}[];
 return Object.fromEntries(premiumFeatures.map(f=>[f,rows.find(r=>r.feature===f)?.status??"not_requested"])) as Record<PremiumFeature,string>;
}
export async function premiumAllowed(sql:Sql,businessId:string,feature:PremiumFeature){
 const status=await premiumStatus(sql,businessId);return status[feature]==="approved";
}
export async function ownerPremiumApi(req:Request,sql:Sql,businessId:string){
 if(req.method==="GET")return Response.json({features:await premiumStatus(sql,businessId)});
 if(req.method!=="POST")return Response.json({message:"Method not allowed"},{status:405});
 const body=await req.json().catch(()=>({})); const feature=body.feature;
 if(typeof feature!=="string"||!isPremiumFeature(feature))return Response.json({message:"Invalid feature"},{status:422});
 await ensurePremiumAccessSchema(sql);
 await sql`INSERT INTO business_premium_access(business_id,feature,status)
 VALUES(${businessId},${feature},'pending')
 ON CONFLICT(business_id,feature) DO UPDATE SET status='pending',requested_at=now(),reviewed_at=NULL,reviewed_by=NULL
 WHERE business_premium_access.status='rejected'`;
 return Response.json({features:await premiumStatus(sql,businessId)});
}
export async function adminPremiumApi(req:Request,sql:Sql,actorId:string){
 await ensurePremiumAccessSchema(sql);
 if(req.method==="GET"){
 const rows=await sql`SELECT p.business_id,p.feature,p.status,p.requested_at,p.reviewed_at,b.name AS business_name
 FROM business_premium_access p JOIN businesses b ON b.id=p.business_id ORDER BY p.requested_at DESC LIMIT 500`;
 return Response.json({requests:rows});
 }
 if(req.method!=="PATCH")return Response.json({message:"Method not allowed"},{status:405});
 const body=await req.json().catch(()=>({}));
 if(typeof body.business_id!=="string"||!/^([0-9a-f]{8}-){4}[0-9a-f]{12}$/i.test(body.business_id)||typeof body.feature!=="string"||!isPremiumFeature(body.feature)||!["approved","rejected"].includes(body.status))
 return Response.json({message:"Invalid request"},{status:422});
 const rows=await sql`UPDATE business_premium_access SET status=${body.status},reviewed_at=now(),reviewed_by=${actorId}
 WHERE business_id=${body.business_id} AND feature=${body.feature} RETURNING business_id`;
 return rows.length?Response.json({ok:true}):Response.json({message:"Request not found"},{status:404});
}
