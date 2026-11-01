import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string,unknown>;
type Q = (strings:TemplateStringsArray,...values:unknown[])=>Promise<Row[]>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const result=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const safe=(input:unknown,max=120)=>typeof input==="string"?input.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,max).trim():"";
const pathOnly=(input:unknown)=>{const value=safe(input,500);if(!value.startsWith("/")||value.startsWith("//"))return "/";return value.split(/[?#]/,1)[0].slice(0,180)||"/";};
const geo=(value:string|null,max=80)=>{const raw=safe(value,max);try{return decodeURIComponent(raw.replace(/\+/g," ")).slice(0,max);}catch{return raw;}};
const country=(value:string|null)=>/^[A-Z]{2}$/.test(value||"")?value!:"";
const bot=(value:string)=>/bot|crawler|spider|headless|lighthouse|uptime|preview|curl|wget/i.test(value);
const countryCode=(value:string|null)=>country(value?.toUpperCase()??"");
const campaignCode=(input:unknown)=>{const value=safe(input,48).toLowerCase();return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value)?value:"";};
const sourceFrom=(ref:string)=>{
 if(!ref)return "Direct / unknown";
 try{
  const host=new URL(ref).hostname.toLowerCase().replace(/^www\./,"");
  if(!host)return "Direct / unknown";
  if(/(^|\.)google\./.test(host))return "Google";
  if(/(^|\.)bing\./.test(host))return "Bing";
  if(/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(host))return "Facebook";
  if(/(^|\.)instagram\.com$/.test(host))return "Instagram";
  if(/(^|\.)tiktok\.com$/.test(host))return "TikTok";
  if(/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/.test(host))return "WhatsApp";
  if(/(^|\.)linkedin\.com$/.test(host))return "LinkedIn";
  if(host==="loyvance.vercel.app"||host==="localhost")return "Internal / direct";
  return host.slice(0,80);
 }catch{return "Direct / unknown";}
};
function deviceFrom(ua:string){
 const device=/tablet|ipad/i.test(ua)?"Tablet":/mobile|android|iphone/i.test(ua)?"Mobile":"Desktop";
 const browser=/edg\//i.test(ua)?"Edge":/firefox\//i.test(ua)?"Firefox":/opr\//i.test(ua)?"Opera":/chrome\//i.test(ua)?"Chrome":/safari\//i.test(ua)?"Safari":"Other";
 const os=/android/i.test(ua)?"Android":/iphone|ipad|ios/i.test(ua)?"iOS":/windows/i.test(ua)?"Windows":/mac os/i.test(ua)?"macOS":/linux/i.test(ua)?"Linux":"Other";
 return {device,browser,os};
}

export async function ensureVisitorAnalyticsSchema(sql:Sql){
 // DDL IF NOT EXISTS alone is unsafe under concurrent Vercel cold starts.
 // A transaction-level Postgres advisory lock serializes table/type/index creation.
 await sql.transaction([
  sql`SELECT pg_advisory_xact_lock(229001, 22)`,
  sql`CREATE TABLE IF NOT EXISTS visitor_analytics_sessions(
  id uuid PRIMARY KEY, first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(), active_seconds integer NOT NULL DEFAULT 0,
  entry_path text NOT NULL, current_path text NOT NULL,
  referrer text NOT NULL DEFAULT '', traffic_source text NOT NULL DEFAULT 'Direct / unknown',
  country_code char(2), region text, city text,
  device text NOT NULL DEFAULT 'Other', browser text NOT NULL DEFAULT 'Other', os text NOT NULL DEFAULT 'Other',
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  pageviews integer NOT NULL DEFAULT 0, clicks integer NOT NULL DEFAULT 0
 )`,
  sql`ALTER TABLE visitor_analytics_sessions ADD COLUMN IF NOT EXISTS campaign_ref text`,
  sql`CREATE TABLE IF NOT EXISTS visitor_analytics_campaigns(
    code text PRIMARY KEY, label text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  // Soft deletion keeps historical campaign attribution and protects
  // existing sent links from accidentally being assigned to a new client.
  sql`ALTER TABLE visitor_analytics_campaigns ADD COLUMN IF NOT EXISTS archived_at timestamptz`,
  // Keep immutable campaign IDs and reserve every old URL as an alias.
  sql`ALTER TABLE visitor_analytics_campaigns ADD COLUMN IF NOT EXISTS public_code text`,
  sql`UPDATE visitor_analytics_campaigns SET public_code=code WHERE public_code IS NULL`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_public_code ON visitor_analytics_campaigns(public_code)`,
  sql`CREATE TABLE IF NOT EXISTS visitor_analytics_campaign_aliases(
    slug text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES visitor_analytics_campaigns(code)
  )`,
  sql`CREATE TABLE IF NOT EXISTS visitor_demo_requests(
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    contact_name text NOT NULL,
    business_name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL DEFAULT '',
    campaign_code text,
    emailed boolean NOT NULL DEFAULT false
  )`,
  sql`CREATE INDEX IF NOT EXISTS idx_visitor_demo_requests_created ON visitor_demo_requests(created_at DESC)`,
  // A monotonic submitted total means deletions never hide future new-lead alerts.
  sql`CREATE TABLE IF NOT EXISTS visitor_demo_request_metrics(
    singleton smallint PRIMARY KEY CHECK(singleton=1),
    total_submitted bigint NOT NULL DEFAULT 0
  )`,
  sql`INSERT INTO visitor_demo_request_metrics(singleton,total_submitted)
    SELECT 1,count(*) FROM visitor_demo_requests ON CONFLICT(singleton) DO NOTHING`,
  sql`INSERT INTO visitor_analytics_campaign_aliases(slug,campaign_code)
    SELECT code,code FROM visitor_analytics_campaigns ON CONFLICT(slug) DO NOTHING`,
  sql`CREATE TABLE IF NOT EXISTS visitor_analytics_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES visitor_analytics_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN ('page','click')),
  page_path text NOT NULL,target text,
  happened_at timestamptz NOT NULL DEFAULT now()
 )`,
  sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_first ON visitor_analytics_sessions(first_seen DESC)`,
  sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_last ON visitor_analytics_sessions(last_seen DESC)`,
  sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_events_session ON visitor_analytics_events(session_id,happened_at DESC)`,
  sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_events_recent ON visitor_analytics_events(happened_at DESC)`,
  sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_campaign_sessions ON visitor_analytics_sessions(campaign_ref,first_seen DESC)`
 ]);
}

export async function collectVisitorAnalytics(req:Request,sql:Sql,userId:string|null):Promise<Response>{
 if(req.method!=="POST")return result({message:"Method not allowed."},405);
 if(Number(req.headers.get("content-length")||0)>3072)return result({message:"Payload too large."},413);
 if(bot(req.headers.get("user-agent")??""))return result({ok:true});
 const data=await req.json().catch(()=>null) as Row|null;
 if(!data||Array.isArray(data))return result({message:"Invalid analytics event."},422);
 const id=safe(data.session_id,50);
 const action=safe(data.type,20);
 if(!uuid.test(id)||!["page","click","heartbeat"].includes(action))return result({message:"Invalid analytics event."},422);
 const page=pathOnly(data.path);
 const target=safe(data.target,200);
 const seconds=Number(data.seconds||0);
 if(!Number.isInteger(seconds)||seconds<0||seconds>60)return result({message:"Invalid activity interval."},422);
 const ua=safe(req.headers.get("user-agent"),500);
 const {device,browser,os}=deviceFrom(ua);
 const ref=safe(data.referrer,250);
 // Avoid recording query strings, fragments, email-like strings or credentials.
 let safeRef="";
 try{if(ref){const u=new URL(ref);if(["https:","http:"].includes(u.protocol))safeRef=(u.origin+u.pathname).slice(0,180);}}catch{}
 const traffic=sourceFrom(safeRef);
 const offeredCampaign=campaignCode(data.campaign_ref);
 const cc=countryCode(req.headers.get("x-vercel-ip-country"));
 const region=geo(req.headers.get("x-vercel-ip-country-region"),60)||null;
 const city=geo(req.headers.get("x-vercel-ip-city"),80)||null;
 // This is provider-supplied approximate IP geolocation, not GPS and not guaranteed.
 const q=sql as unknown as Q;
 // Stateless, first-party, per-tab ephemeral session UUID. No IP, GPS or fingerprint stored.
 const session=await q`INSERT INTO visitor_analytics_sessions(
   id,entry_path,current_path,referrer,traffic_source,country_code,region,city,device,browser,os,user_id,campaign_ref
 ) VALUES(
   ${id}::uuid,${page},${page},${safeRef},${traffic},${cc||null},${region},${city},${device},${browser},${os},${userId}::uuid,
   (SELECT a.campaign_code FROM visitor_analytics_campaign_aliases a
      JOIN visitor_analytics_campaigns c ON c.code=a.campaign_code
      WHERE a.slug=${offeredCampaign} AND c.archived_at IS NULL LIMIT 1)
 ) ON CONFLICT(id) DO UPDATE SET
   last_seen=now(),current_path=excluded.current_path,
   active_seconds=LEAST(visitor_analytics_sessions.active_seconds+${seconds},86400),
   user_id=COALESCE(visitor_analytics_sessions.user_id,excluded.user_id),
   campaign_ref=COALESCE(visitor_analytics_sessions.campaign_ref,excluded.campaign_ref)
 WHERE visitor_analytics_sessions.first_seen>now()-interval '1 day'
 RETURNING id`;
 if(!session.length)return result({message:"Session expired. Start a fresh tab session."},409);
 if(action==="page"||action==="click"){
  const cleanedTarget=action==="click"?target.split(/[?#]/,1)[0].slice(0,180):null;
  // Avoid storing repeated tracking pings as events. Limit noisy sessions.
  const count=await q`SELECT pageviews+clicks AS total FROM visitor_analytics_sessions WHERE id=${id}::uuid`;
  if(Number(count[0]?.total||0)<400){
   await sql.transaction([
     sql`INSERT INTO visitor_analytics_events(session_id,event_type,page_path,target)
       VALUES(${id}::uuid,${action},${page},${cleanedTarget})`,
     action==="page"?sql`UPDATE visitor_analytics_sessions SET pageviews=pageviews+1 WHERE id=${id}::uuid`:
       sql`UPDATE visitor_analytics_sessions SET clicks=clicks+1 WHERE id=${id}::uuid`,
   ]);
  }
 }
 return result({ok:true});
}

export async function adminVisitorAnalytics(req:Request,sql:Sql,path:string[]):Promise<Response>{
 const q=sql as unknown as Q;
 // Fast, low-overhead and admin-authenticated endpoint for the sidebar badge.
 if(path[2]==="demo-alerts" && path.length===3){
   if(req.method!=="GET")return result({message:"Method not allowed."},405);
   const rows=await q`SELECT total_submitted::int AS total
     FROM visitor_demo_request_metrics WHERE singleton=1`;
   return result({total:Number(rows[0]?.total??0)});
 }
 // Only platform admins can delete an individual demo enquiry.
 if(path[2]==="demo-requests" && path.length===4){
   if(req.method!=="DELETE")return result({message:"Method not allowed."},405);
   if(!uuid.test(path[3]||""))return result({message:"Invalid demo request."},422);
   const deleted=await q`DELETE FROM visitor_demo_requests WHERE id=${path[3]}::uuid RETURNING id::text`;
   return deleted.length?result({ok:true,id:deleted[0].id}):result({message:"Demo request not found."},404);
 }
 if(path[2]==="campaigns"){
   // Admin-only read to check URL uniqueness before committing the update.
   if(path[3]==="check" && path.length===4 && req.method==="GET"){
     const params=new URL(req.url).searchParams;
     const offered=campaignCode(params.get("code"));
     const excluded=campaignCode(params.get("exclude"));
     if(!offered)return result({available:false,valid:false,message:"Invalid tracking code."},422);
     const taken=await q`SELECT campaign_code FROM visitor_analytics_campaign_aliases WHERE slug=${offered} LIMIT 1`;
     return result({code:offered,valid:true,available:!taken.length || (excluded!=="" && taken[0].campaign_code===excluded)});
   }
   // Campaign labels + URL slug can be edited. Original identifiers and
   // old public URLs remain reserved for the same campaign after edits.
   if(path.length===4){
     const code=campaignCode(path[3]);
     if(!code)return result({message:"Invalid campaign code."},422);
     if(req.method==="PATCH"){
       if(Number(req.headers.get("content-length")||0)>2048)return result({message:"Payload too large."},413);
       const input=await req.json().catch(()=>null) as Row|null;
       const label=safe(input?.label,100);
       const requested=campaignCode(input?.public_code);
       if(label.length<2||/[<>@]/.test(label))return result({message:"Enter a business name between 2 and 100 characters."},422);
       if(!requested)return result({message:"Invalid tracking code."},422);
       // One SQL statement atomically reserves the requested URL. The
       // unique alias primary key is the final check against concurrent
       // attempts by other administrators.
       const edited=await q`WITH existing AS (
         SELECT code FROM visitor_analytics_campaigns
         WHERE code=${code} AND archived_at IS NULL
       ), reserved AS (
         INSERT INTO visitor_analytics_campaign_aliases(slug,campaign_code)
         SELECT ${requested},code FROM existing
         ON CONFLICT(slug) DO NOTHING RETURNING slug
       )
       UPDATE visitor_analytics_campaigns c
       SET label=${label},public_code=${requested}
       WHERE c.code=${code} AND c.archived_at IS NULL AND (
         EXISTS (SELECT 1 FROM reserved)
         OR EXISTS (SELECT 1 FROM visitor_analytics_campaign_aliases a
                    WHERE a.slug=${requested} AND a.campaign_code=${code})
       )
       RETURNING c.code,c.label,c.public_code,c.created_at::text`;
       if(edited.length)return result({campaign:edited[0]});
       const holder=await q`SELECT campaign_code FROM visitor_analytics_campaign_aliases WHERE slug=${requested} LIMIT 1`;
       if(holder.length && holder[0].campaign_code!==code)
         return result({message:"This tracking URL is already used by another campaign."},409);
       return result({message:"Campaign not found."},404);
     }
     if(req.method==="DELETE"){
       const archived=await q`UPDATE visitor_analytics_campaigns SET archived_at=now()
         WHERE code=${code} AND archived_at IS NULL RETURNING code`;
       return archived.length?result({ok:true,code:archived[0].code}):result({message:"Campaign not found."},404);
     }
     return result({message:"Method not allowed."},405);
   }
   if(path.length!==3)return result({message:"Not found."},404);
   if(req.method!=="POST")return result({message:"Method not allowed."},405);
   if(Number(req.headers.get("content-length")||0)>2048)return result({message:"Payload too large."},413);
   const body=await req.json().catch(()=>null) as Row|null;
   const code=campaignCode(body?.code);
   const label=safe(body?.label,100);
   if(!code||label.length<2||/[<>@]/.test(label))
     return result({message:"Enter a business name (2–100 characters) and a valid campaign code (3–48 letters, numbers or hyphens)."},422);
   const taken=await q`SELECT campaign_code FROM visitor_analytics_campaign_aliases WHERE slug=${code} LIMIT 1`;
   if(taken.length)return result({message:"This tracking URL is already used by another campaign."},409);
   const rows=await q`INSERT INTO visitor_analytics_campaigns(code,label,public_code) VALUES(${code},${label},${code})
     ON CONFLICT(code) DO NOTHING RETURNING code,label,public_code,created_at::text`;
   if(!rows.length)return result({message:"This campaign code is already in use. Choose a different one."},409);
   await q`INSERT INTO visitor_analytics_campaign_aliases(slug,campaign_code)
     VALUES(${code},${code}) ON CONFLICT(slug) DO NOTHING`;
   return result({campaign:rows[0]},201);
 }
 if(req.method!=="GET")return result({message:"Method not allowed."},405);
 const params=new URL(req.url).searchParams;
 const days=[7,30,90].includes(Number(params.get("days")))?Number(params.get("days")):7;
 const cutoff=new Date(Date.now()-days*86400000).toISOString();
 if(path[2]==="session" && uuid.test(path[3]||"")){
  const id=path[3];
  const [session,events]=await Promise.all([
   q`SELECT s.*,c.label AS campaign_name,u.name AS user_name,u.role AS user_role
    FROM visitor_analytics_sessions s
    LEFT JOIN app_users u ON u.id=s.user_id
    LEFT JOIN visitor_analytics_campaigns c ON c.code=s.campaign_ref
    WHERE s.id=${id}::uuid AND s.first_seen>=${cutoff}::timestamptz LIMIT 1`,
   q`SELECT event_type,page_path,target,happened_at::text FROM visitor_analytics_events
    WHERE session_id=${id}::uuid ORDER BY happened_at ASC,id ASC LIMIT 200`
  ]);
  if(!session.length)return result({message:"Visitor session not found."},404);
  return result({session:session[0],events});
 }
 if(path.length>2)return result({message:"Not found."},404);
 // Retain a rolling 90 days. Deleting sessions cascades their events.
 await sql`DELETE FROM visitor_analytics_sessions WHERE first_seen<now()-interval '90 days'`;
 const [totals,daily,pages,countries,cities,sources,devices,clicks,sessions,campaigns,demoRequests]=await Promise.all([
  q`SELECT count(*)::int AS sessions,COALESCE(sum(pageviews),0)::int AS pageviews,
    COALESCE(sum(clicks),0)::int AS clicks,
    COALESCE(round(avg(active_seconds)),0)::int AS avg_seconds,
    count(*) FILTER(WHERE last_seen>now()-interval '2 minutes')::int AS recently_active,
    count(*) FILTER(WHERE user_id IS NOT NULL)::int AS signed_in_sessions
    FROM visitor_analytics_sessions WHERE first_seen>=${cutoff}::timestamptz`,
  q`SELECT to_char((first_seen AT TIME ZONE 'UTC')::date,'YYYY-MM-DD') AS day,
    count(*)::int AS sessions,COALESCE(sum(pageviews),0)::int AS pageviews
    FROM visitor_analytics_sessions WHERE first_seen>=${cutoff}::timestamptz
    GROUP BY (first_seen AT TIME ZONE 'UTC')::date ORDER BY day ASC`,
  q`SELECT page_path AS name,count(*)::int AS views,count(DISTINCT session_id)::int AS sessions
    FROM visitor_analytics_events WHERE event_type='page' AND happened_at>=${cutoff}::timestamptz
    GROUP BY page_path ORDER BY views DESC LIMIT 30`,
  q`SELECT COALESCE(NULLIF(trim(country_code),'') ,'Unknown') AS country_code,count(*)::int AS sessions
    FROM visitor_analytics_sessions WHERE first_seen>=${cutoff}::timestamptz
    GROUP BY country_code ORDER BY sessions DESC LIMIT 25`,
  q`SELECT COALESCE(NULLIF(trim(country_code),'') ,'Unknown') AS country_code,
    COALESCE(NULLIF(city,''),'Unknown') AS city,COALESCE(NULLIF(region,''),'') AS region,
    count(*)::int AS sessions
    FROM visitor_analytics_sessions WHERE first_seen>=${cutoff}::timestamptz
    GROUP BY country_code,city,region ORDER BY sessions DESC LIMIT 30`,
  q`SELECT traffic_source AS name,count(*)::int AS sessions
    FROM visitor_analytics_sessions WHERE first_seen>=${cutoff}::timestamptz
    GROUP BY traffic_source ORDER BY sessions DESC LIMIT 20`,
  q`SELECT device AS name,count(*)::int AS sessions FROM visitor_analytics_sessions
    WHERE first_seen>=${cutoff}::timestamptz GROUP BY device ORDER BY sessions DESC`,
  q`SELECT target AS name,count(*)::int AS clicks FROM visitor_analytics_events
    WHERE event_type='click' AND happened_at>=${cutoff}::timestamptz AND target IS NOT NULL
    GROUP BY target ORDER BY clicks DESC LIMIT 30`,
  q`SELECT s.id::text,s.first_seen::text,s.last_seen::text,s.entry_path,s.current_path,s.referrer,
    s.traffic_source,s.campaign_ref,c.label AS campaign_name,
    trim(s.country_code) AS country_code,s.city,s.region,s.device,s.browser,s.os,
    s.active_seconds,s.pageviews,s.clicks,u.name AS user_name,u.role AS user_role
    FROM visitor_analytics_sessions s
    LEFT JOIN app_users u ON u.id=s.user_id
    LEFT JOIN visitor_analytics_campaigns c ON c.code=s.campaign_ref
    WHERE s.first_seen>=${cutoff}::timestamptz ORDER BY s.first_seen DESC LIMIT 80`,
  q`SELECT c.code,c.public_code,c.label,c.created_at::text,
    count(s.id)::int AS sessions,
    max(s.first_seen)::text AS last_visit
    FROM visitor_analytics_campaigns c
    LEFT JOIN visitor_analytics_sessions s ON s.campaign_ref=c.code
      AND s.first_seen>=${cutoff}::timestamptz
    WHERE c.archived_at IS NULL
    GROUP BY c.code,c.label,c.created_at
    ORDER BY sessions DESC,c.created_at DESC`,
  q`SELECT id::text,created_at::text,contact_name,business_name,email,message,campaign_code,emailed
    FROM visitor_demo_requests
    WHERE created_at>=now()-interval '90 days'
    ORDER BY created_at DESC LIMIT 100`
 ]);
 return result({days,totals:totals[0],daily,pages,countries,cities,sources,devices,clicks,sessions,campaigns,demoRequests});
}
