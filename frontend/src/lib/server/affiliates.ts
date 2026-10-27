import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type Row = Record<string, unknown>;
type RowSql = { (parts: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> };
const rowSql = (sql: Sql): RowSql => sql as unknown as RowSql;
const scrypt = promisify(scryptCallback);
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const codePattern = /^[a-z0-9][a-z0-9-]{2,39}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ratesDefault = { 1: 15, 3: 18, 6: 20, 12: 22 };
const codeHash = (token: string) => createHash("sha256").update(token).digest("hex");
const months = ["1", "3", "6", "12"] as const;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[0-9a-f]{128}$/i.test(hash)) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
function validateRates(input: unknown): Record<string, number> | null {
  if (typeof input !== "object" || !input) return null;
  const values = input as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const key of months) {
    const value = Number(values[key]);
    if (!Number.isFinite(value) || value < 0 || value > 50 || Math.round(value * 100) !== value * 100) return null;
    result[key] = Math.round(value * 100);
  }
  return result;
}
function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export async function ensureAffiliateSchema(sql: Sql) {
  const q = rowSql(sql);
  await q`CREATE TABLE IF NOT EXISTS affiliate_partners (
    id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
    code text NOT NULL UNIQUE, password_hash text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    rate_1_bps integer NOT NULL DEFAULT 1500 CHECK(rate_1_bps BETWEEN 0 AND 5000),
    rate_3_bps integer NOT NULL DEFAULT 1800 CHECK(rate_3_bps BETWEEN 0 AND 5000),
    rate_6_bps integer NOT NULL DEFAULT 2000 CHECK(rate_6_bps BETWEEN 0 AND 5000),
    rate_12_bps integer NOT NULL DEFAULT 2200 CHECK(rate_12_bps BETWEEN 0 AND 5000),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`ALTER TABLE affiliate_partners ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES app_users(id) ON DELETE SET NULL`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_partners_user_id ON affiliate_partners(user_id) WHERE user_id IS NOT NULL`;
  await q`ALTER TABLE affiliate_partners ADD COLUMN IF NOT EXISTS archived_at timestamptz`;
  await q`CREATE TABLE IF NOT EXISTS affiliate_businesses (
    business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    affiliate_id uuid NOT NULL REFERENCES affiliate_partners(id),
    attributed_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS idx_affiliate_businesses_partner ON affiliate_businesses(affiliate_id)`;
  await q`CREATE TABLE IF NOT EXISTS affiliate_sessions (
    token_hash text PRIMARY KEY, affiliate_id uuid NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id uuid PRIMARY KEY, affiliate_id uuid NOT NULL REFERENCES affiliate_partners(id),
    month text NOT NULL, amount_centimes integer NOT NULL CHECK(amount_centimes > 0),
    method text NOT NULL, reference text NOT NULL,
    created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
    paid_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS idx_affiliate_payout_partner ON affiliate_payouts(affiliate_id,paid_at DESC)`;
  await q`CREATE TABLE IF NOT EXISTS affiliate_commissions (
    subscription_event_id uuid PRIMARY KEY REFERENCES subscription_events(id),
    affiliate_id uuid NOT NULL REFERENCES affiliate_partners(id),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    duration_months integer NOT NULL CHECK(duration_months IN (1,3,6,12)),
    amount_centimes integer NOT NULL CHECK(amount_centimes > 0),
    rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 5000),
    commission_centimes integer NOT NULL CHECK(commission_centimes >= 0),
    payout_id uuid REFERENCES affiliate_payouts(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_partner ON affiliate_commissions(affiliate_id,created_at DESC)`;
  await q`CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_unpaid ON affiliate_commissions(affiliate_id) WHERE payout_id IS NULL`;
}

export async function affiliateCodeIsValid(sql: Sql, code: string) {
  const q = rowSql(sql);
  if (!codePattern.test(code)) return false;
  const found = await q`SELECT id FROM affiliate_partners WHERE code=${code} AND is_active=true AND archived_at IS NULL LIMIT 1`;
  return found.length > 0;
}

