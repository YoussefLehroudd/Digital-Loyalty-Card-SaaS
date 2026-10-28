import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type ReadSql = { (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> };
const qsql = (sql: Sql) => sql as unknown as ReadSql;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export async function ensureSpecialOfferSchema(sql: Sql) {
 const q=qsql(sql);
 await q`CREATE TABLE IF NOT EXISTS special_offers (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title varchar(80) NOT NULL,
  description varchar(300) NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('weekday_double','first_visit_double')),
  weekday integer CHECK (weekday BETWEEN 0 AND 6),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 5000),
  uses_count integer NOT NULL DEFAULT 0 CHECK (uses_count>=0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at>starts_at)
 )`;
 await q`CREATE INDEX IF NOT EXISTS special_offers_business_idx ON special_offers (business_id,starts_at,ends_at)`;
 await q`CREATE TABLE IF NOT EXISTS special_offer_redemptions (
  id uuid PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES special_offers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
  bonus_stamps integer NOT NULL CHECK(bonus_stamps>0),
  created_at timestamptz NOT NULL DEFAULT now()
 )`;
 await q`CREATE INDEX IF NOT EXISTS special_offer_redemptions_offer_idx ON special_offer_redemptions (offer_id,created_at DESC)`;
}

export async function handleBusinessOffers(path:string[],req:Request,sql:Sql,businessId:string) {
 const q=qsql(sql);
 const id=path[2];
 if(id&&!validId(id))return json({message:"Invalid offer."},422);
 if(req.method==="GET"&&!id) {
  const offers=await q`SELECT id,title,description,kind,weekday,starts_at::text,ends_at::text,max_uses,uses_count,is_active,created_at::text
  FROM special_offers WHERE business_id=${businessId}::uuid ORDER BY created_at DESC LIMIT 100`;
  return json({offers});
 }
 if(req.method==="POST"&&!id) {
  const sub=await q`SELECT EXISTS(SELECT 1 FROM business_subscriptions s JOIN businesses b ON b.id=s.business_id
   WHERE b.id=${businessId}::uuid AND COALESCE(b.status,'active')='active'
   AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now()) AS active`;
  if(!sub[0]?.active)return json({message:"Active business subscription required."},403);
  const data=await req.json().catch(()=>null) as Row|null;
  const title=typeof data?.title==="string"?data.title.trim():"";
  const description=typeof data?.description==="string"?data.description.trim():"";
  const kind=data?.kind,weekday=data?.weekday;
  const maxUses=Number(data?.max_uses);
  const start=typeof data?.starts_at==="string"?Date.parse(data.starts_at):NaN;
  const end=typeof data?.ends_at==="string"?Date.parse(data.ends_at):NaN;
  if(title.length<3||title.length>80||description.length>300||/[<>]/.test(title+description)
   || (kind!=="weekday_double"&&kind!=="first_visit_double")
   || (kind==="weekday_double"&&(typeof weekday!=="number"||!Number.isInteger(weekday)||weekday<0||weekday>6))
   || !Number.isInteger(maxUses)||maxUses<1||maxUses>5000
   || !Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<Date.now()
   || end-start>180*86400000||start>Date.now()+180*86400000)
    return json({message:"Enter a valid title, offer type, weekday, dates (up to 180 days) and use limit (1–5000)."},422);
  const existing=await q`SELECT count(*)::int AS count FROM special_offers WHERE business_id=${businessId}::uuid AND is_active AND ends_at>now()`;
  if(Number(existing[0]?.count??0)>=20)return json({message:"Maximum 20 active offers per business."},429);
  const inserted=await q`INSERT INTO special_offers(id,business_id,title,description,kind,weekday,starts_at,ends_at,max_uses)
   VALUES(${randomUUID()},${businessId}::uuid,${title},${description},${kind},${kind==="weekday_double"?weekday:null},${new Date(start).toISOString()}::timestamptz,${new Date(end).toISOString()}::timestamptz,${maxUses})
   RETURNING id,title,description,kind,weekday,starts_at::text,ends_at::text,max_uses,uses_count,is_active`;
  return json({offer:inserted[0]},201);
 }
 if(!id)return json({message:"Not found."},404);
 if(req.method==="PATCH"){
  const body=await req.json().catch(()=>null) as Row|null;
  if(typeof body?.is_active!=="boolean")return json({message:"Only offer active status can be changed."},422);
  const changed=await q`UPDATE special_offers SET is_active=${body.is_active}
    WHERE id=${id}::uuid AND business_id=${businessId}::uuid
    AND (${!body.is_active} OR (ends_at>now() AND uses_count<max_uses))
    RETURNING id,is_active`;
  return changed.length?json({offer:changed[0]}):json({message:"Offer unavailable or expired."},404);
 }
 if(req.method==="DELETE"){
  const changed=await q`UPDATE special_offers SET is_active=false WHERE id=${id}::uuid AND business_id=${businessId}::uuid RETURNING id`;
  return changed.length?json({deleted:true}):json({message:"Offer not found."},404);
 }
 return json({message:"Method not allowed."},405);
}

export async function handleCustomerOffers(req:Request,sql:Sql,userId:string) {
 if(req.method!=="GET")return json({message:"Method not allowed."},405);
 const q=qsql(sql);
 const offers=await q`SELECT o.id,o.business_id,b.name AS business_name,o.title,o.description,o.kind,o.weekday,
   o.starts_at::text,o.ends_at::text,o.max_uses,o.uses_count,
   CASE WHEN o.kind='first_visit_double' THEN NOT EXISTS(
     SELECT 1 FROM visits v WHERE v.business_id=o.business_id AND v.customer_id=c.id
   ) ELSE true END AS eligible,
   CASE WHEN o.kind='weekday_double' THEN extract(dow from now() AT TIME ZONE 'Africa/Casablanca')::int=o.weekday
   ELSE true END AS applicable_today
  FROM special_offers o
  JOIN businesses b ON b.id=o.business_id AND COALESCE(b.status,'active')='active'
  JOIN business_subscriptions s ON s.business_id=b.id AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now()
  JOIN customers c ON c.business_id=b.id AND c.user_id=${userId}::uuid
  WHERE o.is_active=true AND o.ends_at>now() AND o.uses_count<o.max_uses
  ORDER BY o.ends_at ASC LIMIT 100`;
 return json({offers});
}
