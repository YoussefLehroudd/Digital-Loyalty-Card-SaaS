import { createHash, randomBytes, randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type ReadSql = { (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> };
type Segment = "all" | "inactive_30" | "one_away" | "new_7";
type Channel = "inapp" | "inapp_email";
const segments: Segment[] = ["all","inactive_30","one_away","new_7"];
const isSegment = (value: unknown): value is Segment => typeof value === "string" && segments.includes(value as Segment);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (data: unknown, status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const hash = (s:string) => createHash("sha256").update(s).digest("hex");
const esc = (s:string) => s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const qsql = (sql:Sql) => sql as unknown as ReadSql;
const safeChannel = (v:unknown):Channel => v==="inapp_email"?"inapp_email":"inapp";
const businessActive = async(sql:Sql,businessId:string) => {
 const q=qsql(sql);
 const rows=await q`SELECT EXISTS(SELECT 1 FROM businesses b JOIN business_subscriptions s ON s.business_id=b.id WHERE b.id=${businessId}::uuid AND COALESCE(b.status,'active')='active' AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now()) AS active`;
 return rows[0]?.active===true;
};

export async function ensureCampaignSchema(sql:Sql){
 const q=qsql(sql);
 await q`CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL, message text NOT NULL,
  segment text NOT NULL CHECK(segment IN ('all','inactive_30','one_away','new_7')),
  channel text NOT NULL CHECK(channel IN ('inapp','inapp_email')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','processing','sent','cancelled')),
  scheduled_at timestamptz, sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL
 )`;
 await q`CREATE INDEX IF NOT EXISTS marketing_campaigns_due_idx ON marketing_campaigns(status,scheduled_at)`;
 await q`CREATE INDEX IF NOT EXISTS marketing_campaigns_business_idx ON marketing_campaigns(business_id,created_at DESC)`;
 await q`CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notification_id text NOT NULL UNIQUE,
  email_state text NOT NULL DEFAULT 'none' CHECK(email_state IN ('none','pending','sending','sent','failed','skipped')),
  email_attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz, email_sent_at timestamptz, last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id,user_id)
 )`;
 await q`CREATE INDEX IF NOT EXISTS marketing_email_queue_idx ON marketing_campaign_recipients(email_state,created_at)`;
 await q`CREATE TABLE IF NOT EXISTS marketing_unsubscribe_tokens (
  token_hash text PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days'
 )`;
 await q`CREATE TABLE IF NOT EXISTS marketing_automations (
  id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, segment text NOT NULL CHECK(segment IN ('inactive_30','one_away','new_7')),
  title text NOT NULL, message text NOT NULL,
  channel text NOT NULL CHECK(channel IN ('inapp','inapp_email')),
  interval_days integer NOT NULL DEFAULT 7 CHECK(interval_days BETWEEN 7 AND 90),
  is_active boolean NOT NULL DEFAULT false,
  last_run_at timestamptz, next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
 )`;
}

async function recipients(sql:Sql,businessId:string,segment:Segment,limit:number) {
 const q=qsql(sql);
 // Never target a customer outside the authenticated business; only verified platform customer logins.
 // promotions defaults to false, and stale membership email fields are never used.
 return await q`SELECT DISTINCT ON (u.id) c.id AS customer_id,u.id AS user_id,u.email,
   COALESCE(p.preferences->'notifications','{}'::jsonb) AS preferences
  FROM customers c JOIN app_users u ON u.id=c.user_id AND u.role='customer' AND COALESCE(u.status,'active')='active'
  JOIN customer_profiles p ON p.user_id=u.id
  LEFT JOIN loyalty_cards card ON card.business_id=c.business_id
  LEFT JOIN customer_loyalties cl ON cl.customer_id=c.id AND cl.loyalty_card_id=card.id
  WHERE c.business_id=${businessId}::uuid
    AND COALESCE(p.preferences->'notifications'->>'promotions','false')='true'
    AND (
      ${segment}='all'
      OR (${segment}='inactive_30' AND c.created_at < now()-interval '30 days'
        AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.customer_id=c.id AND v.business_id=c.business_id AND v.created_at>now()-interval '30 days'))
      OR (${segment}='one_away' AND cl.current_stamps=card.required_stamps-1 AND card.required_stamps>1)
      OR (${segment}='new_7' AND c.created_at>=now()-interval '7 days')
    )
  ORDER BY u.id,c.created_at DESC LIMIT ${limit}`;
}
async function stats(sql:Sql,businessId:string,id:string) {
 const q=qsql(sql);
 const records=await q`SELECT COUNT(r.user_id)::int AS recipients,
 COUNT(r.user_id) FILTER(WHERE r.email_state='sent')::int AS emails_sent,
 COUNT(r.user_id) FILTER(WHERE r.email_state IN ('pending','sending','failed'))::int AS emails_waiting,
 COUNT(cr.user_id)::int AS viewed,
 COUNT(r.user_id) FILTER(WHERE EXISTS(
   SELECT 1 FROM visits v JOIN customers linked ON linked.id=v.customer_id
   WHERE linked.user_id=r.user_id AND v.business_id=c.business_id
     AND v.created_at > r.created_at AND v.created_at <= r.created_at + interval '7 days'
 ))::int AS returned_7d
 FROM marketing_campaigns c
 LEFT JOIN marketing_campaign_recipients r ON r.campaign_id=c.id
 LEFT JOIN customer_notification_reads cr ON cr.user_id=r.user_id AND cr.notification_key=r.notification_id
 WHERE c.id=${id}::uuid AND c.business_id=${businessId}::uuid`;
 return records[0]??{recipients:0,emails_sent:0,emails_waiting:0,viewed:0,returned_7d:0};
}
export async function handleBusinessCampaigns(path:string[],req:Request,sql:Sql,businessId:string,userId:string){
 const q=qsql(sql);
 const id=path[2],action=path[3];
 if(id&&!uuid.test(id))return reply({message:"Invalid campaign ID."},422);
 if(req.method==="GET"&&!id){
  const campaigns=await q`SELECT id,title,message,segment,channel,status,scheduled_at::text,sent_at::text,created_at::text
    FROM marketing_campaigns WHERE business_id=${businessId}::uuid ORDER BY created_at DESC LIMIT 100`;
  const automations=await q`SELECT id,name,title,message,segment,channel,interval_days,is_active,next_run_at::text,last_run_at::text
    FROM marketing_automations WHERE business_id=${businessId}::uuid ORDER BY created_at DESC LIMIT 50`;
  return reply({campaigns,automations});
 }
 if(req.method==="GET"&&id&&!action){
  const campaign=(await q`SELECT id,title,message,segment,channel,status,scheduled_at::text,sent_at::text,created_at::text
   FROM marketing_campaigns WHERE id=${id}::uuid AND business_id=${businessId}::uuid`)[0];
  if(!campaign)return reply({message:"Campaign not found."},404);
  return reply({campaign,analytics:await stats(sql,businessId,id)});
 }
 if(req.method==="GET"&&id&&action==="audience"){
  const row=(await q`SELECT segment FROM marketing_campaigns WHERE id=${id}::uuid AND business_id=${businessId}::uuid`)[0];
  if(!row)return reply({message:"Campaign not found."},404);
  const list=await recipients(sql,businessId,row.segment as Segment,501);
  return reply({eligible:Math.min(list.length,500),limited:list.length>500});
 }
 if(req.method==="POST"&&!id){
  if(!(await businessActive(sql,businessId)))return reply({message:"An active business subscription is required."},403);
  const body=await req.json().catch(()=>null) as Row|null;
  const title=String(body?.title??"").trim(),message=String(body?.message??"").trim();
  const segment=body?.segment,channel=safeChannel(body?.channel);
  if(!isSegment(segment)||title.length<3||title.length>80||message.length<10||message.length>300||/[<>]/.test(message))
   return reply({message:"Choose a segment and enter a title (3–80 chars) and plain-text message (10–300 chars)."},422);
  const recent=await q`SELECT count(*)::int AS n FROM marketing_campaigns WHERE business_id=${businessId}::uuid AND created_at>now()-interval '24 hours'`;
  if(Number(recent[0]?.n??0)>=8)return reply({message:"Daily campaign creation limit reached."},429);
  const created=await q`INSERT INTO marketing_campaigns(id,business_id,title,message,segment,channel,created_by)
   VALUES(${randomUUID()},${businessId}::uuid,${title},${message},${segment},${channel},${userId}::uuid)
   RETURNING id,title,message,segment,channel,status,created_at::text`;
  return reply({campaign:created[0]},201);
 }
 if(!id)return reply({message:"Invalid operation."},404);
 const row=(await q`SELECT id,status,segment FROM marketing_campaigns WHERE id=${id}::uuid AND business_id=${businessId}::uuid`)[0];
 if(!row)return reply({message:"Campaign not found."},404);
 if(req.method==="POST"&&action==="schedule"){
  if(row.status!=="draft")return reply({message:"Only drafts can be scheduled."},409);
  if(!(await businessActive(sql,businessId)))return reply({message:"Business subscription is inactive."},403);
  const body=await req.json().catch(()=>null) as Row|null;
  const date=String(body?.scheduled_at??"");
  const ts=Date.parse(date);
  if(!Number.isFinite(ts)||ts<Date.now()+60_000||ts>Date.now()+90*86400000)return reply({message:"Schedule between 1 minute and 90 days from now."},422);
  const updated=await q`UPDATE marketing_campaigns SET status='scheduled',scheduled_at=${new Date(ts).toISOString()}::timestamptz,updated_at=now()
    WHERE id=${id}::uuid AND business_id=${businessId}::uuid AND status='draft' RETURNING id`;
  return reply({scheduled:Boolean(updated.length)});
 }
 if(req.method==="POST"&&action==="send"){
  if(row.status!=="draft")return reply({message:"Only drafts can be sent."},409);
  if(!(await businessActive(sql,businessId)))return reply({message:"Business subscription is inactive."},403);
  const today=await q`SELECT count(*)::int AS n FROM marketing_campaigns WHERE business_id=${businessId}::uuid AND sent_at>now()-interval '24 hours'`;
  if(Number(today[0]?.n??0)>=3)return reply({message:"Limit: three campaigns per 24 hours per business."},429);
  await q`UPDATE marketing_campaigns SET status='scheduled',scheduled_at=now(),updated_at=now()
   WHERE id=${id}::uuid AND business_id=${businessId}::uuid AND status='draft'`;
  await deliverCampaign(sql,id);
  return reply({message:"Campaign processed. Check analytics for recipients.",analytics:await stats(sql,businessId,id)});
 }
 if(req.method==="POST"&&action==="cancel"){
  const cancelled=await q`UPDATE marketing_campaigns SET status='cancelled',updated_at=now()
    WHERE id=${id}::uuid AND business_id=${businessId}::uuid AND status IN ('draft','scheduled') RETURNING id`;
  return reply({cancelled:Boolean(cancelled.length)});
 }
 if(req.method==="DELETE"&&!action){
  const deleted=await q`DELETE FROM marketing_campaigns WHERE id=${id}::uuid AND business_id=${businessId}::uuid AND status='draft' RETURNING id`;
  return reply({deleted:Boolean(deleted.length)});
 }
 return reply({message:"Route not found."},404);
}

export async function handleAutomations(path:string[],req:Request,sql:Sql,businessId:string){
 const q=qsql(sql),id=path[2];
 if(req.method==="POST"&&!id){
  if(!(await businessActive(sql,businessId)))return reply({message:"An active business subscription is required."},403);
  const body=await req.json().catch(()=>null) as Row|null;
  const title=String(body?.title??"").trim(),message=String(body?.message??"").trim();
  const segment=body?.segment,interval=Number(body?.interval_days??14),name=String(body?.name??"").trim();
  if(!isSegment(segment)||segment==="all"||name.length<3||name.length>60||title.length<3||title.length>80||
    message.length<10||message.length>300||/[<>]/.test(message)||!Number.isInteger(interval)||interval<7||interval>90)return reply({message:"Invalid automation details."},422);
  const count=await q`SELECT count(*)::int AS n FROM marketing_automations WHERE business_id=${businessId}::uuid`;
  if(Number(count[0]?.n??0)>=5)return reply({message:"Maximum five automations per business."},429);
  const created=await q`INSERT INTO marketing_automations(id,business_id,name,segment,title,message,channel,interval_days,is_active,next_run_at)
   VALUES(${randomUUID()},${businessId}::uuid,${name},${segment},${title},${message},${safeChannel(body?.channel)},${interval},false,now()+interval '1 day')
   RETURNING id,name,segment,channel,is_active,interval_days,next_run_at::text`;
  return reply({automation:created[0]},201);
 }
 if(!id||!uuid.test(id))return reply({message:"Invalid automation."},422);
 if(req.method==="PATCH"){
  const body=await req.json().catch(()=>null) as Row|null;
  if(typeof body?.is_active!=="boolean")return reply({message:"Invalid state."},422);
  if(body.is_active&&!(await businessActive(sql,businessId)))return reply({message:"Business subscription is inactive."},403);
  const updated=await q`UPDATE marketing_automations SET is_active=${body.is_active},next_run_at=CASE WHEN ${body.is_active} THEN now()+interval '1 day' ELSE next_run_at END
   WHERE id=${id}::uuid AND business_id=${businessId}::uuid RETURNING id,is_active`;
  return updated.length?reply({automation:updated[0]}):reply({message:"Automation not found."},404);
 }
 if(req.method==="DELETE"){
  const deleted=await q`DELETE FROM marketing_automations WHERE id=${id}::uuid AND business_id=${businessId}::uuid RETURNING id`;
  return reply({deleted:Boolean(deleted.length)});
 }
 return reply({message:"Method not allowed."},405);
}

async function deliverCampaign(sql:Sql,campaignId:string){
 const q=qsql(sql);
 // Atomically claim once, preventing concurrent cron ticks and manual sends from repeating work.
 const claimed=await q`UPDATE marketing_campaigns SET status='processing',updated_at=now()
   WHERE id=${campaignId}::uuid AND ((status='scheduled' AND scheduled_at<=now()) OR (status='processing' AND updated_at<now()-interval '15 minutes'))
   AND EXISTS(SELECT 1 FROM businesses b JOIN business_subscriptions s ON s.business_id=b.id
      WHERE b.id=marketing_campaigns.business_id AND COALESCE(b.status,'active')='active'
        AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now())
   RETURNING id,business_id,title,message,segment,channel`;
 if(!claimed.length)return false;
 const c=claimed[0],businessId=String(c.business_id),segment=c.segment as Segment;
 // The campaign snapshot is calculated at send time; no cross-business targeting possible.
 const audience=await recipients(sql,businessId,segment,501);
 if(audience.length>500){await q`UPDATE marketing_campaigns SET status='cancelled',updated_at=now() WHERE id=${campaignId}::uuid`;return false;}
 const userIds=audience.map(x=>String(x.user_id));
 const customerIds=audience.map(x=>String(x.customer_id));
 if(userIds.length){
  // One atomic statement for recipients and inbox events; avoids hundreds of serverless DB round trips.
  await q`WITH targets AS (
    SELECT customer_id,user_id FROM unnest(${customerIds}::uuid[],${userIds}::uuid[]) AS x(customer_id,user_id)
  ), inserted AS (
    INSERT INTO marketing_campaign_recipients(campaign_id,customer_id,user_id,notification_id,email_state)
    SELECT ${campaignId}::uuid,t.customer_id,t.user_id,
      concat('campaign-',${campaignId}::text,'-',t.user_id::text),
      CASE WHEN ${String(c.channel)}='inapp_email'
        AND COALESCE(p.preferences->'notifications'->>'email_updates','false')='true' THEN 'pending' ELSE 'none' END
    FROM targets t JOIN customers member ON member.id=t.customer_id AND member.business_id=${businessId}::uuid AND member.user_id=t.user_id
      JOIN app_users u ON u.id=t.user_id AND u.role='customer' AND COALESCE(u.status,'active')='active'
      JOIN customer_profiles p ON p.user_id=t.user_id
    WHERE COALESCE(p.preferences->'notifications'->>'promotions','false')='true'
     AND NOT EXISTS(SELECT 1 FROM marketing_campaign_recipients prev JOIN marketing_campaigns old ON old.id=prev.campaign_id
       WHERE prev.user_id=t.user_id AND old.business_id=${businessId}::uuid AND prev.created_at>now()-interval '7 days')
     AND NOT EXISTS(SELECT 1 FROM marketing_campaign_recipients prev WHERE prev.user_id=t.user_id AND prev.created_at>now()-interval '48 hours')
    ON CONFLICT DO NOTHING RETURNING customer_id,user_id,notification_id
  )
  INSERT INTO customer_notifications(id,customer_id,type,title,message)
    SELECT notification_id,customer_id,'campaign',${String(c.title)},${String(c.message)} FROM inserted
    ON CONFLICT(id) DO NOTHING`;
 }
 await q`UPDATE marketing_campaigns SET status='sent',sent_at=now(),updated_at=now() WHERE id=${campaignId}::uuid AND status='processing'`;
 return true;
}

export async function runCampaignAutomation(sql:Sql,limit=3){
 const q=qsql(sql);
 const rules=await q`SELECT a.id,a.business_id,a.title,a.message,a.segment,a.channel,a.interval_days
  FROM marketing_automations a JOIN businesses b ON b.id=a.business_id
  JOIN business_subscriptions s ON s.business_id=b.id
  WHERE a.is_active=true AND a.next_run_at<=now() AND COALESCE(b.status,'active')='active'
    AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now()
  ORDER BY a.next_run_at LIMIT ${limit}`;
 let created=0;
 for(const rule of rules){
  const campaignId=randomUUID();
  const moved=await q`UPDATE marketing_automations SET last_run_at=now(),next_run_at=now()+(interval '1 day'*interval_days)
   WHERE id=${String(rule.id)}::uuid AND is_active=true AND next_run_at<=now() RETURNING id`;
  if(!moved.length)continue;
  await q`INSERT INTO marketing_campaigns(id,business_id,title,message,segment,channel,status,scheduled_at)
   VALUES(${campaignId},${String(rule.business_id)}::uuid,${String(rule.title)},${String(rule.message)},${String(rule.segment)},${String(rule.channel)},'scheduled',now())`;
  await deliverCampaign(sql,campaignId);created++;
 }
 return created;
}

export async function runCampaignQueue(sql:Sql,limit=15){
 const q=qsql(sql);
 const rows=await q`SELECT id FROM marketing_campaigns WHERE (status='scheduled' AND scheduled_at<=now()) OR (status='processing' AND updated_at<now()-interval '15 minutes') ORDER BY scheduled_at LIMIT ${limit}`;
 let delivered=0;
 for(const row of rows) if(await deliverCampaign(sql,String(row.id)))delivered++;
 return delivered;
}

export async function runCampaignEmails(sql:Sql,limit=12,origin=""){
 const q=qsql(sql);
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL||"";
 if(!key||!from||!origin)return { sent:0, skipped:"Email not configured" };
 const jobs=await q`UPDATE marketing_campaign_recipients r SET email_state='sending',claimed_at=now(),email_attempts=email_attempts+1
  FROM (SELECT campaign_id,user_id FROM marketing_campaign_recipients
    WHERE (email_state IN ('pending','failed')
        OR (email_state='sending' AND claimed_at<now()-interval '15 minutes')) AND email_attempts<3
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ${limit}) todo
  WHERE r.campaign_id=todo.campaign_id AND r.user_id=todo.user_id
  RETURNING r.campaign_id,r.user_id`;
 let sent=0;
 for(const job of jobs){
  const recipient=(await q`SELECT c.title,c.message,b.name AS business_name,u.email,u.id AS user_id,
     r.campaign_id,r.user_id AS recipient_id,b.id AS business_id
   FROM marketing_campaign_recipients r
   JOIN marketing_campaigns c ON c.id=r.campaign_id
   JOIN businesses b ON b.id=c.business_id
   JOIN app_users u ON u.id=r.user_id AND u.role='customer' AND COALESCE(u.status,'active')='active'
   JOIN customer_profiles p ON p.user_id=u.id
   JOIN business_subscriptions bs ON bs.business_id=b.id
   WHERE r.campaign_id=${job.campaign_id}::uuid AND r.user_id=${job.user_id}::uuid
     AND c.status='sent' AND COALESCE(b.status,'active')='active'
     AND COALESCE(bs.paid_ends_at,bs.trial_ends_at)>now()
     AND COALESCE(p.preferences->'notifications'->>'promotions','false')='true'
     AND COALESCE(p.preferences->'notifications'->>'email_updates','false')='true'`)[0];
  if(!recipient){
   await q`UPDATE marketing_campaign_recipients SET email_state='skipped',claimed_at=NULL WHERE campaign_id=${job.campaign_id}::uuid AND user_id=${job.user_id}::uuid`;
   continue;
  }
  // One per user/business unsubscribe token, stored only as a SHA-256 digest.
  const token=randomBytes(32).toString("hex"),unsub=origin+"/api/campaigns/unsubscribe?token="+token;
  await q`INSERT INTO marketing_unsubscribe_tokens(token_hash,business_id,user_id) VALUES(${hash(token)},${String(recipient.business_id)}::uuid,${String(recipient.user_id)}::uuid)`;
  try{
   const subject=`${String(recipient.business_name).slice(0,45)}: ${String(recipient.title)}`;
   const html=`<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto"><h2>${esc(String(recipient.title))}</h2><p>${esc(String(recipient.message))}</p><p style="color:#666;font-size:12px">${esc(String(recipient.business_name))} via LOYVANCE</p><p><a href="${esc(unsub)}">Unsubscribe from promotional emails</a></p></div>`;
   const resp=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`campaign-${job.campaign_id}-${job.user_id}`},
     body:JSON.stringify({from,to:[String(recipient.email)],subject,html,headers:{"List-Unsubscribe":`<${unsub}>`},tags:[{name:"category",value:"campaign"}]})});
   if(!resp.ok)throw Error("Resend rejected email with HTTP "+resp.status);
   await q`UPDATE marketing_campaign_recipients SET email_state='sent',email_sent_at=now(),claimed_at=NULL,last_error='' WHERE campaign_id=${job.campaign_id}::uuid AND user_id=${job.user_id}::uuid`;
   sent++;
  }catch(e){
   const message=e instanceof Error?e.message:"Email delivery failed";
   await q`UPDATE marketing_campaign_recipients SET email_state='failed',claimed_at=NULL,last_error=${message.slice(0,180)} WHERE campaign_id=${job.campaign_id}::uuid AND user_id=${job.user_id}::uuid`;
  }
 }
 return {sent};
}

