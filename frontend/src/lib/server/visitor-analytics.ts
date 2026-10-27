import type { getSql } from "@/lib/server/db";
import { createHash } from "crypto";

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
 await sql`CREATE TABLE IF NOT EXISTS visitor_analytics_sessions(
  id uuid PRIMARY KEY, first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(), active_seconds integer NOT NULL DEFAULT 0,
  entry_path text NOT NULL, current_path text NOT NULL,
  referrer text NOT NULL DEFAULT '', traffic_source text NOT NULL DEFAULT 'Direct / unknown',
  country_code char(2), region text, city text,
  device text NOT NULL DEFAULT 'Other', browser text NOT NULL DEFAULT 'Other', os text NOT NULL DEFAULT 'Other',
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  pageviews integer NOT NULL DEFAULT 0, clicks integer NOT NULL DEFAULT 0
 )`;
 await sql`CREATE TABLE IF NOT EXISTS visitor_analytics_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES visitor_analytics_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN ('page','click')),
  page_path text NOT NULL,target text,
  happened_at timestamptz NOT NULL DEFAULT now()
 )`;
 await sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_first ON visitor_analytics_sessions(first_seen DESC)`;
 await sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_last ON visitor_analytics_sessions(last_seen DESC)`;
 await sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_events_session ON visitor_analytics_events(session_id,happened_at DESC)`;
 await sql`CREATE INDEX IF NOT EXISTS idx_visitor_analytics_events_recent ON visitor_analytics_events(happened_at DESC)`;
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
 const cc=countryCode(req.headers.get("x-vercel-ip-country"));
 const region=geo(req.headers.get("x-vercel-ip-country-region"),60)||null;
 const city=geo(req.headers.get("x-vercel-ip-city"),80)||null;
 // This is provider-supplied approximate IP geolocation, not GPS and not guaranteed.
 const q=sql as unknown as Q;
 // Stateless, first-party, per-tab ephemeral session UUID. No IP, GPS or fingerprint stored.
 const session=await q`INSERT INTO visitor_analytics_sessions(
   id,entry_path,current_path,referrer,traffic_source,country_code,region,city,device,browser,os,user_id
 ) VALUES(
   ${id}::uuid,${page},${page},${safeRef},${traffic},${cc||null},${region},${city},${device},${browser},${os},${userId}::uuid
 ) ON CONFLICT(id) DO UPDATE SET
   last_seen=now(),current_path=excluded.current_path,
   active_seconds=LEAST(visitor_analytics_sessions.active_seconds+${seconds},86400),
   user_id=COALESCE(visitor_analytics_sessions.user_id,excluded.user_id)
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
 if(req.method!=="GET")return result({message:"Method not allowed."},405);
 const q=sql as unknown as Q;
 const params=new URL(req.url).searchParams;
 const days=[7,30,90].includes(Number(params.get("days")))?Number(params.get("days")):7;
 const cutoff=new Date(Date.now()-days*86400000).toISOString();
 if(path[2]==="session" && uuid.test(path[3]||"")){
  const id=path[3];
  const [session,events]=await Promise.all([
   q`SELECT s.*,u.name AS user_name,u.role AS user_role FROM visitor_analytics_sessions s
    LEFT JOIN app_users u ON u.id=s.user_id WHERE s.id=${id}::uuid AND s.first_seen>=${cutoff}::timestamptz LIMIT 1`,
   q`SELECT event_type,page_path,target,happened_at::text FROM visitor_analytics_events
    WHERE session_id=${id}::uuid ORDER BY happened_at ASC,id ASC LIMIT 200`
  ]);
  if(!session.length)return result({message:"Visitor session not found."},404);
  return result({session:session[0],events});
 }
 if(path.length>2)return result({message:"Not found."},404);
 // Retain a rolling 90 days. Deleting sessions cascades their events.
 await sql`DELETE FROM visitor_analytics_sessions WHERE first_seen<now()-interval '90 days'`;
 const [totals,daily,pages,countries,cities,sources,devices,clicks,sessions]=await Promise.all([
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
    s.traffic_source,trim(s.country_code) AS country_code,s.city,s.region,s.device,s.browser,s.os,
    s.active_seconds,s.pageviews,s.clicks,u.name AS user_name,u.role AS user_role
    FROM visitor_analytics_sessions s LEFT JOIN app_users u ON u.id=s.user_id
    WHERE s.first_seen>=${cutoff}::timestamptz ORDER BY s.first_seen DESC LIMIT 80`
 ]);
 return result({days,totals:totals[0],daily,pages,countries,cities,sources,devices,clicks,sessions});
}
