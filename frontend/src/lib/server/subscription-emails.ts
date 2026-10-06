import type { getSql } from "@/lib/server/db";
import { subscriptionDate } from "@/lib/subscription";
type Sql=ReturnType<typeof getSql>;
type Email={to:string;subject:string;html:string;idempotencyKey:string};
const escape=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export async function runSubscriptionEmails(database: Sql, send: (email:Email)=>Promise<boolean>, limit=40, businessId?: string) {
  const sql=database as unknown as (parts:TemplateStringsArray,...values:unknown[])=>Promise<Array<Record<string,unknown>>>;
  // The expiry is part of the key: renewals suppress obsolete reminders and get fresh ones.
  await sql`INSERT INTO subscription_email_jobs(id,business_id,kind,period_ends_at)
    SELECT gen_random_uuid(),s.business_id,CASE WHEN COALESCE(s.paid_ends_at,s.trial_ends_at)<=now() THEN 'expired' ELSE 'ending' END,COALESCE(s.paid_ends_at,s.trial_ends_at)
    FROM business_subscriptions s JOIN businesses b ON b.id=s.business_id
    WHERE b.status='active' AND COALESCE(s.paid_ends_at,s.trial_ends_at)<=now()+interval '3 days'
    ON CONFLICT(business_id,kind,period_ends_at) DO NOTHING`;
  const rows=await sql`WITH candidates AS (SELECT j.id FROM subscription_email_jobs j WHERE (state='pending' OR (state='sending' AND claimed_at<now()-interval '10 minutes')) AND attempts<6 AND (${businessId ?? null}::uuid IS NULL OR business_id=${businessId ?? null}::uuid) ORDER BY claimed_at NULLS FIRST,id FOR UPDATE SKIP LOCKED LIMIT ${limit}),claimed AS (
    UPDATE subscription_email_jobs j SET state='sending',claimed_at=now(),attempts=attempts+1 FROM candidates c WHERE j.id=c.id RETURNING j.*
  ) SELECT j.*,j.period_ends_at::text AS period_ends_at,b.name,b.email,COALESCE(s.paid_ends_at,s.trial_ends_at)::text AS current_end FROM claimed j JOIN businesses b ON b.id=j.business_id JOIN business_subscriptions s ON s.business_id=j.business_id`;
  let sent=0,failed=0,skipped=0;
  for(const job of rows){
    if(job.kind!=='renewed'&&(new Date(String(job.period_ends_at)).getTime()!==new Date(String(job.current_end)).getTime() || (job.kind==='ending' && new Date(String(job.period_ends_at)).getTime()<=Date.now()))){
      await sql`UPDATE subscription_email_jobs SET state='skipped' WHERE id=${job.id}`;skipped++;continue;
    }
    const kind=String(job.kind),title=kind==='renewed'?"Your subscription has been renewed":kind==='expired'?"Your subscription has expired":"Your subscription expires soon";
    const message=kind==='renewed'?"Your subscription period has been updated by the administrator.":kind==='expired'?"Your data is preserved. Your workspace is read-only until renewal.":"Your subscription expires within 3 days. Renew to keep using your loyalty program.";
    const html=`<!doctype html><html lang="en"><body style="margin:0;background:#f5f4ef;font-family:Arial,sans-serif;color:#24251f"><table role="presentation" style="width:100%;padding:24px"><tr><td><table role="presentation" style="width:100%;max-width:560px;margin:auto;background:white;border:1px solid #e8e3d5;border-radius:16px"><tr><td style="padding:24px;border-bottom:2px solid #c79538;font-weight:bold;letter-spacing:3px">LOYVANCE</td></tr><tr><td style="padding:24px"><h1 style="font-size:22px">${title}</h1><p>Hello ${escape(job.name)},</p><p style="line-height:1.7">${message}</p><p><strong>Period ends:</strong> ${escape(subscriptionDate(String(job.period_ends_at)))} (Morocco time)</p><a href="https://loyvance.vercel.app/dashboard" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#c79538;color:#171912;text-decoration:none">View your subscription</a><p style="font-size:13px;line-height:1.7">Renewal assistance: 0644819899<br><a href="https://wa.me/212644819899">Contact LOYVANCE on WhatsApp</a></p></td></tr><tr><td style="padding:18px 24px;border-top:1px solid #eee;font-size:12px;color:#777">This message concerns your LOYVANCE subscription. There is no automatic charge.</td></tr></table></td></tr></table></body></html>`;
    try{const ok=await send({to:String(job.email),subject:`LOYVANCE · ${title}`,html,idempotencyKey:`subscription-${job.id}`});if(!ok)throw Error('Email provider rejected the request');
      await sql`UPDATE subscription_email_jobs SET state='sent',sent_at=now(),last_error='' WHERE id=${job.id}`;sent++;
    }catch{await sql`UPDATE subscription_email_jobs SET state='pending',last_error='Email delivery failed; will retry' WHERE id=${job.id}`;failed++;}
  }
  return {sent,failed,skipped};
}
