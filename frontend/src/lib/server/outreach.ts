import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type Q = (parts: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validCode = (value: string) => /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value);
const countryFromCity = (city: string): string => {
  const val = city.toLowerCase().trim();
  if (["london","manchester","glasgow","edinburgh"].includes(val)) return "GB";
  if (["toronto","vancouver"].includes(val)) return "CA";
  if (["new york","seattle","chicago"].includes(val)) return "US";
  if (["sydney","melbourne"].includes(val)) return "AU";
  if (val === "dublin") return "IE";
  if (val === "singapore") return "SG";
  return "";
};
const VALID_STATUSES = ["all", "prepared", "sent", "delivered", "sending", "failed", "bounced", "blocked", "unsubscribed"];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x] || x));

export async function adminOutreach(req: Request, database: Sql, path: string[]): Promise<Response> {
  const sql = database as unknown as Q;
  const search = new URL(req.url).searchParams;
  const code = clean(path[2], 48);
  if (path.length > 3) return reply({ message: "Not found." }, 404);

  if (path.length === 2 && req.method === "GET") {
    const page = Math.max(1, Math.min(10000, Math.floor(Number(search.get("page")) || 1)));
    const status = VALID_STATUSES.includes(search.get("status") || "") ? search.get("status")! : "all";
    const query = "%" + clean(search.get("q"), 100).replace(/[%_\\]/g, "\\$&") + "%";
    const perPage = 25;
    const [list, counts, ready] = await Promise.all([
      sql`SELECT o.campaign_code,o.business_name,o.contact_name,o.contact_email,o.business_city,
        o.sender_email,o.email_subject,o.status,o.consent_status,o.b2b_review_status,o.b2b_country,o.source_url,o.sent_at::text,o.delivered_at::text,
        o.error,o.content_origin,o.created_at::text,o.provider_message_id,
        COALESCE(c.public_code,o.campaign_code) AS public_code,
        (SELECT count(*)::int FROM visitor_analytics_sessions s WHERE s.campaign_ref=o.campaign_code) AS visits
        FROM loyvance_outreach_20261031 o
        LEFT JOIN visitor_analytics_campaigns c ON c.code=o.campaign_code
        WHERE o.deleted_at IS NULL
          AND (${status}='all' OR o.status=${status})
          AND (o.business_name ILIKE ${query} OR o.contact_email ILIKE ${query} OR o.campaign_code ILIKE ${query})
        ORDER BY o.created_at DESC,o.campaign_code ASC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      sql`SELECT status,count(*)::int AS count FROM loyvance_outreach_20261031 WHERE deleted_at IS NULL GROUP BY status`,
      sql`SELECT count(*)::int AS ready FROM loyvance_outreach_20261031
        WHERE deleted_at IS NULL AND status='prepared'
          AND consent_status <> 'unsubscribed' AND (consent_status='opted_in' AND length(COALESCE(consent_source,''))>=8
          OR (b2b_review_status='approved' AND b2b_country IN ('GB','CA','US')
            AND b2b_publication_checked=true AND b2b_role_relevant=true
            AND b2b_no_opt_out_notice=true AND b2b_reviewed_at IS NOT NULL
            AND length(COALESCE(b2b_review_notes,''))>=20
            AND length(COALESCE(source_url,''))>12
            AND (b2b_country<>'GB' OR b2b_business_type='corporate')))
          AND email_subject IS NOT NULL AND email_body IS NOT NULL`
    ]);
    const stats: Record<string, number> = {};
    for (const item of counts) stats[String(item.status)] = Number(item.count || 0);
    const total = await sql`SELECT count(*)::int AS total FROM loyvance_outreach_20261031 o WHERE o.deleted_at IS NULL AND (${status}='all' OR o.status=${status}) AND (o.business_name ILIKE ${query} OR o.contact_email ILIKE ${query} OR o.campaign_code ILIKE ${query})`;
    return reply({ data: list, page, per_page: perPage, total: Number(total[0]?.total || 0), stats, ready_to_send: Number(ready[0]?.ready || 0), configured: Boolean(process.env.RESEND_API_KEY && process.env.OUTREACH_FROM_EMAIL), configured_sender: process.env.OUTREACH_FROM_EMAIL || null });
  }
  if (path.length === 2 && req.method === "DELETE") {
    const body = await req.json().catch(() => ({})) as Row;
    if (body.confirm !== "DELETE ALL") return reply({ message: "Type DELETE ALL to confirm." }, 422);
    const removed = await sql`UPDATE loyvance_outreach_20261031 SET deleted_at=now(),updated_at=now()
      WHERE deleted_at IS NULL AND status<>'sending' RETURNING campaign_code`;
    return reply({ deleted: removed.length, note: "Outreach records hidden. Tracking links and historical visitor analytics preserved." });
  }

  if (path.length === 3 && validCode(code) && req.method === "GET") {
    const records = await sql`SELECT o.*,o.created_at::text,o.sent_at::text,o.attempted_at::text,
       o.delivered_at::text,o.failed_at::text,o.updated_at::text,o.consent_at::text,
       COALESCE(c.public_code,o.campaign_code) AS public_code
       FROM loyvance_outreach_20261031 o LEFT JOIN visitor_analytics_campaigns c ON c.code=o.campaign_code
       WHERE o.campaign_code=${code} AND o.deleted_at IS NULL LIMIT 1`;
    return records.length ? reply({ data: records[0] }) : reply({ message: "Outreach record not found." }, 404);
  }

  if (path.length === 3 && validCode(code) && req.method === "DELETE") {
    const deleted = await sql`UPDATE loyvance_outreach_20261031
      SET deleted_at=now(),updated_at=now()
      WHERE campaign_code=${code} AND deleted_at IS NULL AND status<>'sending'
      RETURNING campaign_code`;
    return deleted.length ? reply({ ok: true }) : reply({ message: "Record not found or currently sending." }, 409);
  }

  if (path.length === 3 && validCode(code) && req.method === "PATCH") {
    if (Number(req.headers.get("content-length") || 0) > 18000) return reply({ message: "Payload too large." }, 413);
    const input = await req.json().catch(() => ({})) as Row;
    const subject = clean(input.email_subject, 200);
    const message = clean(input.email_body, 12000);
    const contact = clean(input.contact_name, 120);
    const consent = clean(input.consent_status, 20);
    const source = clean(input.consent_source, 300);
    const reviewStatus = clean(input.b2b_review_status, 20);
    const businessType = clean(input.b2b_business_type, 30);
    const reviewNotes = clean(input.b2b_review_notes, 1200);
    const checked = input.b2b_publication_checked === true;
    const relevant = input.b2b_role_relevant === true;
    const noOptOut = input.b2b_no_opt_out_notice === true;
    if (!["pending","approved","rejected"].includes(reviewStatus)) return reply({message:"Invalid B2B review state."},422);
    if (!["unknown","corporate","sole_trader","other"].includes(businessType)) return reply({message:"Invalid business type."},422);
    const current = await sql`SELECT business_city,source_url,contact_email,status
      FROM loyvance_outreach_20261031 WHERE campaign_code=${code} AND deleted_at IS NULL LIMIT 1`;
    if (!current.length) return reply({message:"Contact not found."},404);
    const country = countryFromCity(String(current[0].business_city || ""));
    if (reviewStatus === "approved") {
      if (!["GB","CA","US"].includes(country)) return reply({message:"This country's outreach requires separate consent or legal review. Do not automatically approve public listings."},422);
      if (country==="GB" && businessType!=="corporate") return reply({message:"For UK B2B without prior opt-in, verify a registered corporate subscriber (not a sole trader)."},422);
      if (!checked || !relevant || !noOptOut || reviewNotes.length<20 || String(current[0].source_url||"").length<12)
        return reply({message:"Verify the original publication, business relevance, no objection, and document the basis for contact."},422);
    }
    if (subject.length < 5 || message.length < 30) return reply({ message: "Provide a subject and full email message." }, 422);
    if (!["unverified", "opted_in", "unsubscribed"].includes(consent)) return reply({ message: "Invalid consent status." }, 422);
    if (consent === "opted_in" && source.length < 8) return reply({ message: "Record evidence of the business's request or consent to receive email." }, 422);
    const saved = await sql`UPDATE loyvance_outreach_20261031
      SET email_subject=${subject},email_body=${message},contact_name=${contact || null},
        consent_status=${consent},consent_source=${source || null},
        consent_at=CASE WHEN ${consent}='opted_in' THEN COALESCE(consent_at,now()) ELSE NULL END,
        status=CASE WHEN ${consent}='unsubscribed' THEN 'unsubscribed' ELSE status END,
        b2b_review_status=${reviewStatus},b2b_review_notes=${reviewNotes||null},
        b2b_reviewed_at=CASE WHEN ${reviewStatus}='approved' THEN now() ELSE NULL END,
        b2b_country=${country||null},b2b_business_type=${businessType},
        b2b_publication_checked=${checked},b2b_role_relevant=${relevant},
        b2b_no_opt_out_notice=${noOptOut},
        content_origin='admin_edited',updated_at=now()
      WHERE campaign_code=${code} AND deleted_at IS NULL
        AND status IN ('prepared','failed')
      RETURNING campaign_code`;
    return saved.length ? reply({ ok: true }) : reply({ message: "This item cannot be edited while sending or after it has been sent." }, 409);
  }

  if (path.length === 3 && (code === "send" || code === "send-next") && req.method === "POST") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.OUTREACH_FROM_EMAIL;
    if (!apiKey || !from) return reply({ message: "Sending is not configured. Configure a verified OUTREACH_FROM_EMAIL and RESEND_API_KEY on Vercel." }, 503);
    const input = await req.json().catch(() => ({})) as Row;
    if (input.confirm !== true) return reply({ message: "Confirm sending before starting the queue." }, 422);
    const sequential = code === "send-next";
    let codes = Array.isArray(input.codes) ? [...new Set(input.codes.filter(x => typeof x === "string" && validCode(x)).slice(0, 3))] : [];
    if (sequential) {
      // Fetch only the next unprocessed, permission-confirmed recipient.
      // Unverified, blocked, bounced, failed and opted-out contacts are never auto-sent.
      const next = await sql`SELECT campaign_code FROM loyvance_outreach_20261031
        WHERE deleted_at IS NULL AND status='prepared'
          AND consent_status <> 'unsubscribed' AND (consent_status='opted_in' AND length(COALESCE(consent_source,''))>=8
          OR (b2b_review_status='approved' AND b2b_country IN ('GB','CA','US')
            AND b2b_publication_checked=true AND b2b_role_relevant=true
            AND b2b_no_opt_out_notice=true AND b2b_reviewed_at IS NOT NULL
            AND length(COALESCE(b2b_review_notes,''))>=20
            AND length(COALESCE(source_url,''))>12
            AND (b2b_country<>'GB' OR b2b_business_type='corporate')))
          AND email_subject IS NOT NULL AND email_body IS NOT NULL
        ORDER BY created_at ASC,campaign_code ASC LIMIT 1`;
      codes = next.length ? [String(next[0].campaign_code)] : [];
    } else if (!codes.length) {
      return reply({ message: "Select up to 3 opted-in recipients and confirm." }, 422);
    }
    const outcomes: Array<{ campaign_code: string; status: string; error?: string }> = [];
    for (const target of codes) {
      // Atomic claim: simultaneous clicks cannot claim the same address.
      const claimed = await sql`UPDATE loyvance_outreach_20261031 SET
        status='sending',attempted_at=now(),attempt_count=attempt_count+1,error=NULL,updated_at=now()
        WHERE campaign_code=${target} AND deleted_at IS NULL
        AND status IN ('prepared','failed')
        AND consent_status <> 'unsubscribed' AND (consent_status='opted_in' AND length(COALESCE(consent_source,''))>=8
          OR (b2b_review_status='approved' AND b2b_country IN ('GB','CA','US')
            AND b2b_publication_checked=true AND b2b_role_relevant=true
            AND b2b_no_opt_out_notice=true AND b2b_reviewed_at IS NOT NULL
            AND length(COALESCE(b2b_review_notes,''))>=20
            AND length(COALESCE(source_url,''))>12
            AND (b2b_country<>'GB' OR b2b_business_type='corporate')))
        AND email_subject IS NOT NULL AND email_body IS NOT NULL
        RETURNING campaign_code,contact_email,business_name,email_subject,email_body,unsubscribe_token::text,attempt_count`;
      const row = claimed[0];
      if (!row) { outcomes.push({ campaign_code: target, status: "skipped", error: "Not eligible, previously contacted, or requires B2B review." }); continue; }
      const tracking = "https://loyvance.vercel.app/?ref=" + encodeURIComponent(target);
      const unsubscribe = "https://loyvance.vercel.app/api/outreach/unsubscribe?token=" + encodeURIComponent(String(row.unsubscribe_token));
      const body = String(row.email_body);
      // Preserve the saved message while ensuring that the live tracking URL is present.
      const fullBody = body.includes(tracking) ? body : body + "\n\n" + tracking;
      const html = '<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.65;color:#252525">' +
        escapeHtml(fullBody) + '</div><p style="font:12px Arial,sans-serif;margin-top:24px"><a href="' + unsubscribe +
        '">Unsubscribe from future LOYVANCE emails</a></p>';
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json",
            "Idempotency-Key": "loyvance-outreach-" + target },
          body: JSON.stringify({ from, reply_to: process.env.OUTREACH_REPLY_TO || 'youssefhrdd@gmail.com', to: [row.contact_email], subject: row.email_subject, html,
            headers: { "List-Unsubscribe": "<" + unsubscribe + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } })
        });
        const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
        if (!response.ok || !payload.id) throw new Error((payload.message || "Email provider rejected the message").slice(0, 300));
        await sql`UPDATE loyvance_outreach_20261031 SET status='sent',sent_at=now(),sender_email=${from},
          provider='resend',provider_message_id=${payload.id},error=NULL,updated_at=now()
          WHERE campaign_code=${target} AND status='sending'`;
        outcomes.push({ campaign_code: target, status: "sent" }); // Accepted by provider; not confirmed delivered.
      } catch (error) {
        const explanation = error instanceof Error ? error.message.slice(0, 300) : "Unknown provider error";
        await sql`UPDATE loyvance_outreach_20261031 SET status='failed',failed_at=now(),error=${explanation},updated_at=now()
          WHERE campaign_code=${target} AND status='sending'`;
        outcomes.push({ campaign_code: target, status: "failed", error: explanation });
      }
    }
    if (sequential) {
      const ready = await sql`SELECT count(*)::int AS ready FROM loyvance_outreach_20261031
        WHERE deleted_at IS NULL AND status='prepared'
          AND consent_status <> 'unsubscribed' AND (consent_status='opted_in' AND length(COALESCE(consent_source,''))>=8
          OR (b2b_review_status='approved' AND b2b_country IN ('GB','CA','US')
            AND b2b_publication_checked=true AND b2b_role_relevant=true
            AND b2b_no_opt_out_notice=true AND b2b_reviewed_at IS NOT NULL
            AND length(COALESCE(b2b_review_notes,''))>=20
            AND length(COALESCE(source_url,''))>12
            AND (b2b_country<>'GB' OR b2b_business_type='corporate')))
          AND email_subject IS NOT NULL AND email_body IS NOT NULL`;
      return reply({ results: outcomes, remaining: Number(ready[0]?.ready || 0),
        note: "Accepted means provider accepted the message, not that delivery is confirmed." });
    }
    return reply({ results: outcomes, note: "Sent means accepted by the provider. Delivery is confirmed only by a signed webhook." });
  }
  return reply({ message: "Not found or method not allowed." }, 404);
}
