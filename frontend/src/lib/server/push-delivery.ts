import {randomUUID} from "node:crypto";
import type {getSql} from "@/lib/server/db";
import {validateSubscription,pushIsConfigured,pushPublicKey,sendWebPush,type PushSubscriptionData} from "./web-push-crypto";
type Sql=ReturnType<typeof getSql>;
type Row=Record<string,unknown>;
const qsql=(sql:Sql)=>sql as unknown as {(str:TemplateStringsArray,...values:unknown[]):Promise<Row[]>};
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});

export async function ensurePushSchema(sql:Sql){
 const q=qsql(sql);
 await q`CREATE TABLE IF NOT EXISTS web_push_subscriptions(
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
 )`;
 await q`CREATE INDEX IF NOT EXISTS idx_web_push_user ON web_push_subscriptions(user_id)`;
 await q`CREATE TABLE IF NOT EXISTS web_push_deliveries(
  id uuid PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES web_push_subscriptions(id) ON DELETE CASCADE,
  notification_id text NOT NULL REFERENCES customer_notifications(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  UNIQUE(subscription_id,notification_id)
 )`;
 await q`CREATE INDEX IF NOT EXISTS idx_web_push_pending ON web_push_deliveries(state,next_attempt_at)`;
}
export async function handleCustomerPush(req:Request,sql:Sql,userId:string,path:string[]){
 const q=qsql(sql);
 if(path[2]==="config"&&req.method==="GET")return out({configured:pushIsConfigured(),public_key:pushIsConfigured()?pushPublicKey():null});
 if(path[2]!=="subscriptions")return out({message:"Not found."},404);
 if(req.method==="GET"){
  const rows=await q`SELECT count(*)::int AS devices FROM web_push_subscriptions WHERE user_id=${userId}::uuid`;
  return out({devices:rows[0]?.devices??0});
 }
 const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
 if(req.method==="POST"){
  if(!pushIsConfigured())return out({message:"Web Push is not configured on this server."},503);
  const subscription=validateSubscription(body?.subscription);
  if(!subscription)return out({message:"Invalid browser push subscription."},422);
  // A browser endpoint is unique. Re-registration must never expose an old account's queued messages.
  await q`INSERT INTO web_push_subscriptions(id,user_id,endpoint,p256dh,auth_secret)
   VALUES(${randomUUID()},${userId}::uuid,${subscription.endpoint},${subscription.keys.p256dh},${subscription.keys.auth})
   ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,
    auth_secret=EXCLUDED.auth_secret,updated_at=now(),
    created_at=CASE WHEN web_push_subscriptions.user_id=EXCLUDED.user_id
      THEN web_push_subscriptions.created_at ELSE now() END`;
  return out({subscribed:true},201);
 }
 if(req.method==="DELETE"){
  const endpoint=typeof body?.endpoint==="string"?body.endpoint:"";
  if(!endpoint||endpoint.length>2048)return out({message:"Invalid endpoint."},422);
  await q`DELETE FROM web_push_subscriptions WHERE user_id=${userId}::uuid AND endpoint=${endpoint}`;
  return out({subscribed:false});
 }
 return out({message:"Method not allowed."},405);
}
const toLink=(type:string)=>{
 if(type==="campaign")return "/user/dashboard";
 if(type==="birthday"||type==="birthday_bonus")return "/user/birthday";
 if(type==="reward_ready"||type==="reward_redeemed")return "/user/rewards";
 if(type==="referral_bonus")return "/user/invite";
 return "/user/cards";
};
type Delivery=Row&{id:string;endpoint:string;p256dh:string;auth_secret:string;notification_id:string;title:string;message:string;type:string};
export async function deliverQueuedPush(sql:Sql,max=30){
 if(!pushIsConfigured())return {configured:false,queued:0,sent:0,failed:0};
 const q=qsql(sql),limit=Math.max(1,Math.min(max,100));
 // Only deliver events that happened after subscription and within the last day.
 // Promo and birthday opt-ins are checked both at enqueue and again at delivery.
 await q`INSERT INTO web_push_deliveries(id,subscription_id,notification_id)
 SELECT gen_random_uuid(),s.id,n.id
 FROM customer_notifications n
 JOIN customers c ON c.id=n.customer_id AND c.user_id IS NOT NULL
 JOIN web_push_subscriptions s ON s.user_id=c.user_id AND n.created_at>=s.created_at
 JOIN customer_profiles p ON p.user_id=c.user_id
 WHERE n.created_at>=now()-interval '24 hours'
  AND COALESCE(p.preferences->'notifications'->>'push_enabled','true')='true'
  AND (n.type<>'campaign' OR COALESCE(p.preferences->'notifications'->>'promotions','false')='true')
  AND (n.type NOT IN ('reward_ready','reward_redeemed') OR COALESCE(p.preferences->'notifications'->>'reward_alerts','true')='true')
  AND (n.type NOT IN ('birthday','birthday_bonus') OR p.birthday_opt_in=true)
 ON CONFLICT(subscription_id,notification_id) DO NOTHING`;
 const jobs=await q`WITH chosen AS (
  SELECT d.id FROM web_push_deliveries d
  WHERE (d.state='queued' OR d.state='retry' OR (d.state='sending' AND d.attempted_at<now()-interval '2 minutes'))
   AND d.attempts<4 AND d.next_attempt_at<=now()
  ORDER BY d.next_attempt_at,d.id LIMIT ${limit} FOR UPDATE SKIP LOCKED
 ), claimed AS (
  UPDATE web_push_deliveries d SET state='sending',attempted_at=now(),attempts=attempts+1,
   next_attempt_at=now()+interval '3 minutes'
  FROM chosen x WHERE d.id=x.id RETURNING d.id,d.notification_id,d.subscription_id
 ) SELECT claimed.id,claimed.notification_id,n.title,n.message,n.type,s.endpoint,s.p256dh,s.auth_secret
 FROM claimed JOIN web_push_subscriptions s ON s.id=claimed.subscription_id
 JOIN customer_notifications n ON n.id=claimed.notification_id
 JOIN customers c ON c.id=n.customer_id AND c.user_id=s.user_id
 JOIN customer_profiles p ON p.user_id=s.user_id
 WHERE COALESCE(p.preferences->'notifications'->>'push_enabled','true')='true'
  AND (n.type<>'campaign' OR COALESCE(p.preferences->'notifications'->>'promotions','false')='true')
  AND (n.type NOT IN ('reward_ready','reward_redeemed') OR COALESCE(p.preferences->'notifications'->>'reward_alerts','true')='true')
  AND (n.type NOT IN ('birthday','birthday_bonus') OR p.birthday_opt_in=true)` as Delivery[];
 let sent=0,failed=0;
 // Small bounded batches to limit serverless execution time and network fanout.
 for(let offset=0;offset<jobs.length;offset+=5){
  await Promise.all(jobs.slice(offset,offset+5).map(async job=>{
   let result:{ok:boolean;expired:boolean;retryable:boolean};
   try{
    const sub:PushSubscriptionData={endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth_secret}};
    result=await sendWebPush(sub,{title:String(job.title).slice(0,100),body:String(job.message).slice(0,360),url:toLink(String(job.type)),tag:"loyvance-"+String(job.notification_id).slice(0,90)});
   }catch{result={ok:false,expired:false,retryable:true};}
   if(result.ok){
    sent++;
    await q`UPDATE web_push_deliveries SET state='sent',sent_at=now() WHERE id=${job.id}::uuid`;
   }else{
    failed++;
    if(result.expired)await q`DELETE FROM web_push_subscriptions WHERE endpoint=${job.endpoint}`;
    else await q`UPDATE web_push_deliveries SET state=${result.retryable?"retry":"failed"},
      next_attempt_at=now()+(interval '1 minute' * LEAST(120,power(3,attempts)::int))
      WHERE id=${job.id}::uuid`;
   }
  }));
 }
 return {configured:true,queued:jobs.length,sent,failed};
}
