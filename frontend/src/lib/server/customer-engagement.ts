import {randomBytes,randomUUID} from "crypto";
import type {getSql} from "@/lib/server/db";
type Sql=ReturnType<typeof getSql>;
type Row=Record<string,unknown>;
const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
const raw=(sql:Sql)=>sql as unknown as {(strings:TemplateStringsArray,...values:unknown[]):Promise<Row[]>};

export async function ensureEngagementSchema(sql:Sql){
 const q=raw(sql);
 await q`CREATE TABLE IF NOT EXISTS referral_links(
  id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
 )`;
 await q`CREATE TABLE IF NOT EXISTS customer_referrals(
  id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referrer_member_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','qualified')),
  first_visit_id uuid UNIQUE REFERENCES visits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), qualified_at timestamptz
 )`;
 await q`CREATE INDEX IF NOT EXISTS referrals_business_idx ON customer_referrals(business_id,created_at DESC)`;
 await q`CREATE TABLE IF NOT EXISTS referral_bonus_awards(
  id uuid PRIMARY KEY, referral_id uuid NOT NULL REFERENCES customer_referrals(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('inviter','friend')),
  created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz,
  UNIQUE(referral_id,role)
 )`;
 await q`CREATE INDEX IF NOT EXISTS referral_bonus_pending_idx ON referral_bonus_awards(member_id,applied_at)`;
 await q`CREATE TABLE IF NOT EXISTS visit_feedback(
  id uuid PRIMARY KEY,visit_id uuid NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK(rating BETWEEN 1 AND 5), note varchar(1000) NOT NULL DEFAULT '',
  owner_reply varchar(1000), created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
 )`;
 await q`CREATE INDEX IF NOT EXISTS visit_feedback_business_idx ON visit_feedback(business_id,created_at DESC)`;
 await q`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS date_of_birth date`;
 await q`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS birthday_opt_in boolean NOT NULL DEFAULT false`;
 await q`CREATE TABLE IF NOT EXISTS business_birthday_settings(
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false, gift_name varchar(80) NOT NULL DEFAULT 'Birthday surprise',
  bonus_stamp boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
 )`;
 await q`CREATE TABLE IF NOT EXISTS birthday_rewards(
  id uuid PRIMARY KEY,business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_year int NOT NULL,gift_name text NOT NULL,
  bonus_applied boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id,member_id,reward_year)
 )`;
}

export async function customerReferralApi(req:Request,sql:Sql,userId:string){
 const q=raw(sql);
 if(req.method!=="GET")return send({message:"Method not allowed"},405);
 const memberships=await q`SELECT c.id,c.business_id,b.name AS business_name
 FROM customers c JOIN businesses b ON b.id=c.business_id
 WHERE c.user_id=${userId}::uuid ORDER BY c.created_at DESC LIMIT 50`;
 const links:Row[]=[];
 for(const m of memberships){
   const existing=await q`SELECT code FROM referral_links WHERE member_id=${m.id}::uuid`;
   let code=existing[0]?.code as string|undefined;
   if(!code){
    code=randomBytes(11).toString("hex");
    const created=await q`INSERT INTO referral_links(id,business_id,member_id,code)
     VALUES(${randomUUID()},${m.business_id}::uuid,${m.id}::uuid,${code})
     ON CONFLICT(member_id) DO UPDATE SET member_id=EXCLUDED.member_id RETURNING code`;
    code=String(created[0].code);
   }
   const stats=await q`SELECT COUNT(*)::int AS invited,COUNT(*) FILTER(WHERE status='qualified')::int AS qualified
     FROM customer_referrals WHERE referrer_member_id=${m.id}::uuid`;
   links.push({business_name:m.business_name,business_id:m.business_id,code,invited:stats[0].invited,qualified:stats[0].qualified});
 }
 return send({links});
}

