import { getSql } from "@/lib/server/db";
export const runtime = "nodejs";
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const html = (content:string)=>new Response('<!DOCTYPE html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOYVANCE email preferences</title><body style="font:16px Arial,sans-serif;line-height:1.6;max-width:480px;margin:10vh auto;padding:20px;color:#252525"><h1>LOYVANCE</h1>'+content+'</body></html>',{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
export async function GET(req:Request){
  const token=new URL(req.url).searchParams.get("token")||"";
  if(!uuid.test(token))return html("<p>This unsubscribe link is invalid.</p>");
  return html('<p>Stop receiving future LOYVANCE outreach messages?</p><form action="/api/outreach/unsubscribe?token='+encodeURIComponent(token)+'" method="POST"><button type="submit" style="padding:12px 20px;background:#161616;color:#fff;border:none;border-radius:9px">Unsubscribe</button></form>');
}
export async function POST(req:Request){
  const token=new URL(req.url).searchParams.get("token")||"";
  if(!uuid.test(token))return html("<p>This unsubscribe link is invalid.</p>");
  const sql=getSql();
  await sql`UPDATE loyvance_outreach_20261031 SET consent_status='unsubscribed',consent_at=NULL,
    consent_source='Recipient opted out using email link',
    status=CASE WHEN status IN ('prepared','failed','blocked') THEN 'unsubscribed' ELSE status END,updated_at=now()
    WHERE unsubscribe_token=${token}::uuid`;
  return html("<p>Your request has been recorded. You will not receive further LOYVANCE promotional emails through this outreach list.</p>");
}
