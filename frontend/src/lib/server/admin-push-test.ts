import {randomUUID} from "node:crypto";
import type {getSql} from "@/lib/server/db";
import {pushIsConfigured,sendWebPush,type PushSubscriptionData} from "./web-push-crypto";
type Sql=ReturnType<typeof getSql>;
type Row=Record<string,unknown>;
const qsql=(sql:Sql)=>sql as unknown as {(p:TemplateStringsArray,...v:unknown[]):Promise<Row[]>};
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function handleAdminPushTest(req:Request,sql:Sql,adminId:string){
 const q=qsql(sql);
 if(req.method==="GET"){
  const users=await q`SELECT u.id,u.name,u.role,COUNT(s.id)::int AS devices
   FROM app_users u JOIN web_push_subscriptions s ON s.user_id=u.id
   WHERE u.role IN ('customer','business_owner') AND COALESCE(u.status,'active')='active'
   GROUP BY u.id,u.name,u.role ORDER BY u.name LIMIT 300`;
  return out({configured:pushIsConfigured(),users});
 }
 if(req.method!=="POST")return out({message:"Method not allowed"},405);
 if(!pushIsConfigured())return out({message:"Web Push VAPID is not configured."},503);
 const body=await req.json().catch(()=>null) as {user_id?:unknown}|null;
 const userId=typeof body?.user_id==="string"?body.user_id:"";
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId))return out({message:"Select a valid recipient."},422);
 const users=await q`SELECT id,name,role FROM app_users WHERE id=${userId}::uuid AND role IN ('customer','business_owner') AND COALESCE(status,'active')='active' LIMIT 1`;
 if(!users.length)return out({message:"Recipient not found."},404);
 await q`CREATE TABLE IF NOT EXISTS admin_push_test_limits(admin_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,last_sent_at timestamptz NOT NULL)`;
 const claimed=await q`INSERT INTO admin_push_test_limits(admin_id,last_sent_at) VALUES(${adminId}::uuid,now()) ON CONFLICT(admin_id) DO UPDATE SET last_sent_at=now() WHERE admin_push_test_limits.last_sent_at<now()-interval '30 seconds' RETURNING admin_id`;
 if(!claimed.length)return out({message:"Wait 30 seconds before the next test."},429);
 const devices=await q`SELECT endpoint,p256dh,auth_secret FROM web_push_subscriptions WHERE user_id=${userId}::uuid ORDER BY updated_at DESC LIMIT 10`;
 if(!devices.length)return out({message:"This account has no registered push-enabled device."},409);
 let accepted=0,failed=0,expired=0;
 for(const d of devices){
  try{
   const sub:PushSubscriptionData={endpoint:String(d.endpoint),keys:{p256dh:String(d.p256dh),auth:String(d.auth_secret)}};
   const result=await sendWebPush(sub,{title:"Loyvance · Notification test",body:"This is a test notification sent by the Loyvance administrator.",url:users[0].role==="customer"?"/user/dashboard":"/dashboard",tag:"loyvance-admin-test-"+randomUUID()});
   if(result.ok)accepted++;else {failed++;if(result.expired){expired++;await q`DELETE FROM web_push_subscriptions WHERE user_id=${userId}::uuid AND endpoint=${String(d.endpoint)}`;}}
  }catch{failed++;}
 }
 return out({accepted,failed,expired,total:devices.length,message:accepted>0?`Push provider accepted ${accepted} of ${devices.length} device requests. This does not prove the notification was displayed.`:"No push request was accepted. Check device subscriptions and VAPID configuration."},accepted>0?200:502);
}
