import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/server/db";
export const runtime = "nodejs";
function verified(payload: string, request: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature") || "";
  if (!secret?.startsWith("whsec_") || !id || !timestamp || !/^\d{10}$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  let key: Buffer;
  try { key = Buffer.from(secret.slice(6), "base64"); } catch { return false; }
  const expected = createHmac("sha256", key).update(id + "." + timestamp + "." + payload).digest();
  for (const part of signature.split(" ")) {
    if (!part.startsWith("v1,")) continue;
    const digest = Buffer.from(part.slice(3), "base64");
    if (digest.length === expected.length && timingSafeEqual(digest, expected)) return true;
  }
  return false;
}
export async function POST(req: Request) {
  const payload = await req.text();
  if (payload.length > 50000 || !verified(payload, req)) return new Response("Invalid signature", { status: 401 });
  let event: { type?: string; data?: { email_id?: string; created_at?: string } };
  try { event = JSON.parse(payload); } catch { return new Response("Invalid event", { status: 400 }); }
  const id = event.data?.email_id;
  if (!id || typeof id !== "string" || id.length > 128) return new Response("OK");
  const sql = getSql();
  if (event.type === "email.delivered") {
    await sql`UPDATE loyvance_outreach_20261031
       SET status='delivered',delivered_at=now(),last_delivery_event_at=now(),error=NULL,updated_at=now()
       WHERE provider_message_id=${id} AND provider='resend' AND status IN ('sent','sending')`;
  } else if (event.type === "email.bounced") {
    await sql`UPDATE loyvance_outreach_20261031
       SET status='bounced',failed_at=now(),last_delivery_event_at=now(),error='Recipient server bounced the message',updated_at=now(),
         consent_status='unsubscribed',consent_source='Suppressed following delivery bounce'
       WHERE provider_message_id=${id} AND provider='resend' AND status IN ('sent','sending','delivered')`;
  } else if (event.type === "email.failed" || event.type === "email.suppressed") {
    const rejected = event.type === "email.suppressed";
    const newStatus = rejected ? "blocked" : "failed";
    const explanation = rejected ? "Email provider suppressed this address" : "Email delivery failed";
    await sql`UPDATE loyvance_outreach_20261031
       SET status=${newStatus},failed_at=now(),last_delivery_event_at=now(),error=${explanation},updated_at=now()
       WHERE provider_message_id=${id} AND provider='resend' AND status IN ('sent','sending')`;
  } else if (event.type === "email.delivery_delayed") {
    await sql`UPDATE loyvance_outreach_20261031
       SET last_delivery_event_at=now(),error='Delivery delayed by receiving server',updated_at=now()
       WHERE provider_message_id=${id} AND provider='resend' AND status='sent'`;
  } else if (event.type === "email.complained") {
    await sql`UPDATE loyvance_outreach_20261031
       SET status='blocked',failed_at=now(),last_delivery_event_at=now(),error='Spam complaint: further messages suppressed',updated_at=now(),
         consent_status='unsubscribed',consent_source='Spam complaint'
       WHERE provider_message_id=${id} AND provider='resend'`;
  }
  return new Response("OK");
}