export async function unsubscribeCampaignEmail(req:Request,sql:Sql){
 if(req.method!=="GET")return reply({message:"Method not allowed."},405);
 const token=new URL(req.url).searchParams.get("token")??"";
 if(!/^[0-9a-f]{64}$/.test(token))return new Response("Invalid unsubscribe link.",{status:400,headers:{"Content-Type":"text/plain","Referrer-Policy":"no-referrer"}});
 const q=qsql(sql);
 const row=(await q`DELETE FROM marketing_unsubscribe_tokens WHERE token_hash=${hash(token)} AND expires_at>now()
  RETURNING user_id`)[0];
 if(!row)return new Response("Link expired or already used. Change promotional settings in your LOYVANCE account.",{status:410,headers:{"Content-Type":"text/plain","Referrer-Policy":"no-referrer"}});
 await q`UPDATE customer_profiles SET preferences=jsonb_set(COALESCE(preferences,'{}'::jsonb),'{notifications,promotions}','false'::jsonb,true),updated_at=now()
  WHERE user_id=${row.user_id}::uuid`;
 return new Response("Promotional notifications and emails have been disabled for your LOYVANCE account. You can change this in Settings.",{headers:{"Content-Type":"text/plain; charset=utf-8","Referrer-Policy":"no-referrer","Cache-Control":"no-store"}});
}