export async function affiliateReport(sql: Sql, affiliateId: string) {
  const q = rowSql(sql);
  const [businesses, commissions, payouts, summary, history] = await Promise.all([
    q`SELECT b.id,b.name,b.created_at::text,ab.attributed_at::text,
      count(c.subscription_event_id)::int AS paid_orders,
      COALESCE(sum(c.commission_centimes),0)::bigint::text AS earned_centimes
      FROM affiliate_businesses ab JOIN businesses b ON b.id=ab.business_id
      LEFT JOIN affiliate_commissions c ON c.business_id=b.id AND c.affiliate_id=ab.affiliate_id
      WHERE ab.affiliate_id=${affiliateId} GROUP BY b.id,ab.attributed_at ORDER BY ab.attributed_at DESC LIMIT 200`,
    q`SELECT c.subscription_event_id,c.business_id,b.name AS business_name,c.duration_months,
      c.amount_centimes,c.rate_bps,c.commission_centimes,c.payout_id,
      e.paid_at::text,p.paid_at::text AS payout_at
      FROM affiliate_commissions c JOIN subscription_events e ON e.id=c.subscription_event_id
      JOIN businesses b ON b.id=c.business_id LEFT JOIN affiliate_payouts p ON p.id=c.payout_id
      WHERE c.affiliate_id=${affiliateId} ORDER BY e.paid_at DESC,c.created_at DESC LIMIT 300`,
    q`SELECT id,month,amount_centimes,method,reference,paid_at::text
      FROM affiliate_payouts WHERE affiliate_id=${affiliateId} ORDER BY paid_at DESC LIMIT 100`,
    q`SELECT count(DISTINCT ab.business_id)::int AS referred_businesses,
      (SELECT count(*)::int FROM affiliate_commissions WHERE affiliate_id=${affiliateId}) AS paid_orders,
      (SELECT COALESCE(sum(commission_centimes),0)::bigint::text FROM affiliate_commissions WHERE affiliate_id=${affiliateId}) AS total_centimes,
      (SELECT COALESCE(sum(commission_centimes),0)::bigint::text FROM affiliate_commissions WHERE affiliate_id=${affiliateId} AND payout_id IS NULL) AS unpaid_centimes,
      (SELECT COALESCE(sum(c.commission_centimes),0)::bigint::text FROM affiliate_commissions c
        JOIN subscription_events e ON e.id=c.subscription_event_id
        WHERE c.affiliate_id=${affiliateId}
        AND to_char(e.paid_at AT TIME ZONE 'Africa/Casablanca','YYYY-MM')=
        to_char(now() AT TIME ZONE 'Africa/Casablanca','YYYY-MM')) AS month_centimes
      FROM affiliate_businesses ab WHERE ab.affiliate_id=${affiliateId}`,
    q`SELECT to_char(e.paid_at AT TIME ZONE 'Africa/Casablanca','YYYY-MM') AS month,
      count(*)::int AS orders,COALESCE(sum(c.commission_centimes),0)::bigint::text AS earned_centimes,
      COALESCE(sum(c.commission_centimes) FILTER(WHERE c.payout_id IS NULL),0)::bigint::text AS unpaid_centimes
      FROM affiliate_commissions c JOIN subscription_events e ON e.id=c.subscription_event_id
      WHERE c.affiliate_id=${affiliateId} GROUP BY 1 ORDER BY 1 DESC LIMIT 24`,
  ]);
  return { summary: summary[0], businesses, commissions, payouts, history };
}

// The public business directory displays businesses.email, which can differ from the owner's login email.
// Resolve either address server-side without changing account credentials or reassigning ownership.
async function resolveAffiliateAccount(sql: Sql, email: string) {
  const q = rowSql(sql);
  const direct = await q`SELECT id,name,email,role,status FROM app_users WHERE lower(email)=${email} AND role IN ('customer','business_owner') LIMIT 1`;
  if (direct.length) return { account: direct[0], ambiguous: false };
  const owners = await q`SELECT DISTINCT u.id,u.name,u.email,u.role,u.status
    FROM businesses b JOIN app_users u ON u.business_id=b.id AND u.role='business_owner'
    WHERE lower(b.email)=${email} LIMIT 2`;
  if (owners.length > 1) return { account: null, ambiguous: true };
  return { account: owners[0] ?? null, ambiguous: false };
}

