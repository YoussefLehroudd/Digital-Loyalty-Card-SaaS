import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

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
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
  await sql`CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id uuid PRIMARY KEY, actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    actor_name text NOT NULL, action text NOT NULL, entity_type text NOT NULL,
    entity_id uuid NOT NULL, entity_name text NOT NULL, reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC)`;
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
    const [stats, trend, businesses] = await Promise.all([
      sql`SELECT
        (SELECT count(*)::int FROM businesses) AS businesses,
        (SELECT count(*)::int FROM businesses WHERE status = 'active') AS active_businesses,
        (SELECT count(*)::int FROM app_users WHERE role = 'customer') AS customers,
        (SELECT count(*)::int FROM customers) AS cards,
        (SELECT count(*)::int FROM visits) AS stamps,
        (SELECT count(*)::int FROM visits WHERE created_at >= current_date) AS stamps_today,
        (SELECT count(*)::int FROM reward_redemptions WHERE status = 'redeemed') AS redeemed,
        (SELECT count(*)::int FROM reward_redemptions WHERE status = 'ready') AS ready_rewards`,
      sql`SELECT d::date::text AS date,
        (SELECT count(*)::int FROM visits WHERE created_at >= d AND created_at < d + interval '1 day') AS stamps,
        (SELECT count(*)::int FROM reward_redemptions WHERE redeemed_at >= d AND redeemed_at < d + interval '1 day') AS rewards
        FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d ORDER BY d`,
      sql`SELECT b.id, b.name, b.logo_url, b.status, count(c.id)::int AS cards FROM businesses b LEFT JOIN customers c ON c.business_id = b.id GROUP BY b.id ORDER BY count(c.id) DESC, b.name LIMIT 5`,
    ]);
    return reply({ data: { stats: stats[0], trend, businesses }, generated_at: new Date().toISOString() });
  }
  const { page, offset, query, status } = pageOptions(req);
  if (path[1] === "businesses") {
    if (path[2]) {
      if (!uuid.test(path[2])) return reply({ message: "Invalid identifier." }, 422);
      const rows = await sql`SELECT b.id, b.name, b.email, b.slug, b.status, b.logo_url, b.phone, b.address, b.created_at::text,
        lc.reward_name, lc.required_stamps,
        (SELECT count(*)::int FROM customers WHERE business_id = b.id) AS cards,
        (SELECT count(*)::int FROM visits WHERE business_id = b.id) AS stamps,
        (SELECT count(*)::int FROM reward_redemptions WHERE business_id = b.id AND status = 'redeemed') AS redeemed
        FROM businesses b LEFT JOIN loyalty_cards lc ON lc.business_id = b.id WHERE b.id = ${path[2]} LIMIT 1`;
      return rows[0] ? reply({ data: rows[0] }) : reply({ message: "Business not found." }, 404);
    }
    const [rows, total] = await Promise.all([
      sql`SELECT b.id, b.name, b.email, b.slug, b.status, b.logo_url, b.created_at::text,
        (SELECT count(*)::int FROM customers WHERE business_id = b.id) AS cards,
        (SELECT count(*)::int FROM visits WHERE business_id = b.id) AS stamps
        FROM businesses b WHERE (b.name ILIKE ${query} OR b.email ILIKE ${query}) AND (${status} = '' OR b.status = ${status})
        ORDER BY b.created_at DESC, b.id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT count(*)::int AS total FROM businesses b WHERE (b.name ILIKE ${query} OR b.email ILIKE ${query}) AND (${status} = '' OR b.status = ${status})`,
    ]);
    return reply({ data: rows, total: total[0].total, page, per_page: 25 });
  }
  if (path[1] === "customers") {
    if (path[2]) {
      if (!uuid.test(path[2])) return reply({ message: "Invalid identifier." }, 422);
      const [users, cards] = await Promise.all([
        sql`SELECT u.id, u.name, u.email, u.status, u.created_at::text, cp.phone FROM app_users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id WHERE u.id = ${path[2]} AND u.role = 'customer' LIMIT 1`,
        sql`SELECT c.id, b.name AS business_name, b.status AS business_status, cl.current_stamps, lc.required_stamps, lc.reward_name
          FROM customers c JOIN businesses b ON b.id = c.business_id LEFT JOIN customer_loyalties cl ON cl.customer_id = c.id LEFT JOIN loyalty_cards lc ON lc.id = cl.loyalty_card_id WHERE c.user_id = ${path[2]} ORDER BY c.created_at DESC`,
      ]);
      return users[0] ? reply({ data: { ...users[0], cards } }) : reply({ message: "Customer not found." }, 404);
    }
    const [rows, total] = await Promise.all([
      sql`SELECT u.id, u.name, u.email, u.status, u.avatar_url, u.created_at::text,
        (SELECT count(*)::int FROM customers WHERE user_id = u.id) AS cards
        FROM app_users u WHERE u.role = 'customer' AND (u.name ILIKE ${query} OR u.email ILIKE ${query}) AND (${status} = '' OR u.status = ${status})
        ORDER BY u.created_at DESC, u.id LIMIT 25 OFFSET ${offset}`,
      sql`SELECT count(*)::int AS total FROM app_users u WHERE u.role = 'customer' AND (u.name ILIKE ${query} OR u.email ILIKE ${query}) AND (${status} = '' OR u.status = ${status})`,
    ]);
    return reply({ data: rows, total: total[0].total, page, per_page: 25 });
  }
  if (path[1] === "activity") {
    const params = new URL(req.url).searchParams;
    const kind = ["stamp", "reward", "admin"].includes(params.get("kind") || "") ? params.get("kind")! : "";
    const events = sql`WITH events AS (
      SELECT CONCAT('stamp-', v.id) AS id, 'stamp' AS type, CONCAT_WS(' ', c.first_name, c.last_name) AS name, b.name AS business_name, 'Stamp collected' AS title, '' AS reason, v.created_at AS date
      FROM visits v JOIN customers c ON c.id = v.customer_id JOIN businesses b ON b.id = v.business_id
      UNION ALL SELECT CONCAT('reward-', r.id), 'reward', CONCAT_WS(' ', c.first_name, c.last_name), b.name,
        CASE WHEN r.status = 'redeemed' THEN 'Reward redeemed' ELSE 'Reward unlocked' END, '', COALESCE(r.redeemed_at, r.earned_at)
      FROM reward_redemptions r JOIN customers c ON c.id = r.customer_id JOIN businesses b ON b.id = r.business_id
      UNION ALL SELECT CONCAT('admin-', a.id), 'admin', a.actor_name, a.entity_name,
        CASE WHEN a.action = 'suspend' THEN 'Account suspended' WHEN a.action = 'password_change' THEN 'Administrator password updated' ELSE 'Account activated' END, a.reason, a.created_at FROM admin_audit_logs a
    ) SELECT id, type, name, business_name, title, reason, date::text FROM events WHERE (${kind} = '' OR type = ${kind}) ORDER BY date DESC, id LIMIT 25 OFFSET ${offset}`;
    const total = sql`SELECT
      CASE WHEN ${kind} IN ('', 'stamp') THEN (SELECT count(*)::int FROM visits) ELSE 0 END +
      CASE WHEN ${kind} IN ('', 'reward') THEN (SELECT count(*)::int FROM reward_redemptions) ELSE 0 END +
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
