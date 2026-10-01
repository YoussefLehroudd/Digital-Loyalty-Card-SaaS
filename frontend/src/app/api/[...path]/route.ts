import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getSql } from "@/lib/server/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

type Sql = ReturnType<typeof getSql>;
type JsonRecord = Record<string, unknown>;
type Role = "business_owner" | "customer" | "platform_admin";

type DbUser = {
  id: string;
  business_id: string | null;
  name: string;
  email: string;
  role: Role;
  password_hash: string;
};

type DbBusiness = {
  id: string;
  slug: string;
  name: string;
  email: string;
  logo_url: string | null;
  logo_public_id: string | null;
  hero_image_url: string | null;
  hero_image_public_id: string | null;
  hero_image_zoom: number | null;
  hero_image_position_x: number | null;
  hero_image_position_y: number | null;
  primary_color: string;
  phone: string | null;
  address: string | null;
};

type DbLoyaltyCard = {
  id: string;
  business_id: string;
  reward_name: string;
  required_stamps: number;
  reward_description: string | null;
  created_at: string;
  updated_at: string;
};

type DbCustomer = {
  id: string;
  business_id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
};

type DbLoyalty = {
  id: string;
  customer_id: string;
  loyalty_card_id: string;
  current_stamps: number;
  created_at: string;
  updated_at: string;
};

type AuthContext = {
  user: DbUser;
  business: DbBusiness | null;
};

const scrypt = promisify(scryptCallback);
let schemaReady: Promise<void> | null = null;

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function error(message: string, status = 400, errors?: Record<string, string[]>) {
  return json({ message, ...(errors ? { errors } : {}) }, { status });
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text.length ? text : null;
}

function asNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(input: string) {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `business-${randomBytes(3).toString("hex")}`;
}

async function readJson(req: Request): Promise<JsonRecord> {
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    return {};
  }
  return (await req.json().catch(() => ({}))) as JsonRecord;
}

