import { createHash, randomBytes } from "crypto";
import type { getSql } from "@/lib/server/db";
import { affiliateMonth, commissionRate } from "@/lib/affiliate";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type RowSql = (parts: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
type Actor = { id: string; name: string };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cookieName = "loyvance_referral";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
function numeric(row: Row) {
  const result = { ...row };
  for (const key of ["partners", "visits", "referrals", "month_sales", "month_earned", "month_paid", "due", "amount_centimes"])
    if (key in result) result[key] = Number(result[key] ?? 0);
  return result;
}
function tokenHash(req: Request) {
  const value = (req.headers.get("cookie") ?? "").split(";").map(s => s.trim()).find(s => s.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  return value && /^[0-9a-f]{64}$/.test(value) ? hash(value) : null;
}

export async function captureAffiliate(database: Sql, req: Request, code: string) {
  const sql = database as unknown as RowSql;
  const redirect = (token?: string) => new Response(null, { status: 302, headers: {
    Location: new URL("/register", req.url).toString(), "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow",
    ...(token ? { "Set-Cookie": `${cookieName}=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${new URL(req.url).protocol === "https:" ? "; Secure" : ""}` } : {}),
  } });
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(code)) return redirect();
  const previous = tokenHash(req);
  if (previous && (await sql`SELECT token_hash FROM affiliate_visits WHERE token_hash=${previous} AND expires_at>now()`).length) return redirect();
  const token = randomBytes(32).toString("hex");
  const rows = await sql`INSERT INTO affiliate_visits(token_hash,affiliate_id)
    SELECT ${hash(token)},id FROM affiliates WHERE code=${code} AND active RETURNING affiliate_id`;
  return redirect(rows.length ? token : undefined);
}

// Only an opaque, server-issued cookie can identify a referrer; signup payloads cannot assign one.
export async function registrationAffiliate(database: Sql, req: Request, emails: string[]) {
  const sql = database as unknown as RowSql;
  const token = tokenHash(req);
  if (!token) return null;
  const rows = await sql`SELECT a.id FROM affiliate_visits v JOIN affiliates a ON a.id=v.affiliate_id
    WHERE v.token_hash=${token} AND v.expires_at>now() AND a.active
      AND (a.email='' OR NOT lower(a.email)=ANY(${emails.map(e => e.toLowerCase())}::text[]))`;
  return rows.length ? String(rows[0].id) : null;
}

export async function handleAffiliates(path: string[], req: Request, database: Sql, actor: Actor): Promise<Response> {
  const sql = database as unknown as RowSql;
  const id = path[2];
  if (id && !uuid.test(id)) return reply({ message: "Invalid affiliate identifier." }, 422);
  const params = new URL(req.url).searchParams;
  const month = params.get("month") || affiliateMonth();
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return reply({ message: "Choose a valid month." }, 422);
  const from = month + "-01", until = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const page = Math.max(1, Math.min(100000, Math.floor(Number(params.get("page")) || 1))), offset = (page - 1) * 25;

  if (req.method === "POST" && !id) {
    const body = await req.json().catch(() => ({}));
    const name = clean(body.name), email = clean(body.email).toLowerCase(), rate = commissionRate(body.commission_percent);
    const requestedCode = clean(body.code).toLowerCase(), code = requestedCode || "ref-" + randomBytes(6).toString("hex");
    if (!uuid.test(body.request_id || "") || !name || name.length > 120 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !rate || !/^[a-z0-9][a-z0-9-]{2,47}$/.test(code))
      return reply({ message: "Enter a name, a valid email if provided, a rate between 0.01 and 100%, and a link code of 3–48 letters, digits or hyphens." }, 422);
    const existing = await sql`SELECT * FROM affiliates WHERE id=${body.request_id}`;
    if (existing.length) return existing[0].name === name && existing[0].email === email && existing[0].commission_bps === rate && (!requestedCode || existing[0].code === code)
      ? reply({ affiliate: existing[0] }) : reply({ message: "This request identifier has already been used." }, 409);
    const rows = await sql`WITH added AS (
      INSERT INTO affiliates(id,name,email,code,commission_bps) VALUES(${body.request_id},${name},${email},${code},${rate}) ON CONFLICT DO NOTHING RETURNING *
    ), audit AS (
      INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
      SELECT gen_random_uuid(),${actor.id},${actor.name},'affiliate_created','affiliate',id,name,'Rate: '||commission_bps||' bps; code: '||code FROM added
    ) SELECT * FROM added`;
    return rows.length ? reply({ affiliate: rows[0] }, 201) : reply({ message: "This referral code is already in use. Choose another code." }, 409);
  }

  if (id && req.method === "PATCH" && path.length === 3) {
    const body = await req.json().catch(() => ({}));
    const name = clean(body.name), email = clean(body.email).toLowerCase(), rate = commissionRate(body.commission_percent);
    if (!name || name.length > 120 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !rate || typeof body.active !== "boolean" || !Number.isInteger(body.revision))
      return reply({ message: "Enter valid affiliate details and commission rate." }, 422);
    const rows = await sql`WITH changed AS (
      UPDATE affiliates SET name=${name},email=${email},commission_bps=${rate},active=${body.active},revision=revision+1,updated_at=now()
      WHERE id=${id} AND revision=${body.revision} RETURNING *
    ), audit AS (
      INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
      SELECT gen_random_uuid(),${actor.id},${actor.name},'affiliate_updated','affiliate',id,name,'Rate: '||commission_bps||' bps; active: '||active FROM changed
    ) SELECT * FROM changed`;
    return rows.length ? reply({ affiliate: rows[0] }) : reply({ message: "This affiliate changed. Refresh and try again." }, 409);
  }

  if (id && path[3] === "payouts" && req.method === "POST" && path.length === 4) {
    const body = await req.json().catch(() => ({}));
    const reference = clean(body.reference), paidAt = clean(body.paid_at);
    const ids: string[] = Array.isArray(body.commission_ids) ? [...new Set(body.commission_ids)] as string[] : [];
    if (!uuid.test(body.request_id || "") || !ids.length || ids.length > 10000 || ids.some(v => typeof v !== "string" || !uuid.test(v)) || !Number.isSafeInteger(body.amount_centimes) || body.amount_centimes <= 0 || !reference || reference.length > 200 || !Number.isFinite(Date.parse(paidAt)) || Date.parse(paidAt) > Date.now() + 60000 || body.confirmed !== true || month > affiliateMonth())
      return reply({ message: "Confirm the actual payout, its date and reference, and review the amount due." }, 422);
    const date = new Date(paidAt).toISOString();
    const requestHash = hash(JSON.stringify([id, month, ids.sort(), body.amount_centimes, reference, date]));
    async function existingPayout() {
      const rows = await sql`SELECT id,request_hash FROM affiliate_payouts WHERE id=${body.request_id}`;
      return rows.length ? rows[0].request_hash === requestHash ? reply({ message: "Payout recorded.", id: rows[0].id }) : reply({ message: "This request identifier has already been used." }, 409) : null;
    }
    const existing = await existingPayout();
    if (existing) return existing;
    // Lock the exact reviewed rows. A concurrent payout/void cannot spend the same commission twice.
    const rows = await sql`WITH eligible AS MATERIALIZED (
      SELECT id,amount_centimes FROM affiliate_commissions WHERE affiliate_id=${id} AND id=ANY(${ids}::uuid[])
        AND payout_id IS NULL AND voided_at IS NULL AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca') FOR UPDATE
    ), paid AS (
      INSERT INTO affiliate_payouts(id,affiliate_id,amount_centimes,through_month,paid_at,reference,request_hash,actor_id,actor_name)
      SELECT ${body.request_id},${id},sum(amount_centimes),${month},${date}::timestamptz,${reference},${requestHash},${actor.id},${actor.name}
      FROM eligible HAVING count(*)=${ids.length} AND sum(amount_centimes)=${body.amount_centimes}
      ON CONFLICT(id) DO NOTHING RETURNING id
    ), settled AS (
      UPDATE affiliate_commissions c SET payout_id=p.id FROM paid p WHERE c.id IN (SELECT id FROM eligible) RETURNING c.id
    ), audit AS (
      INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
      SELECT gen_random_uuid(),${actor.id},${actor.name},'affiliate_payout','affiliate',a.id,a.name,${reference}||'; centimes: '||${body.amount_centimes}::text
      FROM affiliates a,paid p WHERE a.id=${id}
    ) SELECT id FROM paid`;
    return rows.length ? reply({ message: "Payout recorded.", id: rows[0].id }, 201) : (await existingPayout()) ?? reply({ message: "The balance changed. Refresh the statement before recording a payout." }, 409);
  }

  if (id && path[3] === "commissions" && path[5] === "void" && req.method === "POST" && path.length === 6) {
    const body = await req.json().catch(() => ({}));
    const reason = clean(body.reason);
    if (!uuid.test(path[4]) || !reason || reason.length > 500) return reply({ message: "Add a reason for voiding this unpaid commission." }, 422);
    const rows = await sql`WITH changed AS (
      UPDATE affiliate_commissions SET voided_at=now(),void_reason=${reason}
      WHERE id=${path[4]} AND affiliate_id=${id} AND payout_id IS NULL AND voided_at IS NULL RETURNING id
    ), audit AS (
      INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
      SELECT gen_random_uuid(),${actor.id},${actor.name},'affiliate_commission_voided','affiliate',a.id,a.name,${reason}||'; commission: '||c.id FROM changed c,affiliates a WHERE a.id=${id}
    ) SELECT id FROM changed`;
    return rows.length ? reply({ message: "Unpaid commission voided." }) : reply({ message: "This commission is already paid or voided." }, 409);
  }
  if (req.method !== "GET") return reply({ message: "API route not found." }, 404);

  if (path[3] === "export" && id) {
    const rows = await sql`SELECT a.name AS affiliate,a.code,c.business_name,c.receipt_number,c.duration_months,
      c.payment_centimes,c.rate_bps,c.amount_centimes,c.earned_at::text,
      CASE WHEN c.voided_at IS NOT NULL THEN 'void' WHEN c.payout_id IS NOT NULL THEN 'paid' ELSE 'unpaid' END AS status,
      p.reference AS payout_reference,p.paid_at::text AS payout_date,c.void_reason
      FROM affiliate_commissions c JOIN affiliates a ON a.id=c.affiliate_id LEFT JOIN affiliate_payouts p ON p.id=c.payout_id
      WHERE c.affiliate_id=${id} AND c.earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca')
        AND c.earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca') ORDER BY c.earned_at,c.id`;
    const cell = (v: unknown) => '"' + String(v ?? "").replace(/^([\s]*[=+@-])/, "'$1").replace(/"/g, '""') + '"';
    const header = ["Affiliate", "Code", "Business", "Receipt", "Months", "Payment (MAD)", "Rate (%)", "Commission (MAD)", "Payment date", "Status", "Payout reference", "Payout date", "Void reason"];
    const data = rows.map(r => [r.affiliate, r.code, r.business_name, r.receipt_number, r.duration_months,
      (Number(r.payment_centimes) / 100).toFixed(2), (Number(r.rate_bps) / 100).toFixed(2), (Number(r.amount_centimes) / 100).toFixed(2),
      r.earned_at, r.status, r.payout_reference, r.payout_date, r.void_reason]);
    return new Response("\ufeff" + [header, ...data].map(r => r.map(cell).join(",")).join("\r\n"), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=affiliate-${month}.csv`, "Cache-Control": "no-store",
    } });
  }
  if (path.length > (id ? 3 : 2)) return reply({ message: "API route not found." }, 404);
  const query = "%" + (params.get("q") || "").trim().slice(0, 100).replace(/[\\%_]/g, "\\$&") + "%";
  const rows = await sql`SELECT a.id,a.name,a.code,a.email,a.commission_bps,a.active,a.revision,a.created_at::text,
    (SELECT count(*)::int FROM affiliate_visits v WHERE v.affiliate_id=a.id) AS visits,
    (SELECT count(*)::int FROM affiliate_referrals r WHERE r.affiliate_id=a.id) AS referrals,
    COALESCE((SELECT sum(c.payment_centimes) FROM affiliate_commissions c WHERE c.affiliate_id=a.id AND c.voided_at IS NULL AND c.earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND c.earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS month_sales,
    COALESCE((SELECT sum(c.amount_centimes) FROM affiliate_commissions c WHERE c.affiliate_id=a.id AND c.voided_at IS NULL AND c.earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND c.earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS month_earned,
    COALESCE((SELECT sum(p.amount_centimes) FROM affiliate_payouts p WHERE p.affiliate_id=a.id AND p.paid_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND p.paid_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS month_paid,
    COALESCE((SELECT sum(c.amount_centimes) FROM affiliate_commissions c WHERE c.affiliate_id=a.id AND c.payout_id IS NULL AND c.voided_at IS NULL AND c.earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS due
    FROM affiliates a WHERE (${id ?? null}::uuid IS NULL OR a.id=${id ?? null}::uuid) AND (${id ?? null}::uuid IS NOT NULL OR a.name ILIKE ${query} OR a.code ILIKE ${query})
    ORDER BY a.created_at DESC,a.id LIMIT 25 OFFSET ${id ? 0 : offset}`;
  if (id) {
    if (!rows.length) return reply({ message: "Affiliate not found." }, 404);
    const [commissions, referrals, payouts, totals, settlement] = await Promise.all([
      sql`SELECT id,affiliate_id,business_id,event_id,business_name,receipt_number,duration_months,payment_centimes,rate_bps,amount_centimes,earned_at::text,payout_id,voided_at::text,void_reason
        FROM affiliate_commissions WHERE affiliate_id=${id} AND earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca') ORDER BY earned_at DESC,id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT r.business_id,b.name AS business_name,r.created_at::text FROM affiliate_referrals r JOIN businesses b ON b.id=r.business_id WHERE r.affiliate_id=${id} ORDER BY r.created_at DESC,r.business_id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT id,amount_centimes,through_month,paid_at::text,reference,actor_name,created_at::text FROM affiliate_payouts WHERE affiliate_id=${id} ORDER BY created_at DESC,id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT (SELECT count(*)::int FROM affiliate_commissions WHERE affiliate_id=${id} AND earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')) AS commission_total,
        (SELECT count(*)::int FROM affiliate_referrals WHERE affiliate_id=${id}) AS referral_total,
        (SELECT count(*)::int FROM affiliate_payouts WHERE affiliate_id=${id}) AS payout_total`,
      sql`SELECT COALESCE(array_agg(id ORDER BY id),'{}') AS ids,COALESCE(sum(amount_centimes),0) AS amount_centimes
        FROM affiliate_commissions WHERE affiliate_id=${id} AND payout_id IS NULL AND voided_at IS NULL AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')`,
    ]);
    return reply({ affiliate: numeric(rows[0]), month, page, commissions, referrals, payouts: payouts.map(numeric), ...totals[0], settlement: numeric(settlement[0]) });
  }
  const [count, summary] = await Promise.all([
    sql`SELECT count(*)::int AS total FROM affiliates WHERE name ILIKE ${query} OR code ILIKE ${query}`,
    sql`SELECT (SELECT count(*)::int FROM affiliates) AS partners,(SELECT count(*)::int FROM affiliate_referrals) AS referrals,
      COALESCE((SELECT sum(payment_centimes) FROM affiliate_commissions WHERE voided_at IS NULL AND earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS month_sales,
      COALESCE((SELECT sum(amount_centimes) FROM affiliate_commissions WHERE voided_at IS NULL AND earned_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS month_earned,
      COALESCE((SELECT sum(amount_centimes) FROM affiliate_payouts WHERE paid_at>=(${from}::timestamp AT TIME ZONE 'Africa/Casablanca') AND paid_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS month_paid,
      COALESCE((SELECT sum(amount_centimes) FROM affiliate_commissions WHERE payout_id IS NULL AND voided_at IS NULL AND earned_at<(${until}::timestamp AT TIME ZONE 'Africa/Casablanca')),0) AS due`,
  ]);
  return reply({ data: rows.map(numeric), total: count[0].total, page, month, summary: numeric(summary[0]) });
}
