import type { getSql } from "@/lib/server/db";
type Sql=ReturnType<typeof getSql>;
type Row=Record<string,unknown>;
const qsql=(sql:Sql)=>sql as unknown as {(parts:TemplateStringsArray,...args:unknown[]):Promise<Row[]>};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export const DISCOVER_CATEGORIES=["Cafe","Restaurant","Bakery","Barber","Beauty & Spa","Retail","Fitness","Other"] as const;
const isLatitude=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=-90&&n<=90;
const isLongitude=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=-180&&n<=180;
const validCity=(v:unknown)=>typeof v==="string"&&v.trim().length<=70&&!/[<>]/.test(v);
export async function ensureDiscoverSchema(sql:Sql){
 const q=qsql(sql);
 await q`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS discover_city varchar(70)`;
 await q`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS discover_category varchar(40)`;
 await q`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS discover_latitude double precision`;
 await q`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS discover_longitude double precision`;
 await q`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS discover_visible boolean NOT NULL DEFAULT true`;
 await q`CREATE TABLE IF NOT EXISTS discover_customer_joins(
  membership_id uuid PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now()
 )`;
 await q`CREATE INDEX IF NOT EXISTS discover_customer_joins_business_idx ON discover_customer_joins(business_id,joined_at DESC)`;
}
export async function getDiscoverCatalog(sql:Sql,userId:string){
 const q=qsql(sql);
 return q`SELECT b.id::text,b.slug,b.name,b.logo_url,b.hero_image_url,b.primary_color,
  b.address,b.google_maps_url,b.google_reviews_url,b.created_at::text,
  b.discover_city AS city,b.discover_category AS category,
  b.discover_latitude AS latitude,b.discover_longitude AS longitude,
  COALESCE(lc.reward_name,'Loyalty rewards') AS reward_name,
  COALESCE(lc.required_stamps,10)::int AS required_stamps,
  COALESCE(lc.reward_description,'Collect stamps with this business.') AS reward_description,
  (existing.id IS NOT NULL) AS has_card,existing.id::text AS membership_id,
  (s.paid_ends_at>now() OR (s.paid_ends_at IS NULL AND s.trial_ends_at>now())) AS available,
  CASE WHEN s.paid_ends_at>now() THEN 'active'
    WHEN s.paid_ends_at IS NULL AND s.trial_ends_at>now() THEN 'trial'
    ELSE 'expired' END AS subscription_state,
  COALESCE((
    SELECT json_agg(json_build_object('id',offer.id,'title',offer.title,
      'kind',offer.kind,'weekday',offer.weekday,'ends_at',offer.ends_at) ORDER BY offer.ends_at)
    FROM (SELECT o.id,o.title,o.kind,o.weekday,o.ends_at FROM special_offers o
      WHERE o.business_id=b.id AND o.is_active=true AND o.starts_at<=now()
       AND o.ends_at>now() AND o.uses_count<o.max_uses
      ORDER BY o.ends_at ASC LIMIT 3) offer
  ),'[]'::json) AS active_offers
  FROM businesses b
  LEFT JOIN loyalty_cards lc ON lc.business_id=b.id
  LEFT JOIN business_subscriptions s ON s.business_id=b.id
  LEFT JOIN LATERAL (SELECT id FROM customers WHERE user_id=${userId}::uuid
    AND business_id=b.id LIMIT 1) existing ON true
  WHERE COALESCE(b.status,'active')<>'suspended' AND b.discover_visible=true
  ORDER BY (existing.id IS NOT NULL) DESC,
   CASE WHEN s.paid_ends_at>now() OR (s.paid_ends_at IS NULL AND s.trial_ends_at>now()) THEN 1 ELSE 0 END DESC,
   b.created_at DESC LIMIT 500`;
}
// Called only after the membership INSERT returned a new id: existing memberships
// never receive another Discover attribution.
export async function recordDiscoverJoin(sql:Sql,membershipId:string,businessId:string){
 const q=qsql(sql);
 await q`INSERT INTO discover_customer_joins(membership_id,business_id,joined_at)
  SELECT c.id,c.business_id,c.created_at FROM customers c
  WHERE c.id=${membershipId}::uuid AND c.business_id=${businessId}::uuid
  ON CONFLICT(membership_id) DO NOTHING`;
}
export async function handleOwnerDiscover(req:Request,sql:Sql,businessId:string){
 const q=qsql(sql);
 if(req.method==="PATCH"){
  const body=await req.json().catch(()=>null) as Row|null;
  if(!body||typeof body.visible!=="boolean"||!validCity(body.city)
    ||!DISCOVER_CATEGORIES.includes(body.category as typeof DISCOVER_CATEGORIES[number])
    || ((body.latitude===null)!==(body.longitude===null))
    || (body.latitude!==null&&!isLatitude(body.latitude))
    || (body.longitude!==null&&!isLongitude(body.longitude)))
    return reply({message:"Choose a category, valid city and matching coordinates, or clear both coordinates."},422);
  const updated=await q`UPDATE businesses SET
    discover_visible=${body.visible},discover_city=${String(body.city).trim()||null},
    discover_category=${body.category},discover_latitude=${body.latitude},
    discover_longitude=${body.longitude},updated_at=now()
    WHERE id=${businessId}::uuid
    RETURNING discover_visible,discover_city,discover_category,discover_latitude,discover_longitude`;
  return updated.length?reply({settings:updated[0]}):reply({message:"Business not found."},404);
 }
 if(req.method!=="GET")return reply({message:"Method not allowed."},405);
 const settings=await q`SELECT discover_visible,discover_city,discover_category,
    discover_latitude,discover_longitude FROM businesses WHERE id=${businessId}::uuid LIMIT 1`;
 const stats=await q`SELECT
  COUNT(*)::int AS joins_all,
  COUNT(*) FILTER(WHERE j.joined_at>=now()-interval '30 days')::int AS joins_30d,
  COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM visits v WHERE v.business_id=j.business_id
    AND v.customer_id=j.membership_id))::int AS joined_then_visited,
  COUNT(*) FILTER(WHERE j.joined_at>=now()-interval '30 days'
    AND EXISTS(SELECT 1 FROM visits v WHERE v.business_id=j.business_id
      AND v.customer_id=j.membership_id AND v.created_at>=j.joined_at))::int AS visited_from_recent_joins
  FROM discover_customer_joins j WHERE j.business_id=${businessId}::uuid`;
 const trend=await q`SELECT to_char(d.day,'YYYY-MM-DD') AS day,
  COUNT(j.membership_id)::int AS joins
  FROM generate_series(date_trunc('day',now())-interval '29 days',date_trunc('day',now()),interval '1 day') d(day)
  LEFT JOIN discover_customer_joins j ON j.business_id=${businessId}::uuid
    AND j.joined_at>=d.day AND j.joined_at<d.day+interval '1 day'
  GROUP BY d.day ORDER BY d.day`;
 return reply({settings:settings[0]??null,stats:stats[0]??null,trend});
}