async function ensureSchema(sql: Sql) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS businesses (
        id uuid PRIMARY KEY,
        slug text UNIQUE NOT NULL,
        name text NOT NULL,
        email text NOT NULL,
        logo_url text,
        logo_public_id text,
        hero_image_url text,
        hero_image_public_id text,
        hero_image_zoom double precision DEFAULT 1,
        hero_image_position_x double precision DEFAULT 50,
        hero_image_position_y double precision DEFAULT 50,
        primary_color text DEFAULT '#111827',
        phone text,
        address text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS app_users (
        id uuid PRIMARY KEY,
        business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
        name text NOT NULL,
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_sessions (
        token text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        expires_at timestamptz DEFAULT now() + interval '30 days'
      )`;

      await sql`CREATE TABLE IF NOT EXISTS customer_profiles (
        user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        first_name text NOT NULL,
        last_name text NOT NULL,
        phone text,
        avatar_url text,
        preferences jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS loyalty_cards (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        reward_name text NOT NULL,
        required_stamps integer NOT NULL DEFAULT 10,
        reward_description text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (business_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS customers (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
        first_name text,
        last_name text,
        email text,
        phone text,
        qr_code text UNIQUE,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS customer_loyalties (
        id uuid PRIMARY KEY,
        customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        loyalty_card_id uuid NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
        current_stamps integer NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (customer_id, loyalty_card_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS visits (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS reward_redemptions (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        loyalty_card_id uuid NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'ready',
        earned_at timestamptz DEFAULT now(),
        redeemed_at timestamptz
      )`;

      await sql`CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_visits_business_customer ON visits(business_id, customer_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_rewards_business_customer ON reward_redemptions(business_id, customer_id)`;
      await sql`CREATE TABLE IF NOT EXISTS realtime_events (
        id bigserial PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        event_name text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_realtime_events_business_id ON realtime_events(business_id, id)`;
    })();
  }
  await schemaReady;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(key, "hex");
  return storedBuffer.length === hash.length && timingSafeEqual(storedBuffer, hash);
}

function publicBusiness(b: DbBusiness) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    email: b.email,
    logo_url: b.logo_url,
    logo_public_id: b.logo_public_id,
    hero_image_url: b.hero_image_url,
    hero_image_public_id: b.hero_image_public_id,
    hero_image_zoom: b.hero_image_zoom,
    hero_image_position_x: b.hero_image_position_x,
    hero_image_position_y: b.hero_image_position_y,
    primary_color: b.primary_color,
    phone: b.phone,
    address: b.address,
  };
}

function publicUser(user: DbUser, business: DbBusiness | null, profile?: JsonRecord | null) {
  return {
    id: user.id,
    business_id: user.business_id,
    name: user.name,
    email: user.email,
    role: user.role,
    business: business ? publicBusiness(business) : null,
    customer_profile: profile ?? null,
  };
}

function publicLoyaltyCard(card: DbLoyaltyCard | null) {
  if (!card) return null;
  return {
    id: card.id,
    business_id: card.business_id,
    reward_name: card.reward_name,
    required_stamps: card.required_stamps,
    reward_description: card.reward_description,
    created_at: card.created_at,
    updated_at: card.updated_at,
  };
}

async function emitRealtime(sql: Sql, businessId: string, eventName: string, payload: JsonRecord = {}) {
  await sql`INSERT INTO realtime_events (business_id, event_name, payload) VALUES (${businessId}, ${eventName}, ${JSON.stringify(payload)}::jsonb)`;
}

async function createSession(sql: Sql, userId: string) {
  const token = randomBytes(32).toString("hex");
  await sql`INSERT INTO user_sessions (token, user_id) VALUES (${token}, ${userId})`;
  return token;
}

function bearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuth(req: Request, sql: Sql): Promise<AuthContext | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const rows = (await sql`
    SELECT u.id, u.business_id, u.name, u.email, u.role, u.password_hash
    FROM user_sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1
  `) as DbUser[];

  const user = rows[0];
  if (!user) return null;

  const businesses = user.business_id
    ? ((await sql`SELECT * FROM businesses WHERE id = ${user.business_id} LIMIT 1`) as DbBusiness[])
    : [];

  return { user, business: businesses[0] ?? null };
}

async function requireAuth(req: Request, sql: Sql) {
  const auth = await getAuth(req, sql);
  if (!auth) throw new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401 });
  return auth;
}

async function defaultCard(sql: Sql, businessId: string) {
  const rows = (await sql`SELECT * FROM loyalty_cards WHERE business_id = ${businessId} LIMIT 1`) as DbLoyaltyCard[];
  if (rows[0]) return rows[0];

  const id = randomUUID();
  const inserted = (await sql`
    INSERT INTO loyalty_cards (id, business_id, reward_name, required_stamps, reward_description)
    VALUES (${id}, ${businessId}, 'Free Coffee', 10, 'Collect stamps to unlock your reward.')
    RETURNING *
  `) as DbLoyaltyCard[];
  return inserted[0];
}

function rewardStatus(current: number, required: number, redeemed = false) {
  if (redeemed) return "redeemed";
  return current >= required ? "ready" : "collecting";
}

function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  return {
    data: items.slice(start, start + perPage),
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: lastPage,
      from: total ? start + 1 : null,
      to: total ? Math.min(start + perPage, total) : null,
    },
  };
}

async function customerRow(sql: Sql, customer: DbCustomer, card: DbLoyaltyCard | null) {
  const visits = (await sql`
    SELECT id, created_at::text AS date FROM visits WHERE customer_id = ${customer.id} ORDER BY created_at DESC
  `) as Array<{ id: string; date: string }>;
  const loyalties = card
    ? ((await sql`
        SELECT * FROM customer_loyalties WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} LIMIT 1
      `) as DbLoyalty[])
    : [];
  const loyalty = loyalties[0];
  const current = loyalty?.current_stamps ?? 0;
  const required = card?.required_stamps ?? 10;
  const redeemedRows = (await sql`
    SELECT count(*)::int AS count FROM reward_redemptions WHERE customer_id = ${customer.id} AND status = 'redeemed'
  `) as Array<{ count: number }>;

  return {
    id: customer.id,
    first_name: customer.first_name ?? "",
    last_name: customer.last_name ?? "",
    email: customer.email,
    phone: customer.phone,
    qr_code: customer.qr_code,
    current_stamps: current,
    required_stamps: required,
    reward_status: rewardStatus(current, required, (redeemedRows[0]?.count ?? 0) > 0),
    total_visits: visits.length,
    last_visit: visits[0]?.date ?? null,
    joined_at: customer.created_at,
  };
}

async function handleAuth(path: string[], req: Request, sql: Sql) {
  if (path[1] === "register" && req.method === "POST") {
    const body = await readJson(req);
    const businessName = asString(body.business_name);
    const businessEmail = asString(body.business_email);
    const name = asString(body.name);
    const email = asString(body.email).toLowerCase();
    const password = asString(body.password);

    if (!businessName || !businessEmail || !name || !email || password.length < 6) {
      return error("Please fill all required fields.", 422);
    }

    const businessId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    const slug = `${slugify(businessName)}-${randomBytes(2).toString("hex")}`;

    const business = ((await sql`
      INSERT INTO businesses (id, slug, name, email, primary_color)
      VALUES (${businessId}, ${slug}, ${businessName}, ${businessEmail}, '#111827')
      RETURNING *
    `) as DbBusiness[])[0];

    const user = ((await sql`
      INSERT INTO app_users (id, business_id, name, email, password_hash, role)
      VALUES (${userId}, ${businessId}, ${name}, ${email}, ${passwordHash}, 'business_owner')
      RETURNING *
    `) as DbUser[])[0];

    await defaultCard(sql, businessId);
    const token = await createSession(sql, user.id);

    return json({ token, token_type: "Bearer", user: publicUser(user, business) }, { status: 201 });
  }

  if (path[1] === "login" && req.method === "POST") {
    const body = await readJson(req);
    const email = asString(body.email).toLowerCase();
    const password = asString(body.password);
    const rows = (await sql`SELECT * FROM app_users WHERE email = ${email} AND role = 'business_owner' LIMIT 1`) as DbUser[];
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return error("Invalid credentials.", 401);
    }
    const business = user.business_id
      ? (((await sql`SELECT * FROM businesses WHERE id = ${user.business_id} LIMIT 1`) as DbBusiness[])[0] ?? null)
      : null;
    const token = await createSession(sql, user.id);
    return json({ token, token_type: "Bearer", user: publicUser(user, business) });
  }

  if (path[1] === "logout" && req.method === "POST") {
    const token = bearerToken(req);
    if (token) await sql`DELETE FROM user_sessions WHERE token = ${token}`;
    return json({ message: "Logged out." });
  }

  if (path[1] === "me" && req.method === "GET") {
    const auth = await requireAuth(req, sql);
    return json({ user: publicUser(auth.user, auth.business) });
  }

  if ((path[1] === "forgot-password" || path[1] === "reset-password") && req.method === "POST") {
    return json({ message: "Password reset emails are not configured yet on Vercel." });
  }

  return null;
}

async function handleRealtime(req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);
  if (!auth.business) return error("Business not found.", 404);
  const url = new URL(req.url);
  const after = Math.max(0, Number(url.searchParams.get("after") ?? 0));
  const rows = await sql`
    SELECT id::text, event_name, payload, created_at::text
    FROM realtime_events
    WHERE business_id = ${auth.business.id} AND id > ${after}
    ORDER BY id ASC
    LIMIT 100
  `;
  return json({ data: rows, cursor: rows.length ? String((rows[rows.length - 1] as { id: string }).id) : String(after) });
}

async function handleDashboard(path: string[], req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);
  if (!auth.business) return error("Business not found.", 404);

  if (path[1] === "session") {
    return json({ message: "OK", user: publicUser(auth.user, auth.business) });
  }

  const businessId = auth.business.id;
  const totalCustomers = ((await sql`SELECT count(*)::int AS count FROM customers WHERE business_id = ${businessId}`) as Array<{ count: number }>)[0]?.count ?? 0;
  const visitsThisMonth = ((await sql`
    SELECT count(*)::int AS count FROM visits
    WHERE business_id = ${businessId} AND created_at >= date_trunc('month', now())
  `) as Array<{ count: number }>)[0]?.count ?? 0;
  const rewardsRedeemed = ((await sql`
    SELECT count(*)::int AS count FROM reward_redemptions WHERE business_id = ${businessId} AND status = 'redeemed'
  `) as Array<{ count: number }>)[0]?.count ?? 0;

  return json({
    business: publicBusiness(auth.business),
    metrics: {
      total_customers: totalCustomers,
      active_customers: totalCustomers,
      visits_this_month: visitsThisMonth,
      rewards_redeemed: rewardsRedeemed,
    },
    generated_at: new Date().toISOString(),
  });
}

async function handleBusiness(path: string[], req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);
  if (!auth.business) return error("Business not found.", 404);
  const businessId = auth.business.id;

  if (path[1] === "profile") {
    if (req.method === "GET") return json({ business: publicBusiness(auth.business) });

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const name = asString(body.name, auth.business.name);
      const email = asString(body.email, auth.business.email);
      const primary = asString(body.primary_color, auth.business.primary_color);
      const updated = ((await sql`
        UPDATE businesses SET
          name = ${name}, email = ${email}, phone = ${asNullableString(body.phone)}, address = ${asNullableString(body.address)},
          primary_color = ${primary}, hero_image_url = ${asNullableString(body.hero_image_url)},
          hero_image_public_id = ${asNullableString(body.hero_image_public_id)},
          hero_image_zoom = ${asNumber(body.hero_image_zoom, auth.business.hero_image_zoom ?? 1)},
          hero_image_position_x = ${asNumber(body.hero_image_position_x, auth.business.hero_image_position_x ?? 50)},
          hero_image_position_y = ${asNumber(body.hero_image_position_y, auth.business.hero_image_position_y ?? 50)},
          updated_at = now()
        WHERE id = ${businessId}
        RETURNING *
      `) as DbBusiness[])[0];
      await emitRealtime(sql, businessId, "BusinessBrandUpdated", { business_id: businessId });
      return json({ message: "Business profile updated.", business: publicBusiness(updated) });
    }

    if ((path[2] === "logo" || path[2] === "hero-image") && req.method === "POST") {
      const form = await req.formData();
      const file = form.get("logo");
      if (!(file instanceof File)) return error("No image uploaded.", 422);
      const bytes = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${file.type || "image/png"};base64,${bytes.toString("base64")}`;
      const publicId = `neon-${path[2]}-${randomBytes(4).toString("hex")}`;
      const field = path[2] === "logo" ? "logo" : "hero";
      const updated = field === "logo"
        ? ((await sql`UPDATE businesses SET logo_url = ${dataUrl}, logo_public_id = ${publicId}, updated_at = now() WHERE id = ${businessId} RETURNING *`) as DbBusiness[])[0]
        : ((await sql`UPDATE businesses SET hero_image_url = ${dataUrl}, hero_image_public_id = ${publicId}, updated_at = now() WHERE id = ${businessId} RETURNING *`) as DbBusiness[])[0];
      return json({ message: "Image uploaded.", secure_url: dataUrl, public_id: publicId, business: publicBusiness(updated) });
    }
  }

  if (path[1] === "customers" && req.method === "GET") {
    const card = await defaultCard(sql, businessId);
    if (path[2]) {
      const customer = ((await sql`SELECT *, created_at::text, updated_at::text FROM customers WHERE id = ${path[2]} AND business_id = ${businessId} LIMIT 1`) as DbCustomer[])[0];
      if (!customer) return error("Customer not found.", 404);
      const row = await customerRow(sql, customer, card);
      const visitHistory = (await sql`SELECT id, created_at::text AS date FROM visits WHERE customer_id = ${customer.id} ORDER BY created_at DESC`) as Array<{ id: string; date: string }>;
      const rewardHistory = (await sql`
        SELECT r.id, lc.reward_name, r.earned_at::text, r.redeemed_at::text, r.status
        FROM reward_redemptions r JOIN loyalty_cards lc ON lc.id = r.loyalty_card_id
        WHERE r.customer_id = ${customer.id} ORDER BY r.earned_at DESC
      `) as Array<{ id: string; reward_name: string | null; earned_at: string | null; redeemed_at: string | null; status: string }>;
      return json({ customer: { ...row, visit_history: visitHistory, reward_history: rewardHistory } });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const perPage = Math.max(1, Number(url.searchParams.get("per_page") ?? 10));
    const customers = (await sql`SELECT *, created_at::text, updated_at::text FROM customers WHERE business_id = ${businessId} ORDER BY created_at DESC`) as DbCustomer[];
    const rows = await Promise.all(customers.map((c) => customerRow(sql, c, card)));
    const filtered = q
      ? rows.filter((c) => `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q))
      : rows;
    const paged = paginate(filtered, page, perPage);
    return json({
      ...paged,
      summary: {
        total_customers: rows.length,
        active_customers: rows.length,
        rewards_ready: rows.filter((r) => r.reward_status === "ready").length,
      },
      query: { q, page, per_page: perPage },
    });
  }

  if (path[1] === "rewards" && req.method === "GET") {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const status = url.searchParams.get("status");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const perPage = Math.max(1, Number(url.searchParams.get("per_page") ?? 10));
    const rewards = (await sql`
      SELECT r.status, r.earned_at::text, r.redeemed_at::text, lc.reward_name,
             c.id AS customer_id, c.first_name, c.last_name, c.email, c.phone
      FROM reward_redemptions r
      JOIN customers c ON c.id = r.customer_id
      JOIN loyalty_cards lc ON lc.id = r.loyalty_card_id
      WHERE r.business_id = ${businessId}
      ORDER BY r.earned_at DESC
    `) as Array<{ status: "ready" | "redeemed"; earned_at: string | null; redeemed_at: string | null; reward_name: string | null; customer_id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }>;
    const rows = rewards.map((r) => ({
      customer: { id: r.customer_id, first_name: r.first_name ?? "", last_name: r.last_name ?? "", email: r.email, phone: r.phone },
      reward_name: r.reward_name,
      earned_at: r.earned_at,
      redeemed_at: r.redeemed_at,
      status: r.status,
    }));
    const filtered = rows.filter((r) => {
      const hay = `${r.customer?.first_name ?? ""} ${r.customer?.last_name ?? ""} ${r.customer?.email ?? ""} ${r.customer?.phone ?? ""}`.toLowerCase();
      return (!q || hay.includes(q)) && (!status || r.status === status);
    });
    const paged = paginate(filtered, page, perPage);
    return json({
      ...paged,
      summary: {
        total_rewards: rows.length,
        rewards_ready: rows.filter((r) => r.status === "ready").length,
        rewards_redeemed: rows.filter((r) => r.status === "redeemed").length,
      },
      query: { q, page, per_page: perPage, status },
    });
  }

  return null;
}

async function handleLoyaltyCard(req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);
  if (!auth.business) return error("Business not found.", 404);
  const existing = await defaultCard(sql, auth.business.id);

  if (req.method === "GET") return json({ loyalty_card: publicLoyaltyCard(existing) });

  if (req.method === "POST" || req.method === "PUT") {
    const body = await readJson(req);
    const rewardName = asString(body.reward_name, existing.reward_name);
    const requiredStamps = Math.max(1, asNumber(body.required_stamps, existing.required_stamps));
    const rewardDescription = asNullableString(body.reward_description);
    const updated = ((await sql`
      UPDATE loyalty_cards SET reward_name = ${rewardName}, required_stamps = ${requiredStamps}, reward_description = ${rewardDescription}, updated_at = now()
      WHERE id = ${existing.id}
      RETURNING *
    `) as DbLoyaltyCard[])[0];
    await emitRealtime(sql, auth.business.id, "BusinessCardUpdated", { loyalty_card_id: updated.id });
    return json({ message: "Loyalty card saved.", loyalty_card: publicLoyaltyCard(updated) });
  }

  return null;
}

async function handlePublic(path: string[], req: Request, sql: Sql) {
  if (path[1] === "businesses" && path[2] && req.method === "GET") {
    const business = ((await sql`SELECT * FROM businesses WHERE slug = ${path[2]} LIMIT 1`) as DbBusiness[])[0];
    if (!business) return error("Business not found.", 404);
    const card = await defaultCard(sql, business.id);
    return json({ business: publicBusiness(business), loyalty_card: publicLoyaltyCard(card) });
  }

  if (path[1] === "businesses" && path[2] && path[3] === "customers" && path[4] === "register" && req.method === "POST") {
    const business = ((await sql`SELECT * FROM businesses WHERE slug = ${path[2]} LIMIT 1`) as DbBusiness[])[0];
    if (!business) return error("Business not found.", 404);
    const body = await readJson(req);
    const customerId = randomUUID();
    const qr = `cust_${randomBytes(16).toString("hex")}`;
    const customer = ((await sql`
      INSERT INTO customers (id, business_id, first_name, last_name, email, phone, qr_code)
      VALUES (${customerId}, ${business.id}, ${asNullableString(body.first_name)}, ${asNullableString(body.last_name)}, ${asNullableString(body.email)}, ${asNullableString(body.phone)}, ${qr})
      RETURNING *, created_at::text, updated_at::text
    `) as DbCustomer[])[0];
    const card = await defaultCard(sql, business.id);
    await sql`INSERT INTO customer_loyalties (id, customer_id, loyalty_card_id) VALUES (${randomUUID()}, ${customer.id}, ${card.id}) ON CONFLICT DO NOTHING`;
    await emitRealtime(sql, business.id, "MembershipCreated", { customer_id: customer.id });
    return json({ message: "Customer registered.", customer, wallet_url: `/wallet/${qr}` }, { status: 201 });
  }

  if (path[1] === "customers" && path[2] === "wallet" && path[3] && req.method === "GET") {
    const customer = ((await sql`SELECT *, created_at::text, updated_at::text FROM customers WHERE qr_code = ${path[3]} LIMIT 1`) as DbCustomer[])[0];
    if (!customer) return error("Customer not found.", 404);
    const business = ((await sql`SELECT * FROM businesses WHERE id = ${customer.business_id} LIMIT 1`) as DbBusiness[])[0];
    const card = await defaultCard(sql, business.id);
    const loyalty = ((await sql`SELECT *, created_at::text, updated_at::text FROM customer_loyalties WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} LIMIT 1`) as DbLoyalty[])[0];
    return json({ business: publicBusiness(business), customer, loyalty_card: publicLoyaltyCard(card), loyalty });
  }

  return null;
}

async function handleStamp(path: string[], req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);
  if (!auth.business) return error("Business not found.", 404);
  const body = await readJson(req);
  const qr = asString(body.qr_code);
  const customer = ((await sql`SELECT *, created_at::text, updated_at::text FROM customers WHERE qr_code = ${qr} AND business_id = ${auth.business.id} LIMIT 1`) as DbCustomer[])[0];
  if (!customer) return error("Customer QR not found.", 404);
  const card = await defaultCard(sql, auth.business.id);
  const current = ((await sql`
    INSERT INTO customer_loyalties (id, customer_id, loyalty_card_id, current_stamps)
    VALUES (${randomUUID()}, ${customer.id}, ${card.id}, 0)
    ON CONFLICT (customer_id, loyalty_card_id) DO UPDATE SET updated_at = now()
    RETURNING *
  `) as DbLoyalty[])[0];

  if (path[0] === "redeem-reward") {
    await sql`
      UPDATE reward_redemptions SET status = 'redeemed', redeemed_at = now()
      WHERE id = (
        SELECT id FROM reward_redemptions WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} AND status = 'ready' ORDER BY earned_at DESC LIMIT 1
      )
    `;
    await emitRealtime(sql, auth.business.id, "RewardRedeemed", { customer_id: customer.id });
    return json({ message: "Reward redeemed.", reward_redeemed: true, loyalty: { current_stamps: current.current_stamps, required_stamps: card.required_stamps, reward_unlocked: current.current_stamps >= card.required_stamps, reward_redemption_created: false, reward_redeemed: true } });
  }

  await sql`INSERT INTO visits (id, business_id, customer_id) VALUES (${randomUUID()}, ${auth.business.id}, ${customer.id})`;
  const nextStamps = current.current_stamps + 1;
  const updated = ((await sql`UPDATE customer_loyalties SET current_stamps = ${nextStamps}, updated_at = now() WHERE id = ${current.id} RETURNING *`) as DbLoyalty[])[0];
  const unlocked = updated.current_stamps >= card.required_stamps;
  let redemptionCreated = false;
  if (unlocked) {
    const readyCount = ((await sql`SELECT count(*)::int AS count FROM reward_redemptions WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} AND status = 'ready'`) as Array<{ count: number }>)[0]?.count ?? 0;
    if (!readyCount) {
      await sql`INSERT INTO reward_redemptions (id, business_id, customer_id, loyalty_card_id, status) VALUES (${randomUUID()}, ${auth.business.id}, ${customer.id}, ${card.id}, 'ready')`;
      redemptionCreated = true;
    }
  }
  await emitRealtime(sql, auth.business.id, "StampAdded", { customer_id: customer.id, current_stamps: updated.current_stamps, reward_unlocked: unlocked });
  return json({ message: "Stamp added.", loyalty: { current_stamps: updated.current_stamps, required_stamps: card.required_stamps, reward_unlocked: unlocked, reward_redemption_created: redemptionCreated } });
}

async function handleCustomerUser(path: string[], req: Request, sql: Sql) {
  if ((path[1] === "register" || path[1] === "login") && req.method === "POST") {
    const body = await readJson(req);
    const email = asString(body.email).toLowerCase();
    const password = asString(body.password);
    if (path[1] === "register") {
      const first = asString(body.first_name);
      const last = asString(body.last_name);
      if (!first || !last || !email || password.length < 6) return error("Please fill all required fields.", 422);
      const user = ((await sql`
        INSERT INTO app_users (id, name, email, password_hash, role)
        VALUES (${randomUUID()}, ${`${first} ${last}`}, ${email}, ${await hashPassword(password)}, 'customer')
        RETURNING *
      `) as DbUser[])[0];
      await sql`INSERT INTO customer_profiles (user_id, first_name, last_name, phone, avatar_url, preferences) VALUES (${user.id}, ${first}, ${last}, ${asNullableString(body.phone)}, ${asNullableString(body.avatar_url)}, ${JSON.stringify(body.preferences ?? {})}::jsonb)`;
      const token = await createSession(sql, user.id);
      return json({ token, token_type: "Bearer", user: publicUser(user, null, { first_name: first, last_name: last, email, phone: asNullableString(body.phone), avatar_url: asNullableString(body.avatar_url), preferences: body.preferences ?? null }) }, { status: 201 });
    }

    const user = ((await sql`SELECT * FROM app_users WHERE email = ${email} AND role = 'customer' LIMIT 1`) as DbUser[])[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return error("Invalid credentials.", 401);
    const token = await createSession(sql, user.id);
    const profile = ((await sql`SELECT first_name, last_name, phone, avatar_url, preferences, ${email} AS email FROM customer_profiles WHERE user_id = ${user.id}`) as JsonRecord[])[0] ?? null;
    return json({ token, token_type: "Bearer", user: publicUser(user, null, profile) });
  }

  const auth = await requireAuth(req, sql);
  if (auth.user.role !== "customer") return error("Customer account required.", 403);
  const profile = ((await sql`SELECT first_name, last_name, phone, avatar_url, preferences, ${auth.user.email} AS email FROM customer_profiles WHERE user_id = ${auth.user.id}`) as JsonRecord[])[0] ?? null;

  if (path[1] === "logout" && req.method === "POST") {
    const token = bearerToken(req);
    if (token) await sql`DELETE FROM user_sessions WHERE token = ${token}`;
    return json({ message: "Logged out." });
  }
  if (path[1] === "me") return json({ user: publicUser(auth.user, null, profile) });
  if (path[1] === "profile" && req.method === "PUT") return json({ message: "Profile saved.", user: publicUser(auth.user, null, profile) });
  if (path[1] === "password" && req.method === "PUT") return json({ message: "Password updated." });
  if (path[1] === "notifications") return json({ data: [] });

  const memberships = (await sql`SELECT *, created_at::text, updated_at::text FROM customers WHERE user_id = ${auth.user.id} ORDER BY created_at DESC`) as DbCustomer[];
  const cards = await Promise.all(memberships.map(async (m) => {
    const business = ((await sql`SELECT * FROM businesses WHERE id = ${m.business_id} LIMIT 1`) as DbBusiness[])[0];
    const card = await defaultCard(sql, m.business_id);
    const loyalty = ((await sql`SELECT * FROM customer_loyalties WHERE customer_id = ${m.id} AND loyalty_card_id = ${card.id} LIMIT 1`) as DbLoyalty[])[0] ?? null;
    return {
      id: m.id,
      customer_id: m.id,
      business: publicBusiness(business),
      membership: { qr_code: m.qr_code, first_name: m.first_name, last_name: m.last_name },
      loyalty_card: publicLoyaltyCard(card),
      loyalty: loyalty ? { id: loyalty.id, current_stamps: loyalty.current_stamps, required_stamps: card.required_stamps, progress_percent: Math.min(100, Math.round((loyalty.current_stamps / card.required_stamps) * 100)) } : null,
      qr: { qr_code: m.qr_code },
    };
  }));

  if (path[1] === "cards") {
    if (path[2] && req.method === "DELETE") {
      await sql`DELETE FROM customers WHERE id = ${path[2]} AND user_id = ${auth.user.id}`;
      return json({ message: "Card removed." });
    }
    if (path[2]) {
      const found = cards.find((c) => c.id === path[2]);
      return found ? json({ data: found }) : error("Card not found.", 404);
    }
    return json({ data: cards });
  }

  if (path[1] === "businesses") {
    return json({ data: cards.map((c) => ({ business: c.business, membership: c.membership, card: c.loyalty_card, loyalty_status: c.loyalty ?? { current_stamps: 0, progress_percent: 0, required_stamps: 10 } })) });
  }

  if (path[1] === "rewards") return json({ data: { available: [], history: [] } });
  if (path[1] === "activity") return json({ data: { items: [] } });
  if (path[1] === "join-by-qr" && req.method === "POST") return error("Join by QR is not configured for this code yet.", 404);

  return null;
}

export async function GET(req: Request, context: RouteContext) {
  return dispatch(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  return dispatch(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return dispatch(req, context);
}

export async function PUT(req: Request, context: RouteContext) {
  return dispatch(req, context);
}

export async function DELETE(req: Request, context: RouteContext) {
  return dispatch(req, context);
}

async function dispatch(req: Request, context: RouteContext) {
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const params = await context.params;
    const path = params.path ?? [];

    let response: Response | null = null;
    if (path[0] === "auth") response = await handleAuth(path, req, sql);
    else if (path[0] === "realtime" && req.method === "GET") response = await handleRealtime(req, sql);
    else if (path[0] === "dashboard") response = await handleDashboard(path, req, sql);
    else if (path[0] === "business") response = await handleBusiness(path, req, sql);
    else if (path[0] === "loyalty-card") response = await handleLoyaltyCard(req, sql);
    else if (path[0] === "public") response = await handlePublic(path, req, sql);
    else if (path[0] === "stamp" || path[0] === "redeem-reward") response = await handleStamp(path, req, sql);
    else if (path[0] === "user") response = await handleCustomerUser(path, req, sql);

    return response ?? error("API route not found.", 404);
  } catch (caught) {
    if (caught instanceof Response) return caught;
    const message = caught instanceof Error ? caught.message : "Unexpected API error.";
    return error(message, 500);
  }
}