export async function handleAdminAffiliates(path: string[], req: Request, sql: Sql, admin: { id: string }) {
  const q = rowSql(sql);
  const segments = path.slice(2);
  if (segments.length === 1 && segments[0] === "candidates") {
    if (req.method !== "GET") return reply({ message: "Method not allowed." },405);
    const params = new URL(req.url).searchParams;
    const query = (params.get("q") ?? "").trim().slice(0,90);
    const type = params.get("type") ?? "all";
    if (!["all","business","customer"].includes(type)) return reply({ message: "Invalid account type." },422);
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  if (!segments.length) {")}%`;
    // Search only already registered active accounts. Never return a protected customer's email.
    // This endpoint is reached exclusively through the platform-admin guarded route.
    const candidates = await q`SELECT u.id,u.name,u.role,
      CASE WHEN u.role='customer' AND NOT privacy.visible THEN NULL ELSE u.email END AS email,
      CASE WHEN u.role='business_owner' THEN b.name ELSE NULL END AS business_name,
      CASE WHEN u.role='business_owner' THEN b.email ELSE NULL END AS business_email,
      COALESCE(p.code,'') AS affiliate_code, p.archived_at IS NOT NULL AS archived_affiliate,
      CASE WHEN u.role='customer' THEN privacy.visible ELSE true END AS contact_visible
      FROM app_users u
      LEFT JOIN businesses b ON b.id=u.business_id AND u.role='business_owner'
      LEFT JOIN affiliate_partners p ON p.user_id=u.id
      CROSS JOIN LATERAL (
        SELECT NOT EXISTS(
          SELECT 1 FROM customers c JOIN businesses cb ON cb.id=c.business_id
          WHERE c.user_id=u.id AND cb.admin_contact_private=true
        ) AS visible
      ) privacy
      WHERE u.role IN ('customer','business_owner') AND u.status='active'
        AND (u.role='customer' OR (b.id IS NOT NULL AND COALESCE(b.status,'active')='active'))
        AND (${type}='all' OR (${type}='business' AND u.role='business_owner') OR (${type}='customer' AND u.role='customer'))
        AND (u.name ILIKE ${pattern}
          OR (u.role='business_owner' AND (b.name ILIKE ${pattern} OR b.email ILIKE ${pattern} OR u.email ILIKE ${pattern}))
          OR (u.role='customer' AND privacy.visible AND u.email ILIKE ${pattern}))
      ORDER BY u.created_at DESC,u.id LIMIT 15`;
    return reply({ data: candidates });
  }
  if (!segments.length) {
    if (req.method === "GET") {
      const archived = new URL(req.url).searchParams.get("archived")==="true";
      const partners = await q`SELECT p.id,p.name,p.email,p.code,p.user_id,u.role AS account_role,u.email AS account_email,p.is_active,p.archived_at::text,p.rate_1_bps,p.rate_3_bps,p.rate_6_bps,p.rate_12_bps,p.created_at::text,
        (SELECT count(*)::int FROM affiliate_businesses b WHERE b.affiliate_id=p.id) AS businesses,
        (SELECT COALESCE(sum(c.commission_centimes),0)::bigint::text FROM affiliate_commissions c WHERE c.affiliate_id=p.id) AS earned_centimes,
        (SELECT COALESCE(sum(c.commission_centimes),0)::bigint::text FROM affiliate_commissions c WHERE c.affiliate_id=p.id AND c.payout_id IS NULL) AS unpaid_centimes
        FROM affiliate_partners p LEFT JOIN app_users u ON u.id=p.user_id WHERE (p.archived_at IS NOT NULL)=${archived} ORDER BY p.created_at DESC LIMIT 300`;
      return reply({ data: partners });
    }
    if (req.method !== "POST") return reply({ message: "Method not allowed." },405);
    const body = await req.json().catch(() => ({})) as Row;
    // Affiliate access is an *additional permission* on an existing customer or business account.
    // The account keeps its original role, credentials, cards and business workspace.
    const userId = String(body.user_id ?? "").trim();
    const email = String(body.user_email ?? "").trim().toLowerCase();
    const rates = validateRates(body.rates ?? ratesDefault);
    if ((userId && !uuidPattern.test(userId)) || (!userId && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || !rates)
      return reply({ message: "Select an existing account and valid commission percentages." },422);
    const resolved = userId
      ? { account:(await q`SELECT u.id,u.name,u.email,u.role,u.status,b.email AS business_email
           FROM app_users u LEFT JOIN businesses b ON b.id=u.business_id AND u.role='business_owner'
           WHERE u.id=${userId}::uuid AND u.role IN ('customer','business_owner') LIMIT 1`)[0] ?? null, ambiguous:false }
      : await resolveAffiliateAccount(sql,email);
    if (resolved.ambiguous) return reply({ message: "Multiple business owners use this contact email. Enter the owner's login email to select the correct account." },409);
    const account = resolved.account;
    if (!account) return reply({ message: "The selected Customer or Business account could not be found." },404);
    if (account.status !== 'active') return reply({ message: "Activate this account before granting affiliate access." },409);
    const previouslyLinked = await q`SELECT id FROM affiliate_partners WHERE user_id=${account.id}::uuid LIMIT 1`;
    if (previouslyLinked.length) return reply({ message: "This account already has an affiliate profile. Select it from the list." },409);
    // Preserve older standalone partners (and their financial ledger) when the same email signs up normally.
    const existing = await q`UPDATE affiliate_partners SET user_id=${account.id}::uuid
      WHERE id=(SELECT id FROM affiliate_partners
        WHERE archived_at IS NULL AND email IN (${email || String(account.email)},${String(account.email)},${String(account.business_email || account.email)})
          AND user_id IS NULL ORDER BY created_at ASC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM affiliate_partners WHERE user_id=${account.id}::uuid)
      RETURNING id,name,email,code,user_id,is_active,rate_1_bps,rate_3_bps,rate_6_bps,rate_12_bps`;
    if (existing.length) {
      await q`DELETE FROM affiliate_sessions WHERE affiliate_id=${existing[0].id}::uuid`;
      return reply({ affiliate: existing[0], linked_existing: true });
    }
    const name = String(account.name).trim().slice(0,120);
    const code = String(body.code || name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || `partner-${randomBytes(4).toString("hex")}`).trim().toLowerCase();
    if (!codePattern.test(code)) return reply({ message: "Referral code must be 3-40 lowercase letters, digits or hyphens." },422);
    // Legacy password field is kept for historical compatibility, but linked users sign in ONLY with their normal account.
    const disabledLegacyPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
    const id = randomUUID();
    const found = await q`INSERT INTO affiliate_partners(id,user_id,name,email,code,password_hash,rate_1_bps,rate_3_bps,rate_6_bps,rate_12_bps)
      VALUES(${id},${account.id}::uuid,${name},${String(account.email)},${code},${disabledLegacyPasswordHash},${rates["1"]},${rates["3"]},${rates["6"]},${rates["12"]})
      ON CONFLICT DO NOTHING RETURNING id,user_id,name,email,code,is_active,rate_1_bps,rate_3_bps,rate_6_bps,rate_12_bps`;
    if (!found.length) return reply({ message: "Email or referral code already belongs to another partner." },409);
    return reply({ affiliate: found[0], resolved_login_email: account.email, matched_business_contact: Boolean(email) && email !== account.email },201);
  }
  const id = segments[0];
  if (!uuidPattern.test(id)) return reply({ message: "Invalid affiliate." },422);
  const partner = (await q`SELECT p.id,p.name,p.email,p.code,p.user_id,u.role AS account_role,u.email AS account_email,p.is_active,p.archived_at::text,p.rate_1_bps,p.rate_3_bps,p.rate_6_bps,p.rate_12_bps,p.created_at::text FROM affiliate_partners p LEFT JOIN app_users u ON u.id=p.user_id WHERE p.id=${id}`)[0];
  if (!partner) return reply({ message: "Affiliate not found." },404);
  // "Delete" removes access immediately and hides the profile from the active directory.
  // Never delete commission, referral or payout rows: they are accounting records.
  if (segments.length === 1 && req.method === "DELETE") {
    if (partner.archived_at) return reply({ message: "Partner was already removed." },409);
    await sql.transaction([
      sql`UPDATE affiliate_partners SET archived_at=now(),is_active=false WHERE id=${id}::uuid AND archived_at IS NULL`,
      sql`DELETE FROM affiliate_sessions WHERE affiliate_id=${id}::uuid`,
    ]);
    return reply({ message: "Partner removed from the active directory; referral access stopped. Referral, commission and payout history is preserved in Archived partners." });
  }
  if (segments.length === 2 && segments[1] === "restore" && req.method === "POST") {
    if (!partner.archived_at) return reply({ message: "Partner is not archived." },409);
    const restored=await q`UPDATE affiliate_partners SET archived_at=NULL,is_active=true WHERE id=${id}::uuid AND archived_at IS NOT NULL RETURNING id,name,code`;
    return reply({ affiliate: restored[0], message: "Affiliate restored. Referral and dashboard access is active again." });
  }
  if (segments.length === 1 && req.method === "GET") return reply({ affiliate: partner, ...(await affiliateReport(sql,id)) });
  if (partner.archived_at && !(segments.length===2 && segments[1]==="payouts" && req.method==="POST")) return reply({ message: "This partner has been archived. Restore it before changing permissions." },409);
  if (segments.length === 1 && req.method === "PATCH") {
    const body = await req.json().catch(() => ({})) as Row;
    const rates = validateRates(body.rates ?? {1:Number(partner.rate_1_bps)/100,3:Number(partner.rate_3_bps)/100,6:Number(partner.rate_6_bps)/100,12:Number(partner.rate_12_bps)/100});
    const name = body.name === undefined ? String(partner.name) : String(body.name).trim();
    const isActive = body.is_active === undefined ? partner.is_active : body.is_active;
    if (!rates || name.length < 2 || name.length > 120 || typeof isActive !== "boolean")
      return reply({ message: "Invalid affiliate name, status or rates." },422);
    const updated = await q`UPDATE affiliate_partners SET name=${name},is_active=${isActive},
      rate_1_bps=${rates["1"]},rate_3_bps=${rates["3"]},rate_6_bps=${rates["6"]},rate_12_bps=${rates["12"]}
      WHERE id=${id} RETURNING id,name,email,code,is_active,rate_1_bps,rate_3_bps,rate_6_bps,rate_12_bps`;
    if (!isActive) await q`DELETE FROM affiliate_sessions WHERE affiliate_id=${id}`;
    return reply({ affiliate: updated[0] });
  }
  if (segments.length === 2 && segments[1] === "link-account" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as Row;
    const email = String(body.user_email ?? "").trim().toLowerCase();
    const userId = String(body.user_id ?? "").trim();
    if (userId && !uuidPattern.test(userId)) return reply({ message: "Invalid account selection." },422);
    const resolved = userId
      ? { account:(await q`SELECT id,name,role,status,email FROM app_users WHERE id=${userId}::uuid AND role IN ('customer','business_owner') LIMIT 1`)[0] ?? null,ambiguous:false }
      : await resolveAffiliateAccount(sql,email);
    if (resolved.ambiguous) return reply({ message: "More than one business uses this email. Specify the owner's login email." },409);
    const account = resolved.account;
    if (!account) return reply({ message: "No matching active customer or business owner found. Verify the login email or business contact email." },404);
    if (account.status !== "active") return reply({ message: "The selected user is suspended." },409);
    if (partner.user_id) return reply({ message: "This partner is already connected to a LOYVANCE account." },409);
    const linked = await q`UPDATE affiliate_partners SET user_id=${account.id}::uuid WHERE id=${id}::uuid AND user_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM affiliate_partners WHERE user_id=${account.id}::uuid)
      RETURNING id,name,email,code,user_id,is_active`;
    if (!linked.length) return reply({ message: "This account is already associated with a different affiliate." },409);
    await q`DELETE FROM affiliate_sessions WHERE affiliate_id=${id}::uuid`;
    return reply({ affiliate: linked[0] });
  }
  if (segments.length === 2 && segments[1] === "reset-password" && req.method === "POST") {
    if (partner.user_id) return reply({ message: "Linked partners use their normal LOYVANCE account password. Reset it in account settings." },409);
    const temporaryPassword = `${randomBytes(12).toString("base64url")}aA1!`;
    const passwordHash = await hashPassword(temporaryPassword);
    await q`UPDATE affiliate_partners SET password_hash=${passwordHash} WHERE id=${id}::uuid`;
    await q`DELETE FROM affiliate_sessions WHERE affiliate_id=${id}::uuid`;
    return reply({ temporary_password: temporaryPassword });
  }
  if (segments.length === 2 && segments[1] === "payouts" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as Row;
    const requestId = String(body.request_id ?? "");
    const month = body.month;
    const method = String(body.method ?? "").trim();
    const reference = String(body.reference ?? "").trim();
    if (!uuidPattern.test(requestId) || !validMonth(month) || !method || method.length > 80 || !reference || reference.length > 180)
      return reply({ message: "Select a month and provide a payout method and payment reference." },422);
    const existing = await q`SELECT id,affiliate_id,month,amount_centimes,method,reference FROM affiliate_payouts WHERE id=${requestId}`;
    if (existing.length) {
      const p = existing[0];
      return p.affiliate_id===id && p.month===month && p.method===method && p.reference===reference
        ? reply({ payout: p, already_recorded: true }) : reply({ message: "Payout request ID already used." },409);
    }
    const paid = await q`WITH eligible AS MATERIALIZED (
        SELECT c.subscription_event_id,c.commission_centimes FROM affiliate_commissions c
        JOIN subscription_events e ON e.id=c.subscription_event_id
        WHERE c.affiliate_id=${id} AND c.payout_id IS NULL
        AND to_char(e.paid_at AT TIME ZONE 'Africa/Casablanca','YYYY-MM')=${month}
        FOR UPDATE OF c
      ), inserted AS (
        INSERT INTO affiliate_payouts(id,affiliate_id,month,amount_centimes,method,reference,created_by)
        SELECT ${requestId}::uuid,${id}::uuid,${month},sum(commission_centimes)::int,${method},${reference},${admin.id}::uuid
        FROM eligible HAVING COALESCE(sum(commission_centimes),0)>0
        ON CONFLICT(id) DO NOTHING RETURNING id,amount_centimes
      ), marked AS (
        UPDATE affiliate_commissions c SET payout_id=p.id FROM inserted p,eligible e
        WHERE c.subscription_event_id=e.subscription_event_id RETURNING c.subscription_event_id
      ) SELECT id,amount_centimes FROM inserted`;
    if (!paid.length) return reply({ message: "No outstanding commissions in this month, or this payout has already been recorded." },409);
    return reply({ payout: paid[0] });
  }
  return reply({ message: "Method not allowed." },405);
}

async function currentAffiliate(req: Request, sql: Sql) {
  const q = rowSql(sql);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  // The normal customer/business session is the primary credential. No second affiliate password.
  const linked = await q`SELECT a.id,a.name,a.email,a.code,a.is_active,a.rate_1_bps,a.rate_3_bps,a.rate_6_bps,a.rate_12_bps
    FROM user_sessions s JOIN app_users u ON u.id=s.user_id
    JOIN affiliate_partners a ON a.user_id=u.id LEFT JOIN businesses b ON b.id=u.business_id
    WHERE s.token=${token} AND s.expires_at>now() AND a.is_active=true AND a.archived_at IS NULL AND u.status='active'
      AND u.role IN ('customer','business_owner')
      AND (u.role<>'business_owner' OR (b.id IS NOT NULL AND COALESCE(b.status,'active')='active'))
    LIMIT 1`;
  if (linked.length) return linked[0];
  // Existing unlinked affiliates retain their previous portal until the admin links their account.
  const legacy = await q`SELECT a.id,a.name,a.email,a.code,a.is_active,a.rate_1_bps,a.rate_3_bps,a.rate_6_bps,a.rate_12_bps
    FROM affiliate_sessions s JOIN affiliate_partners a ON a.id=s.affiliate_id
    WHERE s.token_hash=${codeHash(token)} AND s.expires_at>now() AND a.is_active=true AND a.archived_at IS NULL AND a.user_id IS NULL LIMIT 1`;
  return legacy[0] ?? null;
}

export async function handleAffiliate(path: string[], req: Request, sql: Sql) {
  const q = rowSql(sql);
  if (path[1] === "validate" && req.method === "GET") {
    const code = new URL(req.url).searchParams.get("code")?.trim().toLowerCase() ?? "";
    return reply({ valid: await affiliateCodeIsValid(sql,code) });
  }
  if (path[1] === "login" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as Row;
    const email = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    if (email.length > 200 || password.length > 200) return reply({ message: "Invalid credentials." },401);
    const users = await q`SELECT id,name,email,code,user_id,password_hash,is_active FROM affiliate_partners WHERE email=${email} AND archived_at IS NULL LIMIT 1`;
    const user = users[0];
    if (!user || user.is_active !== true || user.user_id || !(await verifyPassword(password,String(user.password_hash))))
      return reply({ message: "Invalid credentials or inactive affiliate account." },401);
    const token = randomBytes(32).toString("hex");
    await q`INSERT INTO affiliate_sessions(token_hash,affiliate_id) VALUES(${codeHash(token)},${user.id}::uuid)`;
    return reply({ token, affiliate: { id:user.id,name:user.name,email:user.email,code:user.code } });
  }
  const affiliate = await currentAffiliate(req,sql);
  if (!affiliate) return reply({ message: "Sign in to your affiliate account." },401);
  if (path[1] === "me" && req.method === "GET") return reply({ affiliate });
  if (path[1] === "report" && req.method === "GET") return reply({ affiliate, ...(await affiliateReport(sql,String(affiliate.id))) });
  if (path[1] === "logout" && req.method === "POST") {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim() ?? "";
    await q`DELETE FROM affiliate_sessions WHERE token_hash=${codeHash(token)} AND affiliate_id=${affiliate.id}::uuid`;
    return reply({ message: "Signed out." });
  }
  if (path[1] === "password" && req.method === "POST") {
    const legacyAccount = await q`SELECT user_id FROM affiliate_partners WHERE id=${affiliate.id}::uuid`;
    if (legacyAccount[0]?.user_id) return reply({ message: "Use your normal LOYVANCE account password settings." },409);
    const body = await req.json().catch(() => ({})) as Row;
    const oldPassword = String(body.current_password ?? "");
    const newPassword = String(body.new_password ?? "");
    if (newPassword.length < 12 || newPassword.length > 200 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword))
      return reply({ message: "Use at least 12 characters including uppercase, lowercase and a number." },422);
    const rows = await q`SELECT password_hash FROM affiliate_partners WHERE id=${affiliate.id}::uuid`;
    if (!rows.length || !(await verifyPassword(oldPassword,String(rows[0].password_hash)))) return reply({ message: "Current password is incorrect." },403);
    await q`UPDATE affiliate_partners SET password_hash=${await hashPassword(newPassword)} WHERE id=${affiliate.id}::uuid`;
    await q`DELETE FROM affiliate_sessions WHERE affiliate_id=${affiliate.id}::uuid`;
    return reply({ message: "Password changed. Sign in again." });
  }
  return reply({ message: "API route not found." },404);
}
