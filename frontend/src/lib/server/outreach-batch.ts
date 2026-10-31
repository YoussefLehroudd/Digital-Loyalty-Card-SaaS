import { createHash } from "node:crypto";
import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type Query = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Row[]>;
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] || char));

/** Process a bounded batch after one administrator click; no client-side recipient selection. */
export async function sendOutreachBatch(req: Request, database: Sql): Promise<Response> {
  if (req.method !== "POST") return reply({ message: "Method not allowed." }, 405);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL;
  if (!apiKey || !from) return reply({ message: "Resend sender not configured." }, 503);
  const input = await req.json().catch(() => ({})) as Row;
  if (input.confirm !== true) return reply({ message: "Administrator must initiate sending." }, 422);
  const sql = database as unknown as Query;
  // Duplicate email addresses are collapsed and addresses already contacted are suppressed.
  // Lock and claim the selected records atomically to avoid overlapping dashboard sends.
  const claimed = await sql`
    WITH ranked AS (
      SELECT o.campaign_code, row_number() OVER
        (PARTITION BY lower(o.contact_email) ORDER BY o.created_at, o.campaign_code) AS ordinal
      FROM loyvance_outreach_20261031 o
      WHERE o.deleted_at IS NULL AND o.status='prepared'
        AND o.b2b_review_status <> 'rejected' AND o.consent_status <> 'unsubscribed'
        AND (o.consent_status='opted_in' AND length(COALESCE(o.consent_source,''))>=8
          OR (o.b2b_review_status='approved' AND o.b2b_country IN ('GB','IE','CA','US')
            AND o.b2b_publication_checked=true AND o.b2b_role_relevant=true
            AND o.b2b_no_opt_out_notice=true AND o.b2b_reviewed_at IS NOT NULL
            AND length(COALESCE(o.b2b_review_notes,''))>=20
            AND length(COALESCE(o.source_url,''))>12
            AND (o.b2b_country NOT IN ('GB','IE') OR o.b2b_business_type='corporate')))
        AND o.email_subject IS NOT NULL AND o.email_body IS NOT NULL
        AND o.contact_email ~* '^[^ @]+@[^ @]+\.[^ @]+$'
        AND NOT EXISTS (
          SELECT 1 FROM loyvance_outreach_20261031 prior
          WHERE lower(prior.contact_email)=lower(o.contact_email)
            AND prior.campaign_code<>o.campaign_code
            AND prior.status IN ('sending','sent','delivered')
        )
    ), chosen AS (
      SELECT o.campaign_code FROM loyvance_outreach_20261031 o
      JOIN ranked r ON r.campaign_code=o.campaign_code AND r.ordinal=1
      ORDER BY o.created_at,o.campaign_code LIMIT 20
      FOR UPDATE OF o SKIP LOCKED
    )
    UPDATE loyvance_outreach_20261031 o
    SET status='sending',attempted_at=now(),attempt_count=attempt_count+1,error=NULL,updated_at=now()
    FROM chosen c WHERE o.campaign_code=c.campaign_code AND o.status='prepared'
    RETURNING o.campaign_code,o.contact_email,o.email_subject,o.email_body,o.unsubscribe_token::text
  `;
  const recipients = claimed.map(row => ({
    campaign_code: String(row.campaign_code),
    contact_email: String(row.contact_email),
    email_subject: String(row.email_subject),
    email_body: String(row.email_body),
    unsubscribe_token: String(row.unsubscribe_token),
  }));
  if (!recipients.length) return reply({ results: [], remaining: 0 });

  const emails = recipients.map(row => {
    const tracking = "https://loyvance.vercel.app/?ref=" + encodeURIComponent(row.campaign_code);
    const unsubscribe = "https://loyvance.vercel.app/api/outreach/unsubscribe?token=" +
      encodeURIComponent(row.unsubscribe_token);
    const body = row.email_body.includes(tracking) ? row.email_body : row.email_body + "\n\n" + tracking;
    return {
      from, reply_to: process.env.OUTREACH_REPLY_TO || from, to: [row.contact_email], subject: row.email_subject,
      html: '<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.65;color:#252525">' +
        escapeHtml(body) + '</div><p style="font:12px Arial,sans-serif;margin-top:24px"><a href="' +
        unsubscribe + '">Unsubscribe from future LOYVANCE emails</a></p>',
      headers: {
        "List-Unsubscribe": "<" + unsubscribe + ">",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });
  const key = "loyvance-outreach-batch-" +
    createHash("sha256").update(recipients.map(row => row.campaign_code).join("|")).digest("hex");
  const results: Array<{ campaign_code: string; status: string; error?: string }> = [];
  try {
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(emails),
    });
    const payload = await response.json().catch(() => ({})) as {
      data?: Array<{ id?: string }>; message?: string;
    };
    if (!response.ok || !Array.isArray(payload.data) || payload.data.length !== recipients.length ||
      payload.data.some(item => !item.id)) {
      throw new Error((payload.message || "Resend could not accept this batch.").slice(0, 300));
    }
    for (let index = 0; index < recipients.length; index++) {
      const code = recipients[index].campaign_code;
      const id = payload.data[index].id!;
      await sql`UPDATE loyvance_outreach_20261031
        SET status='sent',sent_at=now(),sender_email=${from},provider='resend',
            provider_message_id=${id},error=NULL,updated_at=now()
        WHERE campaign_code=${code} AND status='sending'`;
      results.push({ campaign_code: code, status: "sent" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Batch request failed.";
    for (const item of recipients) {
      await sql`UPDATE loyvance_outreach_20261031
        SET status='failed',failed_at=now(),error=${message},updated_at=now()
        WHERE campaign_code=${item.campaign_code} AND status='sending'`;
      if (!results.some(result => result.campaign_code === item.campaign_code))
        results.push({ campaign_code: item.campaign_code, status: "failed", error: message });
    }
  }
  const remaining = await sql`SELECT count(DISTINCT lower(o.contact_email))::int AS total
    FROM loyvance_outreach_20261031 o WHERE o.deleted_at IS NULL AND o.status='prepared'
      AND o.b2b_review_status <> 'rejected' AND o.consent_status <> 'unsubscribed'
      AND (o.consent_status='opted_in' AND length(COALESCE(o.consent_source,''))>=8
        OR (o.b2b_review_status='approved' AND o.b2b_country IN ('GB','IE','CA','US')
          AND o.b2b_publication_checked=true AND o.b2b_role_relevant=true
          AND o.b2b_no_opt_out_notice=true AND o.b2b_reviewed_at IS NOT NULL
          AND length(COALESCE(o.b2b_review_notes,''))>=20
          AND length(COALESCE(o.source_url,''))>12
          AND (o.b2b_country NOT IN ('GB','IE') OR o.b2b_business_type='corporate')))
      AND o.email_subject IS NOT NULL AND o.email_body IS NOT NULL
      AND o.contact_email ~* '^[^ @]+@[^ @]+\.[^ @]+$'
      AND NOT EXISTS (
        SELECT 1 FROM loyvance_outreach_20261031 prior
        WHERE lower(prior.contact_email)=lower(o.contact_email)
          AND prior.campaign_code<>o.campaign_code
          AND prior.status IN ('sending','sent','delivered')
      )`;
  return reply({
    results, remaining: Number(remaining[0]?.total || 0),
    note: "Sent means accepted by Resend, not yet confirmed delivered.",
  });
}