// Only called after successful email OTP verification. A user can only be attributed once.
export async function recordVerifiedReferral(sql:Sql,inviteeUserId:string,inviteCode:string){
 const q=raw(sql),code=inviteCode.trim().toLowerCase();
 if(!/^[0-9a-f]{22}$/.test(code))return false;
 const result=await q`INSERT INTO customer_referrals(id,business_id,referrer_member_id,invitee_user_id)
 SELECT ${randomUUID()},l.business_id,l.member_id,${inviteeUserId}::uuid
 FROM referral_links l JOIN customers ref ON ref.id=l.member_id AND ref.business_id=l.business_id
 JOIN app_users invitee ON invitee.id=${inviteeUserId}::uuid AND invitee.role='customer'
 JOIN businesses b ON b.id=l.business_id AND COALESCE(b.status,'active')='active'
 WHERE l.code=${code} AND ref.user_id IS DISTINCT FROM ${inviteeUserId}::uuid
  AND NOT EXISTS(SELECT 1 FROM visits v JOIN customers c ON c.id=v.customer_id WHERE c.user_id=${inviteeUserId}::uuid)
 ON CONFLICT(invitee_user_id) DO NOTHING RETURNING id`;
 return result.length>0;
}

export async function referralBusinessForCode(sql:Sql,code:string){
 if(!/^[0-9a-f]{22}$/.test(code))return null;
 const q=raw(sql);
 const rows=await q`SELECT l.business_id,b.name FROM referral_links l
 JOIN businesses b ON b.id=l.business_id AND COALESCE(b.status,'active')='active'
 WHERE l.code=${code} LIMIT 1`;
 return rows[0]??null;
}

