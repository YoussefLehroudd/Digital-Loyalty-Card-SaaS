import {effectiveRewardCard} from "@/lib/server/reward-levels";
import { adminBusinessFeatures, ensureFeatureSchema } from "@/lib/server/business-features";
import { randomUUID } from "crypto";
import { paymentAmount, PAYMENT_METHODS, subscriptionPlan } from "@/lib/subscription";
import type { getSql } from "@/lib/server/db";
import { subscriptionDetails, subscriptionFor, subscriptionsFor } from "@/lib/server/subscriptions";

import { rejectRenewal, renewalProof } from "@/lib/server/renewal-requests";
import { handleAdminAffiliates } from "@/lib/server/affiliates";

type Sql = ReturnType<typeof getSql>;
type RowSql = {
  (parts: TemplateStringsArray, ...values: unknown[]): Promise<Array<Record<string, unknown>>>;
  transaction: (queries: Promise<unknown>[]) => Promise<unknown>;
};
type Identity = { id: string; name: string; email: string; role: string; business_id: string | null };
type Dependencies = {
  authenticate: (req: Request) => Promise<{ user: Identity } | null>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
  createSession: (userId: string) => Promise<string>;
  rateLimit: (bucket: string, limit: number, window: number) => Promise<Response | null>;
};

export function isPlatformAdmin(user: Pick<Identity, "id" | "role">) {
  return user.role === "platform_admin" || (process.env.PLATFORM_ADMIN_USER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean).includes(user.id);
}

const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const safeUser = (user: Identity) => ({ id: user.id, name: user.name, email: user.email, role: "platform_admin" });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function pageOptions(req: Request) {
  const p = new URL(req.url).searchParams;
  const number = Number(p.get("page") || 1);
  const page = Number.isFinite(number) ? Math.max(1, Math.min(100000, Math.floor(number))) : 1;
  const query = (p.get("q") || "").trim().slice(0, 100);
  const status = ["active", "suspended"].includes(p.get("status") || "") ? p.get("status")! : "";
  return { page, offset: (page - 1) * 25, query: `%${query.replace(/[\\%_]/g, "\\$&")}%`, status };
}

