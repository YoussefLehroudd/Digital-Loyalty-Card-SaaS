import {randomUUID} from "node:crypto";
import type {getSql} from "@/lib/server/db";
import {pushIsConfigured,pushPublicKey,sendWebPush,validateSubscription} from "./web-push-crypto";
type Sql=ReturnType<typeof getSql>;
type Row=Record<string,unknown>;
const qsql=(sql:Sql)=>sql as unknown as {(parts:TemplateStringsArray,...values:unknown[]):Promise<Row[]>};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function handlePushTest(req:Request,sql:Sql,userId:string,role:string,path:string[]){
 if(role!=="customer"&&role!=="business_owner")return reply({message:"Forbidden"},403);
 const q=qsql(sql);
 if(req.method==="GET"&&path[1]==="config")return reply({configured:pushIsConfigured(),public_key:pushIsConfigured()?pushPublicKey():null});
 if(req.method==="GET"&&path[1]==="device"){
  const endpoint=new URL(req.url).searchParams.get("endpoint")??"";
  const row=await q`SELECT count(*)::int AS devices FROM web_push_subscriptions WHERE user_id=${userId}::uuid AND endpoint=${endpoint}`;
  return reply({subscribed:Number(row[0]?.devices??0)>0});
 }
 if(req.method==="POST"&&path[1]==="subscribe"){
  if(!pushIsConfigured())return reply({message:"VAPID is not configured on this server."},503);
  const body=await req.json().catch(()=>null) as {subscription?:unknown}|null;
  const s=validateSubscription(body?.subscription);
  if(!s)return reply({message:"Invalid push subscription."},422);
  await q`INSERT INTO web_push_subscriptions(id,user_id,endpoint,p256dh,auth_secret) VALUES(${randomUUID()},${userId}::uuid,${s.endpoint},${s.keys.p256dh},${s.keys.auth})
    ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth_secret=EXCLUDED.auth_secret,updated_at=now(),
    created_at=CASE WHEN web_push_subscriptions.user_id=EXCLUDED.user_id THEN web_push_subscriptions.created_at ELSE now() END`;
  return reply({subscribed:true});
 }
 if(req.method==="POST"&&path[1]==="send"){
  if(!pushIsConfigured())return reply({message:"VAPID is not configured on this server."},503);
  const body=await req.json().catch(()=>null) as {endpoint?:unknown}|null;
  const endpoint=typeof body?.endpoint==="string"?body.endpoint:"";
  if(!endpoint||endpoint.length>2048)return reply({message:"Missing device subscription."},422);
  const devices=await q`SELECT endpoint,p256dh,auth_secret FROM web_push_subscriptions WHERE user_id=${userId}::uuid AND endpoint=${endpoint} LIMIT 1`;
  if(!devices.length)return reply({message:"This device is not registered for this account. Enable notifications first."},404);
  await q`CREATE TABLE IF NOT EXISTS push_test_limits(user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,last_sent_at timestamptz NOT NULL)`;
  const claim=await q`INSERT INTO push_test_limits(user_id,last_sent_at) VALUES(${userId}::uuid,now())
   ON CONFLICT(user_id) DO UPDATE SET last_sent_at=now() WHERE push_test_limits.last_sent_at<now()-interval '30 seconds' RETURNING user_id`;
  if(!claim.length)return reply({message:"Please wait 30 seconds before sending another test."},429);
  const device=devices[0];
  try{
   const result=await sendWebPush({endpoint:String(device.endpoint),keys:{p256dh:String(device.p256dh),auth:String(device.auth_secret)}},
    {title:"Loyvance · Push test",body:"Your test notification has been accepted by the browser push service.",url:role==="customer"?"/user/dashboard":"/dashboard",tag:"loyvance-push-test-"+randomUUID()});
   if(result.expired)await q`DELETE FROM web_push_subscriptions WHERE user_id=${userId}::uuid AND endpoint=${endpoint}`;
   return result.ok?reply({accepted:true,message:"Push service accepted the test. Check your phone; display is not guaranteed."}):reply({accepted:false,message:result.expired?"Subscription expired. Enable push again.":"Push service rejected the notification. Check VAPID configuration and retry."},502);
  }catch{return reply({accepted:false,message:"Push delivery failed. Check the server logs and VAPID settings."},502);}
 }
 return reply({message:"Not found"},404);
}