// First successfully recorded visit, never a mere sign-up or QR preview.
// One qualified referral creates at most two pending award credits.
export async function qualifyReferralAfterVisit(sql:Sql,memberId:string,businessId:string,visitId:string){
 if(!uuid(visitId))return;
 const q=raw(sql);
 await q`WITH candidate AS (
   UPDATE customer_referrals r SET status='qualified',first_visit_id=${visitId}::uuid,qualified_at=now()
   WHERE r.business_id=${businessId}::uuid AND r.status='pending'
    AND EXISTS(SELECT 1 FROM customers c WHERE c.id=${memberId}::uuid AND c.user_id=r.invitee_user_id AND c.business_id=r.business_id)
    AND EXISTS(SELECT 1 FROM visits v WHERE v.id=${visitId}::uuid AND v.customer_id=${memberId}::uuid AND v.business_id=r.business_id)
    AND (SELECT v0.id FROM visits v0 WHERE v0.customer_id=${memberId}::uuid ORDER BY v0.created_at,v0.id LIMIT 1)=${visitId}::uuid
   RETURNING r.id,r.referrer_member_id
  ), awards AS (
   INSERT INTO referral_bonus_awards(id,referral_id,member_id,role)
   SELECT ${randomUUID()}::uuid,c.id,c.referrer_member_id,'inviter' FROM candidate c
   UNION ALL
   SELECT ${randomUUID()}::uuid,c.id,${memberId}::uuid,'friend' FROM candidate c
   ON CONFLICT(referral_id,role) DO NOTHING RETURNING member_id
  ) SELECT count(*) AS awarded FROM awards`;
}
export async function applyPendingReferralBonuses(sql:Sql,memberId:string){
 const q=raw(sql);
 // Bonus waits for available capacity on the existing loyalty card; never overflow.
 for(let n=0;n<5;n++){
  const result=await q`WITH available AS (
    SELECT a.id,a.member_id,l.id AS loyalty_id,COALESCE(l.target_stamps,lc.required_stamps) AS needed
    FROM referral_bonus_awards a
    JOIN customers c ON c.id=a.member_id
    JOIN loyalty_cards lc ON lc.business_id=c.business_id
    JOIN customer_loyalties l ON l.customer_id=c.id AND l.loyalty_card_id=lc.id
    WHERE a.member_id=${memberId}::uuid AND a.applied_at IS NULL
      AND l.current_stamps<COALESCE(l.target_stamps,lc.required_stamps)
    ORDER BY a.created_at LIMIT 1 FOR UPDATE OF a,l
   ), credited AS (
    UPDATE customer_loyalties l SET current_stamps=l.current_stamps+1,updated_at=now()
    FROM available a WHERE l.id=a.loyalty_id AND l.current_stamps<a.needed
    RETURNING l.id,l.current_stamps,a.id AS award_id,l.customer_id,a.needed
   ), marked AS (
    UPDATE referral_bonus_awards a SET applied_at=now()
    FROM credited c WHERE a.id=c.award_id RETURNING a.id,a.member_id
   ), reward_ready AS (
    INSERT INTO reward_redemptions(id,business_id,customer_id,loyalty_card_id,status,required_stamps_snapshot,reward_name_snapshot)
    SELECT gen_random_uuid(),c.business_id,l.customer_id,lc.id,'ready',COALESCE(l.target_stamps,lc.required_stamps),lc.reward_name
    FROM credited l JOIN customers c ON c.id=l.customer_id
    JOIN loyalty_cards lc ON lc.business_id=c.business_id
    WHERE l.current_stamps=l.needed
     AND NOT EXISTS (SELECT 1 FROM reward_redemptions r WHERE r.customer_id=l.customer_id AND r.status='ready')
    ON CONFLICT DO NOTHING RETURNING id,customer_id
   ), reward_notify AS (
    INSERT INTO customer_notifications(id,customer_id,type,title,message,reward_id)
    SELECT CONCAT('referral-ready-',id::text),customer_id,'reward_ready','Reward unlocked',
      'Your referral bonus completed the loyalty card!',id FROM reward_ready
    ON CONFLICT(id) DO NOTHING RETURNING id
   ), notify AS (
    INSERT INTO customer_notifications(id,customer_id,type,title,message)
    SELECT CONCAT('referral-bonus-',m.id::text),m.member_id,'referral_bonus','Friend referral bonus',
      'You earned a bonus stamp after a verified first visit!' FROM marked m
    ON CONFLICT(id) DO NOTHING RETURNING id
   ) SELECT count(*)::int AS count FROM marked`;
  if(Number(result[0]?.count??0)===0)break;
 }
}
export async function handleFeedback(req:Request,sql:Sql,userId:string|null,businessId:string|null){
 const q=raw(sql),url=new URL(req.url),owner=Boolean(businessId);
 if(req.method==="GET"){
  if(owner){
   const rows=await q`SELECT f.id,f.rating,f.note,f.owner_reply,f.created_at::text,f.replied_at::text,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ',p.first_name,p.last_name)),''),'Customer') AS customer_name
    FROM visit_feedback f JOIN customers c ON c.id=f.customer_id
    LEFT JOIN customer_profiles p ON p.user_id=c.user_id
    WHERE f.business_id=${businessId}::uuid ORDER BY f.created_at DESC LIMIT 200`;
   return send({feedback:rows});
  }
  const rows=await q`SELECT v.id AS visit_id,v.created_at::text AS visit_date,b.name AS business_name,
    b.id AS business_id,f.id AS feedback_id,f.rating,f.note,f.owner_reply
    FROM visits v JOIN customers c ON c.id=v.customer_id AND c.user_id=${userId}::uuid
    JOIN businesses b ON b.id=c.business_id
    LEFT JOIN visit_feedback f ON f.visit_id=v.id
    WHERE v.created_at>now()-interval '60 days'
    ORDER BY v.created_at DESC LIMIT 100`;
  return send({visits:rows});
 }
 if(req.method==="POST"&&!owner){
  const body=await req.json().catch(()=>null) as Row|null,visitId=clean(body?.visit_id,64);
  const rating=Number(body?.rating),note=clean(body?.note,1000);
  if(!uuid(visitId)||!Number.isInteger(rating)||rating<1||rating>5||/[<>]/.test(note))return send({message:"Select a visit, rating 1–5 and plain-text feedback."},422);
  const result=await q`INSERT INTO visit_feedback(id,visit_id,business_id,customer_id,rating,note)
   SELECT ${randomUUID()},v.id,v.business_id,v.customer_id,${rating},${note}
   FROM visits v JOIN customers c ON c.id=v.customer_id AND c.user_id=${userId}::uuid
   WHERE v.id=${visitId}::uuid AND v.created_at>now()-interval '14 days'
   ON CONFLICT(visit_id) DO NOTHING RETURNING id`;
  return result.length?send({feedback:result[0]},201):send({message:"This visit is unavailable or has already been rated."},409);
 }
 if(req.method==="PATCH"&&owner){
  const id=url.searchParams.get("id")??"",body=await req.json().catch(()=>null) as Row|null;
  const reply=clean(body?.reply,1000);
  if(!uuid(id)||reply.length<1||/[<>]/.test(reply))return send({message:"Enter a valid reply (up to 1000 characters)."},422);
  const changed=await q`UPDATE visit_feedback SET owner_reply=${reply},replied_at=now()
   WHERE id=${id}::uuid AND business_id=${businessId}::uuid RETURNING id,owner_reply`;
  return changed.length?send({feedback:changed[0]}):send({message:"Feedback not found."},404);
 }
 return send({message:"Forbidden or method not supported."},405);
}