export async function ensureAdminSchema(sql: Sql) {
  await ensureFeatureSchema(sql);
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS admin_contact_access boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
  await sql`CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id uuid PRIMARY KEY, actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    actor_name text NOT NULL, action text NOT NULL, entity_type text NOT NULL,
    entity_id uuid NOT NULL, entity_name text NOT NULL, reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC)`;
  // New policy: customer contacts are visible to the platform admin by default.
  // Preserve explicit opt-outs from the former opt-in setting using the last historical privacy audit.
  // Keeping this nullable during the backfill ensures retries never overwrite an owner's new choice.
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS admin_contact_private boolean`;
  await sql`UPDATE businesses b SET admin_contact_private = COALESCE((
    SELECT a.reason = 'Customer contact access disabled by business owner'
    FROM admin_audit_logs a
    WHERE a.entity_type='business' AND a.entity_id=b.id AND a.action='customer_privacy_change'
    ORDER BY a.created_at DESC, a.id DESC LIMIT 1
  ), false) WHERE b.admin_contact_private IS NULL`;
  await sql`ALTER TABLE businesses ALTER COLUMN admin_contact_private SET DEFAULT false`;
  await sql`ALTER TABLE businesses ALTER COLUMN admin_contact_private SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_customer_user ON customers(user_id)`;
}

export async function handleAdmin(path: string[], req: Request, database: Sql, deps: Dependencies): Promise<Response> {
  const sql = database as unknown as RowSql;
  if (path[1] === "login" && req.method === "POST") {
    const limited = await deps.rateLimit("admin-login", 12, 15 * 60 * 1000);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const users = await sql`SELECT id, name, email, role, business_id, password_hash, status FROM app_users WHERE email = ${email} LIMIT 1` as Array<Identity & { password_hash: string; status: string }>;
    const user = users[0];
    if (!user || !isPlatformAdmin(user) || user.status !== "active" || !(await deps.verifyPassword(password, user.password_hash))) return reply({ message: "Invalid administrator credentials." }, 401);
    return reply({ token: await deps.createSession(user.id), user: safeUser(user) });
  }
  const auth = await deps.authenticate(req);
  if (!auth) return reply({ message: "Unauthenticated." }, 401);
  if (!isPlatformAdmin(auth.user)) return reply({ message: "Administrator access required." }, 403);
  if (path[1] === "me" && req.method === "GET") return reply({ user: safeUser(auth.user) });
  if (path[1] === "affiliates") return handleAdminAffiliates(path,req,database,auth.user);
  if (path[1] === "businesses" && path[3] === "features" && path.length === 4) return adminBusinessFeatures(req, database, path[2], auth.user);
  if(path[1]==="renewals"){
    if(path[2] && path[3]==="proof" && req.method==="GET")return renewalProof(database,path[2]);
    if(path[2] && req.method==="PATCH")return rejectRenewal(database,path[2],req,auth.user);
    if(req.method!=="GET")return reply({message:"Method not allowed."},405);
    const {page,offset}=pageOptions(req);const status=new URL(req.url).searchParams.get("status")||"pending";
    if(!["pending","approved","rejected","all"].includes(status))return reply({message:"Choose a valid request status."},422);
    const [rows,count]=await Promise.all([sql`SELECT r.id,r.business_id,b.name AS business_name,r.duration_months,r.plan_price_dh,r.note,r.reference,r.status,r.created_at::text,r.reviewed_at::text,r.actor_name,r.review_note,true AS has_proof
      FROM subscription_renewal_requests r JOIN businesses b ON b.id=r.business_id WHERE (${status}='all' OR r.status=${status}) ORDER BY r.created_at DESC LIMIT 25 OFFSET ${offset}`,
      sql`SELECT count(*)::int AS total FROM subscription_renewal_requests WHERE (${status}='all' OR status=${status})`]);
    return reply({data:rows,total:count[0].total,page,per_page:25});
  }
  if (path[1] === "businesses" && path[3] === "subscription") {
    if (!uuid.test(path[2] || "")) return reply({ message: "Invalid business identifier." }, 422);
    const businesses = await sql`SELECT id, name FROM businesses WHERE id = ${path[2]} LIMIT 1`;
    if (!businesses[0]) return reply({ message: "Business not found." }, 404);
    if (req.method === "GET") return reply(await subscriptionDetails(database, path[2]));
    if (req.method !== "POST") return reply({ message: "Method not allowed." }, 405);
    const body = await req.json().catch(() => ({}));
    const plan = subscriptionPlan(body.duration_months ?? 1);
    const mode = body.mode === undefined ? "replace" : body.mode;
    const paymentRecorded = body.payment_recorded === true;
    const amount = paymentRecorded ? paymentAmount(body.paid_amount) : null;
    const paymentMethod = paymentRecorded && PAYMENT_METHODS.some(m=>m.value===body.payment_method) ? body.payment_method : null;
    const paidAt = paymentRecorded && typeof body.paid_at === "string" && Number.isFinite(Date.parse(body.paid_at)) ? new Date(body.paid_at).toISOString() : null;
    const renewalId = body.renewal_request_id ?? null;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (!plan || !["extend","replace"].includes(mode) || !uuid.test(body.request_id || "") || !Number.isInteger(body.revision) || body.revision < 0 || !note || note.length > 1000 || reference.length > 200 || (renewalId!==null&&!uuid.test(renewalId)) || (paymentRecorded&&(!amount||!paymentMethod||!paidAt||Date.parse(paidAt)>Date.now()+60000)) || (renewalId && (!paymentRecorded||body.payment_confirmed!==true)) || (paymentRecorded && body.payment_confirmed!==true)) return reply({ message: "Choose a duration and mode, add a note, and confirm valid payment details when recording a payment." }, 422);
    const existing = await sql`SELECT id,business_id,actor_id,note,reference,duration_months,mode,amount_centimes,payment_method,paid_at::text,renewal_request_id FROM subscription_events WHERE id=${body.request_id}`;
    if(existing[0]){
      const e=existing[0];
      if(e.business_id!==path[2]||e.actor_id!==auth.user.id||e.note!==note||e.reference!==reference||e.duration_months!==plan.months||e.mode!==mode||e.amount_centimes!==amount||e.payment_method!==paymentMethod||e.renewal_request_id!==renewalId||(e.paid_at ? new Date(String(e.paid_at)).toISOString():null)!==paidAt)return reply({message:"This activation identifier has already been used."},409);
      return reply({message:"Subscription already updated.",...(await subscriptionDetails(database,path[2]))});
    }
    await subscriptionFor(database,path[2]);
    const result=await sql`WITH request_match AS MATERIALIZED (
      SELECT id,business_id,duration_months FROM subscription_renewal_requests WHERE id=${renewalId}::uuid AND business_id=${path[2]} AND status='pending' AND duration_months=${plan.months} FOR UPDATE
    ), previous AS MATERIALIZED (
      SELECT s.*,COALESCE(paid_started_at,trial_started_at) AS old_start,COALESCE(paid_ends_at,trial_ends_at) AS old_end,
        CASE WHEN COALESCE(paid_ends_at,trial_ends_at)<=now() THEN 'expired' WHEN paid_ends_at IS NULL THEN 'trial' ELSE 'active' END AS old_state
      FROM business_subscriptions s WHERE business_id=${path[2]} AND revision=${body.revision}
        AND (${renewalId}::uuid IS NULL OR EXISTS(SELECT 1 FROM request_match)) FOR UPDATE OF s
    ), changed AS (
      UPDATE business_subscriptions s SET
        paid_started_at=CASE WHEN ${mode}='extend' AND p.old_end>now() THEN COALESCE(s.paid_started_at,now()) ELSE now() END,
        paid_ends_at=((CASE WHEN ${mode}='extend' AND p.old_end>now() THEN p.old_end ELSE now() END AT TIME ZONE 'UTC')+make_interval(months=>${plan.months}::integer)) AT TIME ZONE 'UTC',revision=s.revision+1
      FROM previous p WHERE s.business_id=p.business_id AND s.revision=${body.revision}
      RETURNING s.*,p.old_start,p.old_end,p.old_state
    ), event AS (
      INSERT INTO subscription_events(id,business_id,actor_id,actor_name,action,started_at,ends_at,previous_started_at,previous_ends_at,previous_state,note,reference,duration_months,amount_dh,revision,mode,amount_centimes,payment_method,paid_at,receipt_number,renewal_request_id)
      SELECT ${body.request_id}::uuid,business_id,${auth.user.id}::uuid,${auth.user.name},'activate',
        CASE WHEN ${mode}='extend' AND old_end>now() THEN old_end ELSE paid_started_at END,paid_ends_at,old_start,old_end,old_state,
        ${note},${reference},${plan.months},${plan.price},revision,${mode},${amount},${paymentMethod},${paidAt}::timestamptz,
        CASE WHEN ${paymentRecorded} THEN 'LV-'||upper(replace(${body.request_id}::text,'-','')) ELSE NULL END,${renewalId}::uuid FROM changed RETURNING *
    ), commission AS (
      INSERT INTO affiliate_commissions(subscription_event_id,affiliate_id,business_id,duration_months,amount_centimes,rate_bps,commission_centimes)
      SELECT e.id,ab.affiliate_id,e.business_id,e.duration_months,e.amount_centimes,r.rate_bps,
        round(e.amount_centimes::numeric * r.rate_bps / 10000)::integer
      FROM event e JOIN affiliate_businesses ab ON ab.business_id=e.business_id
      JOIN affiliate_partners a ON a.id=ab.affiliate_id
      CROSS JOIN LATERAL (SELECT CASE e.duration_months
        WHEN 1 THEN a.rate_1_bps WHEN 3 THEN a.rate_3_bps
        WHEN 6 THEN a.rate_6_bps ELSE a.rate_12_bps END AS rate_bps) r
      WHERE e.amount_centimes IS NOT NULL AND e.amount_centimes>0 AND a.is_active=true AND r.rate_bps>0
      ON CONFLICT(subscription_event_id) DO NOTHING RETURNING subscription_event_id
    ), reviewed AS (
      UPDATE subscription_renewal_requests r SET status='approved',reviewed_at=now(),actor_id=${auth.user.id},actor_name=${auth.user.name},review_note=${note}
      FROM event e WHERE r.id=e.renewal_request_id RETURNING r.id
    ), email AS (
      INSERT INTO subscription_email_jobs(id,business_id,kind,period_ends_at,event_id) SELECT gen_random_uuid(),business_id,'renewed',ends_at,id FROM event ON CONFLICT(business_id,kind,period_ends_at) DO NOTHING RETURNING id
    ), audit AS (
      INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
      SELECT id,actor_id,actor_name,'subscription_activate','business',business_id,${String(businesses[0].name)},note FROM event RETURNING id
    ) SELECT id FROM audit`;
    if(!result.length){
      const retry=await sql`SELECT id FROM subscription_events WHERE id=${body.request_id} AND business_id=${path[2]} AND actor_id=${auth.user.id} AND note=${note} AND reference=${reference} AND duration_months=${plan.months} AND mode=${mode} AND amount_centimes IS NOT DISTINCT FROM ${amount}::integer AND payment_method IS NOT DISTINCT FROM ${paymentMethod}::text AND paid_at IS NOT DISTINCT FROM ${paidAt}::timestamptz AND renewal_request_id IS NOT DISTINCT FROM ${renewalId}::uuid`;
      if(retry.length)return reply({message:"Subscription already updated.",...(await subscriptionDetails(database,path[2]))});
      return reply({message:"The subscription or renewal request changed. Review the latest details and try again."},409);
    }
    return reply({message:`Subscription ${mode==="extend"?"renewed":"activated"} for ${plan.months} calendar month${plan.months===1?"":"s"}. ${paymentRecorded?"Payment recorded and receipt created.":"No payment recorded."}`,...(await subscriptionDetails(database,path[2]))});
  }
  if (path[1] === "logout" && req.method === "POST") {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    await sql`DELETE FROM user_sessions WHERE token = ${token} AND user_id = ${auth.user.id}`;
    return reply({ message: "Signed out." });
  }
  if (path[1] === "password" && req.method === "PUT") {
    const limited = await deps.rateLimit("admin-password", 8, 15 * 60 * 1000);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const current = typeof body.current_password === "string" ? body.current_password : "";
    const password = typeof body.password === "string" ? body.password : "";
    const rows = await sql`SELECT password_hash FROM app_users WHERE id = ${auth.user.id} LIMIT 1`;
    if (!(await deps.verifyPassword(current, String(rows[0]?.password_hash)))) return reply({ message: "Current password is incorrect." }, 422);
    if (password.length < 10 || password !== body.password_confirmation) return reply({ message: "Use at least 10 characters and confirm the new password." }, 422);
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    await sql.transaction([
      sql`UPDATE app_users SET password_hash = ${await deps.hashPassword(password)}, updated_at = now() WHERE id = ${auth.user.id}`,
      sql`DELETE FROM user_sessions WHERE user_id = ${auth.user.id} AND token <> ${token}`,
      sql`INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name)
        VALUES (${randomUUID()},${auth.user.id},${auth.user.name},'password_change','administrator',${auth.user.id},${auth.user.name})`,
    ]);
    return reply({ message: "Password updated. Other sessions have been signed out." });
  }
  if (req.method === "PATCH" && ["businesses", "customers"].includes(path[1]) && path[2]) {
    if (!uuid.test(path[2])) return reply({ message: "Invalid account identifier." }, 422);
    const body = await req.json().catch(() => ({}));
    if (!["active", "suspended"].includes(body.status)) return reply({ message: "Choose a valid account status." }, 422);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (body.status === "suspended" && !reason) return reply({ message: "Add a reason for suspending this account." }, 422);
    const entity = path[1] === "businesses" ? "business" : "customer";
    if ((entity === "business" && path[2] === auth.user.business_id) || path[2] === auth.user.id) return reply({ message: "You cannot suspend your own account or business." }, 409);
    const rows = entity === "business"
      ? await sql`SELECT id, name, status FROM businesses WHERE id = ${path[2]} LIMIT 1`
      : await sql`SELECT id, name, status, role FROM app_users WHERE id = ${path[2]} AND role = 'customer' LIMIT 1`;
    const target = rows[0];
    if (!target) return reply({ message: "Account not found." }, 404);
    if (entity === "customer" && isPlatformAdmin({ id: String(target.id), role: String(target.role) })) return reply({ message: "Administrator accounts cannot be managed here." }, 409);
    const auditId = randomUUID();
    // The status change and audit record commit together; suspended sessions are revoked.
    if (entity === "business") {
      await sql.transaction([
        sql`UPDATE businesses SET status = ${body.status}, updated_at = now() WHERE id = ${path[2]}`,
        sql`INSERT INTO admin_audit_logs(id, actor_id, actor_name, action, entity_type, entity_id, entity_name, reason)
          VALUES (${auditId}, ${auth.user.id}, ${auth.user.name}, ${body.status === "suspended" ? "suspend" : "activate"}, 'business', ${path[2]}, ${String(target.name)}, ${reason})`,
        sql`DELETE FROM user_sessions WHERE ${body.status} = 'suspended' AND user_id IN (SELECT id FROM app_users WHERE business_id = ${path[2]})`,
      ]);
    } else {
      await sql.transaction([
        sql`UPDATE app_users SET status = ${body.status}, updated_at = now() WHERE id = ${path[2]} AND role = 'customer'`,
        sql`INSERT INTO admin_audit_logs(id, actor_id, actor_name, action, entity_type, entity_id, entity_name, reason)
          VALUES (${auditId}, ${auth.user.id}, ${auth.user.name}, ${body.status === "suspended" ? "suspend" : "activate"}, 'customer', ${path[2]}, ${String(target.name)}, ${reason})`,
        sql`DELETE FROM user_sessions WHERE user_id = ${path[2]} AND ${body.status} = 'suspended'`,
      ]);
    }
    return reply({ message: body.status === "suspended" ? "Account suspended." : "Account activated." });
  }
  if (req.method !== "GET") return reply({ message: "API route not found." }, 404);
  if (path[1] === "overview") {
    const [stats, trend, businesses, subscriptions] = await Promise.all([
      sql`SELECT
        (SELECT count(*)::int FROM businesses) AS businesses,
        (SELECT count(*)::int FROM businesses WHERE status = 'active') AS active_businesses,
        (SELECT count(*)::int FROM app_users WHERE role = 'customer') AS customers,
        (SELECT count(*)::int FROM customers) AS cards,
        (SELECT COALESCE(sum(stamp_count),0)::int FROM visits) AS stamps,
        (SELECT COALESCE(sum(stamp_count),0)::int FROM visits WHERE created_at >= current_date) AS stamps_today,
        (SELECT count(*)::int FROM reward_redemptions WHERE status = 'redeemed') AS redeemed,
        (SELECT count(*)::int FROM reward_redemptions WHERE status = 'ready') AS ready_rewards`,
      sql`SELECT d::date::text AS date,
        (SELECT COALESCE(sum(stamp_count),0)::int FROM visits WHERE created_at >= d AND created_at < d + interval '1 day') AS stamps,
        (SELECT count(*)::int FROM reward_redemptions WHERE redeemed_at >= d AND redeemed_at < d + interval '1 day') AS rewards
        FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d ORDER BY d`,
      sql`SELECT b.id, b.name, b.logo_url, b.status, count(c.id)::int AS cards FROM businesses b LEFT JOIN customers c ON c.business_id = b.id GROUP BY b.id ORDER BY count(c.id) DESC, b.name LIMIT 5`,
      sql`SELECT
        (SELECT COALESCE(sum(amount_centimes),0)::bigint::text FROM subscription_events WHERE paid_at>=date_trunc('month',now() AT TIME ZONE 'Africa/Casablanca') AT TIME ZONE 'Africa/Casablanca' AND paid_at<now()+interval '1 minute') AS payments_month_centimes,
        (SELECT count(*)::int FROM business_subscriptions WHERE paid_ends_at>now()) AS subscribed,
        (SELECT count(*)::int FROM business_subscriptions WHERE COALESCE(paid_ends_at,trial_ends_at)>now() AND COALESCE(paid_ends_at,trial_ends_at)<=now()+interval '3 days') AS ending_soon,
        (SELECT count(*)::int FROM subscription_renewal_requests WHERE status='pending') AS pending_requests`,
    ]);
    return reply({ data: { stats: stats[0], trend, businesses, subscriptions: subscriptions[0] }, generated_at: new Date().toISOString() });
  }
  const { page, offset, query, status } = pageOptions(req);
  const subscriptionFilter=new URL(req.url).searchParams.get("subscription")||"";
  if(!["","trial","active","ending","expired"].includes(subscriptionFilter))return reply({message:"Choose a valid subscription filter."},422);
  if (path[1] === "businesses") {
    if (path[2]) {
      if (!uuid.test(path[2])) return reply({ message: "Invalid identifier." }, 422);
      const rows = await sql`SELECT b.id, b.name, b.email, b.slug, b.status, b.logo_url, b.phone, b.address, b.created_at::text,
        lc.reward_name, lc.required_stamps,
        (SELECT count(*)::int FROM customers WHERE business_id = b.id) AS cards,
        (SELECT COALESCE(sum(stamp_count),0)::int FROM visits WHERE business_id = b.id) AS stamps,
        (SELECT count(*)::int FROM reward_redemptions WHERE business_id = b.id AND status = 'redeemed') AS redeemed
        FROM businesses b LEFT JOIN loyalty_cards lc ON lc.business_id = b.id WHERE b.id = ${path[2]} LIMIT 1`;
      return rows[0] ? reply({ data: { ...rows[0], subscription: await subscriptionFor(database, path[2]) } }) : reply({ message: "Business not found." }, 404);
    }
    const [rows, total] = await Promise.all([
      sql`SELECT b.id, b.name, b.email, b.slug, b.status, b.logo_url, b.created_at::text,
        (SELECT count(*)::int FROM customers WHERE business_id = b.id) AS cards,
        (SELECT COALESCE(sum(stamp_count),0)::int FROM visits WHERE business_id = b.id) AS stamps
        FROM businesses b WHERE (b.name ILIKE ${query} OR b.email ILIKE ${query}) AND (${status} = '' OR b.status = ${status}) AND (${subscriptionFilter}='' OR EXISTS(SELECT 1 FROM business_subscriptions s WHERE s.business_id=b.id AND (
      (${subscriptionFilter}='trial' AND s.paid_ends_at IS NULL AND s.trial_ends_at>now()) OR
      (${subscriptionFilter}='active' AND s.paid_ends_at>now()) OR
      (${subscriptionFilter}='ending' AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now() AND COALESCE(s.paid_ends_at,s.trial_ends_at)<=now()+interval '3 days') OR
      (${subscriptionFilter}='expired' AND COALESCE(s.paid_ends_at,s.trial_ends_at)<=now()))))
        ORDER BY b.created_at DESC, b.id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT count(*)::int AS total FROM businesses b WHERE (b.name ILIKE ${query} OR b.email ILIKE ${query}) AND (${status} = '' OR b.status = ${status}) AND (${subscriptionFilter}='' OR EXISTS(SELECT 1 FROM business_subscriptions s WHERE s.business_id=b.id AND (
      (${subscriptionFilter}='trial' AND s.paid_ends_at IS NULL AND s.trial_ends_at>now()) OR
      (${subscriptionFilter}='active' AND s.paid_ends_at>now()) OR
      (${subscriptionFilter}='ending' AND COALESCE(s.paid_ends_at,s.trial_ends_at)>now() AND COALESCE(s.paid_ends_at,s.trial_ends_at)<=now()+interval '3 days') OR
      (${subscriptionFilter}='expired' AND COALESCE(s.paid_ends_at,s.trial_ends_at)<=now()))))`,
    ]);
    const subscriptions = new Map((await subscriptionsFor(database, rows.map(row => String(row.id)))).map(subscription => [subscription.business_id, subscription]));
    return reply({ data: rows.map(row => ({ ...row, subscription: subscriptions.get(String(row.id)) })), total: total[0].total, page, per_page: 25 });
  }
  if (path[1] === "customers") {
    if (path[2]) {
      if (!uuid.test(path[2])) return reply({ message: "Invalid identifier." }, 422);
      const [users, cards] = await Promise.all([
        sql`SELECT u.id, u.name, CASE WHEN privacy.visible THEN u.email ELSE NULL END AS email, u.status, u.created_at::text, CASE WHEN privacy.visible THEN cp.phone ELSE NULL END AS phone, privacy.visible AS contact_details_visible FROM app_users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id CROSS JOIN LATERAL (SELECT NOT EXISTS (SELECT 1 FROM customers c JOIN businesses b ON b.id=c.business_id WHERE c.user_id=u.id AND b.admin_contact_private=true) AS visible) privacy WHERE u.id = ${path[2]} AND u.role = 'customer' LIMIT 1`,
        sql`SELECT c.id, c.business_id,lc.id AS card_id,lc.reward_description, b.name AS business_name, b.status AS business_status, cl.current_stamps, lc.required_stamps, lc.reward_name
          FROM customers c JOIN businesses b ON b.id = c.business_id LEFT JOIN customer_loyalties cl ON cl.customer_id = c.id LEFT JOIN loyalty_cards lc ON lc.id = cl.loyalty_card_id WHERE c.user_id = ${path[2]} ORDER BY c.created_at DESC`,
      ]);
      const scopedCards=await Promise.all(cards.map(async row=>{if(!row.card_id)return row;const effective=await effectiveRewardCard(database,String(row.id),{id:String(row.card_id),business_id:String(row.business_id),required_stamps:Number(row.required_stamps),reward_name:String(row.reward_name),reward_description:row.reward_description as string|null});return {...row,required_stamps:effective.required_stamps,reward_name:effective.reward_name};}));
      return users[0] ? reply({ data: { ...users[0], cards:scopedCards } }) : reply({ message: "Customer not found." }, 404);
    }
    const [rows, total] = await Promise.all([
      sql`SELECT u.id, u.name, CASE WHEN privacy.visible THEN u.email ELSE NULL END AS email, privacy.visible AS contact_details_visible, u.status, u.avatar_url, u.created_at::text,
        (SELECT count(*)::int FROM customers WHERE user_id = u.id) AS cards
        FROM app_users u CROSS JOIN LATERAL (SELECT NOT EXISTS (SELECT 1 FROM customers c JOIN businesses b ON b.id=c.business_id WHERE c.user_id=u.id AND b.admin_contact_private=true) AS visible) privacy WHERE u.role = 'customer' AND (u.name ILIKE ${query} OR (privacy.visible AND u.email ILIKE ${query})) AND (${status} = '' OR u.status = ${status})
        ORDER BY u.created_at DESC, u.id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT count(*)::int AS total FROM app_users u CROSS JOIN LATERAL (SELECT NOT EXISTS (SELECT 1 FROM customers c JOIN businesses b ON b.id=c.business_id WHERE c.user_id=u.id AND b.admin_contact_private=true) AS visible) privacy WHERE u.role = 'customer' AND (u.name ILIKE ${query} OR (privacy.visible AND u.email ILIKE ${query})) AND (${status} = '' OR u.status = ${status})`,
    ]);
    return reply({ data: rows, total: total[0].total, page, per_page: 25 });
  }
  if (path[1] === "activity") {
    const params = new URL(req.url).searchParams;
    const kind = ["stamp", "reward", "admin"].includes(params.get("kind") || "") ? params.get("kind")! : "";
    const events = sql`WITH events AS (
      SELECT CONCAT('stamp-', v.id) AS id, 'stamp' AS type, CONCAT_WS(' ', c.first_name, c.last_name) AS name, b.name AS business_name, CONCAT(v.stamp_count, CASE WHEN v.stamp_count=1 THEN ' stamp collected' ELSE ' stamps collected' END) AS title, v.stamp_message AS reason, v.created_at AS date
      FROM visits v JOIN customers c ON c.id = v.customer_id JOIN businesses b ON b.id = v.business_id
      UNION ALL SELECT CONCAT('reward-', r.id), 'reward', CONCAT_WS(' ', c.first_name, c.last_name), b.name,
        CASE WHEN r.status = 'redeemed' THEN 'Reward redeemed' ELSE 'Reward unlocked' END, '', COALESCE(r.redeemed_at, r.earned_at)
      FROM reward_redemptions r JOIN customers c ON c.id = r.customer_id JOIN businesses b ON b.id = r.business_id WHERE r.status IN ('ready','redeemed')
      UNION ALL SELECT CONCAT('admin-', a.id), 'admin', a.actor_name, a.entity_name,
        CASE WHEN a.action = 'suspend' THEN 'Account suspended' WHEN a.action = 'subscription_activate' THEN 'Subscription activated · ' || COALESCE((SELECT e.duration_months FROM subscription_events e WHERE e.id = a.id),1)::text || ' month(s)' WHEN a.action = 'subscription_expiry_adjustment' THEN 'Subscription expiry adjusted for testing' WHEN a.action='renewal_rejected' THEN 'Renewal request rejected' WHEN a.action = 'reward_levels_change' THEN 'Reward levels updated' WHEN a.action = 'business_features_change' THEN 'Business options updated' WHEN a.action = 'customer_privacy_change' THEN 'Customer privacy updated' WHEN a.action = 'password_change' THEN 'Administrator password updated' ELSE 'Account activated' END, a.reason, a.created_at FROM admin_audit_logs a
    ) SELECT id, type, name, business_name, title, reason, date::text FROM events WHERE (${kind} = '' OR type = ${kind}) ORDER BY date DESC, id LIMIT 25 OFFSET ${offset}`;
    const total = sql`SELECT
      CASE WHEN ${kind} IN ('', 'stamp') THEN (SELECT count(*)::int FROM visits) ELSE 0 END +
      CASE WHEN ${kind} IN ('', 'reward') THEN (SELECT count(*)::int FROM reward_redemptions WHERE status IN ('ready','redeemed')) ELSE 0 END +
      CASE WHEN ${kind} IN ('', 'admin') THEN (SELECT count(*)::int FROM admin_audit_logs) ELSE 0 END AS total`;
    const [rows, counts] = await Promise.all([events, total]);
    return reply({ data: rows, total: counts[0].total, page, per_page: 25 });
  }
  if (path[1] === "settings") return reply({ data: {
    account: safeUser(auth.user),
    integrations: {
      google_wallet: !!(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_CLIENT_EMAIL && process.env.GOOGLE_WALLET_PRIVATE_KEY),
      apple_wallet: process.env.APPLE_WALLET_ENABLED === 'true' && !!(process.env.APPLE_WALLET_PASS_TYPE_ID && process.env.APPLE_WALLET_TEAM_ID && process.env.APPLE_WALLET_SIGNER_CERT && process.env.APPLE_WALLET_SIGNER_KEY && process.env.APPLE_WALLET_WWDR_CERT),
      email: !!process.env.RESEND_API_KEY,
      images: !!(process.env.CLOUDINARY_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    },
    access: "Server-authorized administrator accounts only", refresh_seconds: 3,
  } });
  return reply({ message: "API route not found." }, 404);
}