export async function handleBirthday(req:Request,sql:Sql,userId:string|null,businessId:string|null){
 const q=raw(sql);
 if(userId){
  if(req.method==="GET"){
   const p=await q`SELECT date_of_birth::text,birthday_opt_in FROM customer_profiles WHERE user_id=${userId}::uuid`;
   return send({birthday:{date_of_birth:p[0]?.date_of_birth??null,opt_in:p[0]?.birthday_opt_in??false}});
  }
  if(req.method==="PUT"){
   const body=await req.json().catch(()=>null) as Row|null;
   const date=body?.date_of_birth===null||body?.date_of_birth===""?null:clean(body?.date_of_birth,10);
   const consent=body?.opt_in===true;
   if(date!==null){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return send({message:"Enter a valid birth date."},422);
    const dt=new Date(date+"T12:00:00Z"),year=dt.getUTCFullYear();
    if(Number.isNaN(dt.getTime())||dt.toISOString().slice(0,10)!==date||year<1900||dt.getTime()>Date.now())
     return send({message:"Invalid birth date."},422);
   }
   if(consent&&!date)return send({message:"Set a birth date before enabling birthday rewards."},422);
   await q`UPDATE customer_profiles SET date_of_birth=${date}::date,birthday_opt_in=${consent},updated_at=now() WHERE user_id=${userId}::uuid`;
   return send({birthday:{date_of_birth:date,opt_in:consent}});
  }
 }
 if(businessId){
  if(req.method==="GET"){
   const row=await q`SELECT enabled,gift_name,bonus_stamp FROM business_birthday_settings WHERE business_id=${businessId}::uuid`;
   return send({settings:row[0]??{enabled:false,gift_name:"Birthday surprise",bonus_stamp:false}});
  }
  if(req.method==="PUT"){
   const body=await req.json().catch(()=>null) as Row|null;
   const gift=clean(body?.gift_name,80);
   if(typeof body?.enabled!=="boolean"||typeof body?.bonus_stamp!=="boolean"||gift.length<3||/[<>]/.test(gift))return send({message:"Enter gift title and valid options."},422);
   const rows=await q`INSERT INTO business_birthday_settings(business_id,enabled,gift_name,bonus_stamp)
    VALUES(${businessId}::uuid,${body.enabled},${gift},${body.bonus_stamp})
    ON CONFLICT(business_id) DO UPDATE SET enabled=EXCLUDED.enabled,gift_name=EXCLUDED.gift_name,
       bonus_stamp=EXCLUDED.bonus_stamp,updated_at=now()
    RETURNING enabled,gift_name,bonus_stamp`;
   return send({settings:rows[0]});
  }
 }
 return send({message:"Method not allowed."},405);
}
// Daily task, timezone Africa/Casablanca. At most one birthday reward per business/member/year.
export async function issueBirthdayRewards(sql:Sql,limit=100){
 const q=raw(sql);
 const result=await q`WITH birthdays AS (
   SELECT c.id AS member_id,c.business_id,s.gift_name,s.bonus_stamp,
    extract(year from now() AT TIME ZONE 'Africa/Casablanca')::int AS y
   FROM customers c JOIN customer_profiles p ON p.user_id=c.user_id
   JOIN business_birthday_settings s ON s.business_id=c.business_id AND s.enabled=true
   JOIN businesses b ON b.id=c.business_id AND COALESCE(b.status,'active')='active'
   JOIN business_subscriptions sub ON sub.business_id=b.id
     AND COALESCE(sub.paid_ends_at,sub.trial_ends_at)>now()
   WHERE p.birthday_opt_in=true AND p.date_of_birth IS NOT NULL
    AND extract(month from p.date_of_birth)=extract(month from now() AT TIME ZONE 'Africa/Casablanca')
    AND extract(day from p.date_of_birth)=extract(day from now() AT TIME ZONE 'Africa/Casablanca')
   AND NOT EXISTS(
     SELECT 1 FROM birthday_rewards br WHERE br.business_id=c.business_id AND br.member_id=c.id
       AND br.reward_year=extract(year from now() AT TIME ZONE 'Africa/Casablanca')::int
   )
   ORDER BY c.id LIMIT ${limit}
  ), inserted AS (
   INSERT INTO birthday_rewards(id,business_id,member_id,reward_year,gift_name)
   SELECT gen_random_uuid(),business_id,member_id,y,gift_name FROM birthdays
   ON CONFLICT(business_id,member_id,reward_year) DO NOTHING
   RETURNING id,business_id,member_id,gift_name
  ), notified AS (
   INSERT INTO customer_notifications(id,customer_id,type,title,message)
   SELECT CONCAT('birthday-',i.id::text),i.member_id,'birthday','Happy Birthday!',
     CONCAT('Birthday gift from your business: ',i.gift_name,'.') FROM inserted i
   ON CONFLICT(id) DO NOTHING RETURNING id
  ) SELECT id,member_id,business_id FROM inserted`;
 for(const item of result){
  // Skip full cards; keep the birthday gift notification regardless.
  await q`WITH pending AS (
    SELECT r.id,r.member_id,l.id AS loyalty_id,COALESCE(l.target_stamps,lc.required_stamps) AS needed
    FROM birthday_rewards r JOIN business_birthday_settings s ON s.business_id=r.business_id AND s.bonus_stamp=true
    JOIN loyalty_cards lc ON lc.business_id=r.business_id
    JOIN customer_loyalties l ON l.customer_id=r.member_id AND l.loyalty_card_id=lc.id
    WHERE r.id=${item.id}::uuid AND r.bonus_applied=false
    ORDER BY r.id LIMIT 1 FOR UPDATE OF r,l
   ), credited AS (
    UPDATE customer_loyalties l SET current_stamps=l.current_stamps+1,updated_at=now()
    FROM pending p WHERE l.id=p.loyalty_id AND l.current_stamps<p.needed
    RETURNING p.id
   ) UPDATE birthday_rewards r SET bonus_applied=true FROM credited c WHERE r.id=c.id`;
 }
 return {issued:result.length};
}
export async function handleAnalyticsPro(req:Request,sql:Sql,businessId:string){
 if(req.method!=="GET")return send({message:"Method not allowed."},405);
 const q=raw(sql);
 const rows=await q`WITH memberships AS(
  SELECT id,created_at FROM customers WHERE business_id=${businessId}::uuid
 ), first_visits AS(
  SELECT customer_id,MIN(created_at) AS first_at,MAX(created_at) AS last_at,
   COUNT(*)::int AS visits_all,
   COUNT(*) FILTER(WHERE created_at>=now()-interval '30 days')::int AS visits_30d
  FROM visits WHERE business_id=${businessId}::uuid GROUP BY customer_id
 ), metrics AS(
  SELECT (SELECT COUNT(*)::int FROM memberships WHERE created_at>=now()-interval '30 days') AS new_customers,
    (SELECT COUNT(*)::int FROM memberships) AS total_customers,
    COUNT(*) FILTER(WHERE f.visits_30d>0 AND f.first_at<now()-interval '30 days')::int AS returning_customers,
    COUNT(*) FILTER(WHERE f.last_at<now()-interval '30 days')::int AS dormant_customers,
    COUNT(*) FILTER(WHERE f.visits_30d>0)::int AS active_customers,
    COALESCE(SUM(f.visits_30d),0)::int AS visits_30d,
    COALESCE(ROUND(SUM(f.visits_30d)::numeric/NULLIF(COUNT(*) FILTER(WHERE f.visits_30d>0),0),2),0)::float AS avg_visits_active
  FROM first_visits f
 ) SELECT metrics.*,
  (SELECT COUNT(*)::int FROM reward_redemptions r WHERE r.business_id=${businessId}::uuid
    AND r.status='redeemed' AND r.redeemed_at>=now()-interval '30 days') AS redeemed_rewards_30d
 FROM metrics`;
 const daily=await q`SELECT to_char(d.date,'YYYY-MM-DD') AS day,
  COALESCE((SELECT COUNT(*)::int FROM visits v WHERE v.business_id=${businessId}::uuid
    AND v.created_at>=d.date AND v.created_at<d.date+interval '1 day'),0) AS visits,
  COALESCE((SELECT COUNT(*)::int FROM customers c WHERE c.business_id=${businessId}::uuid
    AND c.created_at>=d.date AND c.created_at<d.date+interval '1 day'),0) AS joined
  FROM generate_series(date_trunc('day',now())-interval '29 days',date_trunc('day',now()),interval '1 day') AS d(date)
  ORDER BY d.date`;
 return send({metrics:rows[0],daily,period:"Last 30 days",note:"Visit-based analytics only. No sales or revenue are inferred."});
}
