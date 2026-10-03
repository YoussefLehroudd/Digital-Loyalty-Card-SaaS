import { createSign, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "crypto";
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
  avatar_url: string | null;
  avatar_public_id: string | null;
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
  google_wallet_show_background: boolean;
  primary_color: string;
  phone: string | null;
  address: string | null;
  created_at: string;
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

async function rateLimit(sql: Sql, req: Request, bucket: string, limit: number, windowMs: number) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  const key = `${bucket}:${ip}`;
  const rows = (await sql`
    INSERT INTO api_rate_limits (key, request_count, reset_at)
    VALUES (${key}, 1, now() + (${windowMs} * interval '1 millisecond'))
    ON CONFLICT (key) DO UPDATE SET
      request_count = CASE WHEN api_rate_limits.reset_at <= now() THEN 1 ELSE api_rate_limits.request_count + 1 END,
      reset_at = CASE WHEN api_rate_limits.reset_at <= now() THEN now() + (${windowMs} * interval '1 millisecond') ELSE api_rate_limits.reset_at END
    RETURNING request_count, reset_at
  `) as Array<{ request_count: number; reset_at: string }>;
  const current = rows[0];
  if (current.request_count > limit) {
    const retryAfter = Math.max(1, Math.ceil((new Date(current.reset_at).getTime() - Date.now()) / 1000));
    return json({ message: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  return null;
}

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

async function uploadImageToCloudinary(file: File, folder: string) {
  const cloudName = process.env.CLOUDINARY_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured.");

  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowed.has(file.type)) throw new Error("Unsupported image format.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10 MB or smaller.");

  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = (await import("crypto")).createHash("sha1").update(signaturePayload).digest("hex");
  const form = new FormData();
  form.set("file", file);
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("folder", folder);
  form.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const result = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url || !result.public_id) throw new Error(result.error?.message || "Cloudinary upload failed.");
  return { secureUrl: result.secure_url, publicId: result.public_id };
}

async function deleteCloudinaryImage(publicId: string | null | undefined) {
  if (!publicId || !publicId.startsWith("digital-loyalty-card-saas/")) return;
  const cloudName = process.env.CLOUDINARY_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = (await import("crypto")).createHash("sha1").update(signaturePayload).digest("hex");
  const form = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) console.error("Cloudinary cleanup failed", response.status, await response.text());
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
        google_wallet_show_background boolean NOT NULL DEFAULT true,
        primary_color text DEFAULT '#111827',
        phone text,
        address text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_wallet_show_background boolean NOT NULL DEFAULT true`;

      await sql`CREATE TABLE IF NOT EXISTS app_users (
        id uuid PRIMARY KEY,
        business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
        name text NOT NULL,
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL,
        avatar_url text,
        avatar_public_id text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url text`;
      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_public_id text`;

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
        avatar_public_id text,
        preferences jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )`;

      await sql`ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS avatar_public_id text`;

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
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_business ON customers(user_id, business_id) WHERE user_id IS NOT NULL`;
      await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS api_rate_limits (
        key text PRIMARY KEY,
        request_count integer NOT NULL DEFAULT 0,
        reset_at timestamptz NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_api_rate_limits_reset_at ON api_rate_limits(reset_at)`;
      await sql`CREATE TABLE IF NOT EXISTS notification_reads (
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        reward_redemption_id uuid NOT NULL REFERENCES reward_redemptions(id) ON DELETE CASCADE,
        read_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, reward_redemption_id)
      )`;
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
    google_wallet_show_background: b.google_wallet_show_background ?? true,
    primary_color: b.primary_color,
    phone: b.phone,
    address: b.address,
    created_at: b.created_at,
  };
}

function publicUser(user: DbUser, business: DbBusiness | null, profile?: JsonRecord | null) {
  return {
    id: user.id,
    business_id: user.business_id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url ?? null,
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
    SELECT u.id, u.business_id, u.name, u.email, u.role, u.password_hash, u.avatar_url, u.avatar_public_id
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
  return {
    id: customer.id,
    first_name: customer.first_name ?? "",
    last_name: customer.last_name ?? "",
    email: customer.email,
    phone: customer.phone,
    qr_code: customer.qr_code,
    current_stamps: current,
    required_stamps: required,
    // Status describes the CURRENT loyalty cycle only. Historical redemptions stay in reward_history.
    reward_status: rewardStatus(current, required),
    total_visits: visits.length,
    last_visit: visits[0]?.date ?? null,
    joined_at: customer.created_at,
  };
}

function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function loyvanceEmailTemplate(options: { title: string; preheader: string; greeting: string; message: string; actionLabel?: string; actionUrl?: string; footerNote?: string }) {
  const action = options.actionLabel && options.actionUrl
    ? `<tr><td style="padding:8px 32px 28px"><a href="${options.actionUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">${escapeEmailHtml(options.actionLabel)}</a></td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#111827"><div style="display:none;max-height:0;overflow:hidden">${escapeEmailHtml(options.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden"><tr><td style="background:#111827;padding:24px 32px;color:#fff"><div style="font-size:22px;font-weight:800;letter-spacing:.4px">LOYVANCE</div><div style="font-size:12px;color:#cbd5e1;margin-top:4px">Digital loyalty, made simple.</div></td></tr><tr><td style="padding:32px 32px 10px"><h1 style="margin:0 0 18px;font-size:25px;line-height:1.25">${escapeEmailHtml(options.title)}</h1><p style="margin:0 0 14px;font-size:15px;line-height:1.7">Hi ${escapeEmailHtml(options.greeting)},</p><p style="margin:0;font-size:15px;line-height:1.7;color:#374151">${escapeEmailHtml(options.message)}</p></td></tr>${action}<tr><td style="padding:0 32px 30px"><p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280">${escapeEmailHtml(options.footerNote ?? "This is an automated security message from LOYVANCE.")}</p></td></tr><tr><td style="border-top:1px solid #e5e7eb;padding:18px 32px;font-size:11px;color:#9ca3af">© ${new Date().getFullYear()} LOYVANCE · Please do not reply to this automated email.</td></tr></table></td></tr></table></body></html>`;
}

async function sendLoyvanceEmail(options: { to: string; subject: string; html: string; category?: "security" | "support" | "notifications" }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; email was not sent.");
    return false;
  }
  const domain = process.env.RESEND_DOMAIN || "youssefhrd.com";
  const local = options.category === "support" ? "support" : options.category === "notifications" ? "notifications" : "security";
  const from = local === "security"
    ? `LOYVANCE Security <security@${domain}>`
    : local === "support"
      ? `LOYVANCE Support <support@${domain}>`
      : `LOYVANCE <notifications@${domain}>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      headers: {
        "X-Entity-Ref-ID": randomUUID(),
        "X-Auto-Response-Suppress": "OOF, AutoReply",
      },
      tags: [{ name: "category", value: options.category ?? "notifications" }],
    }),
  });
  if (!response.ok) console.error("LOYVANCE email delivery failed", response.status, await response.text());
  return response.ok;
}

async function handleAuth(path: string[], req: Request, sql: Sql) {
  if (path[1] === "register" && req.method === "POST") {
    const limited = await rateLimit(sql, req, "business-register", 8, 15 * 60 * 1000);
    if (limited) return limited;
    const body = await readJson(req);
    const businessName = asString(body.business_name);
    const businessEmail = asString(body.business_email);
    const name = asString(body.name);
    const email = asString(body.email).toLowerCase();
    const password = asString(body.password);
    const passwordConfirmation = asString(body.password_confirmation);

    if (!businessName || !businessEmail || !name || !email || password.length < 10) {
      return error("Please fill all required fields and use a password of at least 10 characters.", 422);
    }
    if (password !== passwordConfirmation) {
      return error("Password confirmation does not match.", 422, { password_confirmation: ["Password confirmation does not match."] });
    }

    const duplicate = ((await sql`SELECT id FROM app_users WHERE email = ${email} LIMIT 1`) as Array<{ id: string }>)[0];
    if (duplicate) return error("This email is already registered.", 422, { email: ["This email is already registered."] });

    const businessId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    const slug = `${slugify(businessName)}-${randomBytes(2).toString("hex")}`;

    const token = randomBytes(32).toString("hex");
    const cardId = randomUUID();
    const [businessRows, userRows] = await sql.transaction([
      sql`
        INSERT INTO businesses (id, slug, name, email, primary_color)
        VALUES (${businessId}, ${slug}, ${businessName}, ${businessEmail}, '#111827')
        RETURNING *
      `,
      sql`
        INSERT INTO app_users (id, business_id, name, email, password_hash, role)
        VALUES (${userId}, ${businessId}, ${name}, ${email}, ${passwordHash}, 'business_owner')
        RETURNING *
      `,
      sql`
        INSERT INTO loyalty_cards (id, business_id, reward_name, required_stamps, reward_description)
        VALUES (${cardId}, ${businessId}, 'Free Coffee', 10, 'Collect stamps to unlock your reward.')
      `,
      sql`INSERT INTO user_sessions (token, user_id) VALUES (${token}, ${userId})`,
    ]);
    const business = (businessRows as DbBusiness[])[0];
    const user = (userRows as DbUser[])[0];

    return json({ token, token_type: "Bearer", user: publicUser(user, business) }, { status: 201 });
  }

  if (path[1] === "login" && req.method === "POST") {
    const limited = await rateLimit(sql, req, "business-login", 12, 15 * 60 * 1000);
    if (limited) return limited;
    const body = await readJson(req);
    const email = asString(body.email).toLowerCase();
    const password = asString(body.password);
    const rows = (await sql`SELECT * FROM app_users WHERE email = ${email} LIMIT 1`) as DbUser[];
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return error("Invalid credentials.", 401);
    }
    const business = user.role === "business_owner" && user.business_id
      ? (((await sql`SELECT * FROM businesses WHERE id = ${user.business_id} LIMIT 1`) as DbBusiness[])[0] ?? null)
      : null;
    const profile = user.role === "customer"
      ? (((await sql`SELECT first_name, last_name, phone, avatar_url, preferences, ${user.email} AS email FROM customer_profiles WHERE user_id = ${user.id}`) as JsonRecord[])[0] ?? null)
      : null;
    const token = await createSession(sql, user.id);
    return json({ token, token_type: "Bearer", user: publicUser(user, business, profile) });
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

  if (path[1] === "profile" && req.method === "PUT") {
    const auth = await requireAuth(req, sql);
    if (auth.user.role !== "business_owner") return error("Forbidden.", 403);

    const body = await readJson(req);
    const name = asString(body.name).trim();
    const email = asString(body.email).trim().toLowerCase();

    if (name.length < 2 || !email || !email.includes("@")) {
      return error("Enter a valid name and email.", 422, {
        name: name.length < 2 ? ["Enter your name."] : [],
        email: !email || !email.includes("@") ? ["Enter a valid login email."] : [],
      });
    }

    const duplicate = ((await sql`
      SELECT id FROM app_users WHERE email = ${email} AND id <> ${auth.user.id} LIMIT 1
    `) as Array<{ id: string }>)[0];
    if (duplicate) {
      return error("This email is already registered.", 422, {
        email: ["This email is already registered."],
      });
    }

    const updated = ((await sql`
      UPDATE app_users
      SET name = ${name}, email = ${email}, updated_at = now()
      WHERE id = ${auth.user.id}
      RETURNING *
    `) as DbUser[])[0];

    return json({
      message: "Owner profile updated successfully.",
      user: publicUser(updated, auth.business),
    });
  }

  if (path[1] === "password" && req.method === "PUT") {
    const limited = await rateLimit(sql, req, "change-password", 8, 15 * 60 * 1000);
    if (limited) return limited;

    const auth = await requireAuth(req, sql);
    if (auth.user.role !== "business_owner") return error("Forbidden.", 403);

    const body = await readJson(req);
    const currentPassword = asString(body.current_password);
    const password = asString(body.password);
    const confirmation = asString(body.password_confirmation);

    if (!(await verifyPassword(currentPassword, auth.user.password_hash))) {
      return error("Current password is incorrect.", 422, {
        current_password: ["Current password is incorrect."],
      });
    }
    if (password.length < 10) {
      return error("Use a password of at least 10 characters.", 422, {
        password: ["Use at least 10 characters."],
      });
    }
    if (password !== confirmation) {
      return error("Password confirmation does not match.", 422, {
        password_confirmation: ["Password confirmation does not match."],
      });
    }
    if (await verifyPassword(password, auth.user.password_hash)) {
      return error("Choose a password different from your current password.", 422, {
        password: ["Choose a password different from your current password."],
      });
    }

    await sql`
      UPDATE app_users
      SET password_hash = ${await hashPassword(password)}, updated_at = now()
      WHERE id = ${auth.user.id}
    `;

    return json({ message: "Password updated successfully." });
  }

  if (path[1] === "avatar" && req.method === "POST") {
    const auth = await requireAuth(req, sql);
    if (auth.user.role !== "business_owner") return error("Forbidden.", 403);

    const form = await req.formData();
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      return error("Choose a profile image.", 422, { avatar: ["Choose a profile image."] });
    }

    try {
      const uploaded = await uploadImageToCloudinary(file, "digital-loyalty-card-saas/owner-avatars");
      const previousPublicId = auth.user.avatar_public_id;
      const updated = ((await sql`
        UPDATE app_users
        SET avatar_url = ${uploaded.secureUrl}, avatar_public_id = ${uploaded.publicId}, updated_at = now()
        WHERE id = ${auth.user.id}
        RETURNING *
      `) as DbUser[])[0];

      if (previousPublicId && previousPublicId !== uploaded.publicId) {
        await deleteCloudinaryImage(previousPublicId);
      }

      return json({
        message: "Profile photo updated.",
        secure_url: uploaded.secureUrl,
        public_id: uploaded.publicId,
        user: publicUser(updated, auth.business),
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Profile photo upload failed.";
      return error(message, 422, { avatar: [message] });
    }
  }

  if (path[1] === "avatar" && req.method === "DELETE") {
    const auth = await requireAuth(req, sql);
    if (auth.user.role !== "business_owner") return error("Forbidden.", 403);

    const previousPublicId = auth.user.avatar_public_id;
    const updated = ((await sql`
      UPDATE app_users
      SET avatar_url = NULL, avatar_public_id = NULL, updated_at = now()
      WHERE id = ${auth.user.id}
      RETURNING *
    `) as DbUser[])[0];

    if (previousPublicId) await deleteCloudinaryImage(previousPublicId);

    return json({
      message: "Profile photo removed.",
      user: publicUser(updated, auth.business),
    });
  }

  if (path[1] === "forgot-password" && req.method === "POST") {
    const limited = await rateLimit(sql, req, "forgot-password", 5, 15 * 60 * 1000);
    if (limited) return limited;
    const body = await readJson(req);
    const email = asString(body.email).toLowerCase();
    const user = ((await sql`SELECT * FROM app_users WHERE email = ${email} AND role = 'business_owner' LIMIT 1`) as DbUser[])[0];
    if (!user) return json({ message: "If that email exists, a password reset email has been sent." });
    const token = randomBytes(32).toString("hex");
    const tokenHash = (await import("crypto")).createHash("sha256").update(token).digest("hex");
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;
    await sql`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${user.id}, now() + interval '30 minutes')`;
    const origin = new URL(req.url).origin;
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    await sendLoyvanceEmail({
      to: email,
      subject: "Reset your LOYVANCE password",
      category: "security",
      html: loyvanceEmailTemplate({
        title: "Reset your password",
        preheader: "Your secure LOYVANCE password reset link.",
        greeting: user.name,
        message: "We received a request to reset your LOYVANCE password. Use the secure button below within 30 minutes.",
        actionLabel: "Reset password",
        actionUrl: resetUrl,
        footerNote: "If you did not request a password reset, you can safely ignore this email. Your password will not change.",
      }),
    });
    return json({ message: "If that email exists, a password reset email has been sent." });
  }

  if (path[1] === "reset-password" && req.method === "POST") {
    const limited = await rateLimit(sql, req, "reset-password", 8, 15 * 60 * 1000);
    if (limited) return limited;
    const body = await readJson(req);
    const email = asString(body.email).toLowerCase();
    const token = asString(body.token);
    const password = asString(body.password);
    if (password.length < 10 || password !== asString(body.password_confirmation)) return error("Invalid password or confirmation.", 422);
    const tokenHash = (await import("crypto")).createHash("sha256").update(token).digest("hex");
    const rows = (await sql`
      SELECT u.* FROM password_reset_tokens p JOIN app_users u ON u.id = p.user_id
      WHERE p.token_hash = ${tokenHash} AND p.expires_at > now() AND u.email = ${email} AND u.role = 'business_owner' LIMIT 1
    `) as DbUser[];
    const user = rows[0];
    if (!user) return error("This reset link is invalid or expired.", 422);
    await sql`UPDATE app_users SET password_hash = ${await hashPassword(password)}, updated_at = now() WHERE id = ${user.id}`;
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;
    await sql`DELETE FROM user_sessions WHERE user_id = ${user.id}`;
    return json({ message: "Password reset successfully." });
  }

  return null;
}

async function handleRealtimeVersion(req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);

  if (auth.user.role === "customer") {
    const userId = auth.user.id;
    const rows = (await sql`
      SELECT
        GREATEST(
          COALESCE((SELECT max(c.updated_at) FROM customers c WHERE c.user_id = ${userId}), 'epoch'::timestamptz),
          COALESCE((SELECT max(cl.updated_at) FROM customer_loyalties cl JOIN customers c ON c.id = cl.customer_id WHERE c.user_id = ${userId}), 'epoch'::timestamptz),
          COALESCE((SELECT max(v.created_at) FROM visits v JOIN customers c ON c.id = v.customer_id WHERE c.user_id = ${userId}), 'epoch'::timestamptz),
          COALESCE((SELECT max(COALESCE(r.redeemed_at, r.earned_at)) FROM reward_redemptions r JOIN customers c ON c.id = r.customer_id WHERE c.user_id = ${userId}), 'epoch'::timestamptz)
        ) AS changed_at,
        (SELECT count(*)::int FROM customers WHERE user_id = ${userId}) AS cards_count,
        (SELECT count(*)::int FROM visits v JOIN customers c ON c.id = v.customer_id WHERE c.user_id = ${userId}) AS visits_count,
        (SELECT count(*)::int FROM reward_redemptions r JOIN customers c ON c.id = r.customer_id WHERE c.user_id = ${userId}) AS rewards_count
    `) as Array<{ changed_at: string; cards_count: number; visits_count: number; rewards_count: number }>;
    return json({ version: rows[0] });
  }

  if (!auth.business) return error("Business not found.", 404);
  const businessId = auth.business.id;
  const rows = (await sql`
    SELECT
      GREATEST(
        COALESCE((SELECT max(updated_at) FROM businesses WHERE id = ${businessId}), 'epoch'::timestamptz),
        COALESCE((SELECT max(updated_at) FROM loyalty_cards WHERE business_id = ${businessId}), 'epoch'::timestamptz),
        COALESCE((SELECT max(updated_at) FROM customers WHERE business_id = ${businessId}), 'epoch'::timestamptz),
        COALESCE((SELECT max(cl.updated_at) FROM customer_loyalties cl JOIN customers c ON c.id = cl.customer_id WHERE c.business_id = ${businessId}), 'epoch'::timestamptz),
        COALESCE((SELECT max(created_at) FROM visits WHERE business_id = ${businessId}), 'epoch'::timestamptz),
        COALESCE((SELECT max(COALESCE(redeemed_at, earned_at)) FROM reward_redemptions WHERE business_id = ${businessId}), 'epoch'::timestamptz)
      ) AS changed_at,
      (SELECT count(*)::int FROM customers WHERE business_id = ${businessId}) AS customers_count,
      (SELECT count(*)::int FROM visits WHERE business_id = ${businessId}) AS visits_count,
      (SELECT count(*)::int FROM reward_redemptions WHERE business_id = ${businessId}) AS rewards_count
  `) as Array<{ changed_at: string; customers_count: number; visits_count: number; rewards_count: number }>;
  return json({ version: rows[0] });
}

async function handleDashboard(path: string[], req: Request, sql: Sql) {
  const auth = await requireAuth(req, sql);
  if (!auth.business) return error("Business not found.", 404);

  if (path[1] === "session") {
    return json({ message: "OK", user: publicUser(auth.user, auth.business) });
  }

  const businessId = auth.business.id;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "current_month";
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;
  if (period === "previous_month") {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else if (period === "last_30_days") {
    periodEnd = now;
    periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    periodEnd = now;
  }
  const durationMs = Math.max(1, periodEnd.getTime() - periodStart.getTime());
  const previousStart = new Date(periodStart.getTime() - durationMs);
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  const previousStartIso = previousStart.toISOString();

  const counts = (await sql`
    SELECT
      (SELECT count(*)::int FROM customers WHERE business_id = ${businessId} AND created_at >= ${startIso}::timestamptz AND created_at < ${endIso}::timestamptz) AS customers,
      (SELECT count(DISTINCT customer_id)::int FROM visits WHERE business_id = ${businessId} AND created_at >= ${startIso}::timestamptz AND created_at < ${endIso}::timestamptz) AS active,
      (SELECT count(*)::int FROM visits WHERE business_id = ${businessId} AND created_at >= ${startIso}::timestamptz AND created_at < ${endIso}::timestamptz) AS visits,
      (SELECT count(*)::int FROM reward_redemptions WHERE business_id = ${businessId} AND status = 'redeemed' AND redeemed_at >= ${startIso}::timestamptz AND redeemed_at < ${endIso}::timestamptz) AS rewards,
      (SELECT count(*)::int FROM customers WHERE business_id = ${businessId} AND created_at >= ${previousStartIso}::timestamptz AND created_at < ${startIso}::timestamptz) AS prev_customers,
      (SELECT count(DISTINCT customer_id)::int FROM visits WHERE business_id = ${businessId} AND created_at >= ${previousStartIso}::timestamptz AND created_at < ${startIso}::timestamptz) AS prev_active,
      (SELECT count(*)::int FROM visits WHERE business_id = ${businessId} AND created_at >= ${previousStartIso}::timestamptz AND created_at < ${startIso}::timestamptz) AS prev_visits,
      (SELECT count(*)::int FROM reward_redemptions WHERE business_id = ${businessId} AND status = 'redeemed' AND redeemed_at >= ${previousStartIso}::timestamptz AND redeemed_at < ${startIso}::timestamptz) AS prev_rewards
  `) as Array<{ customers:number; active:number; visits:number; rewards:number; prev_customers:number; prev_active:number; prev_visits:number; prev_rewards:number }>;
  const row = counts[0] ?? { customers:0, active:0, visits:0, rewards:0, prev_customers:0, prev_active:0, prev_visits:0, prev_rewards:0 };
  const percentChange = (current: number, previous: number) => previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  const recentCustomers = (await sql`
    SELECT c.id, trim(concat(coalesce(c.first_name,''), ' ', coalesce(c.last_name,''))) AS name, c.email,
      COALESCE(
        (SELECT json_build_object('type','reward','date',r.redeemed_at) FROM reward_redemptions r WHERE r.business_id=${businessId} AND r.customer_id=c.id AND r.status='redeemed' ORDER BY r.redeemed_at DESC NULLS LAST LIMIT 1),
        (SELECT json_build_object('type','stamp','date',v.created_at) FROM visits v WHERE v.business_id=${businessId} AND v.customer_id=c.id ORDER BY v.created_at DESC LIMIT 1),
        json_build_object('type','joined','date',c.created_at)
      ) AS activity
    FROM customers c WHERE c.business_id=${businessId}
    ORDER BY GREATEST(c.created_at,
      COALESCE((SELECT max(v.created_at) FROM visits v WHERE v.business_id=${businessId} AND v.customer_id=c.id), c.created_at),
      COALESCE((SELECT max(r.redeemed_at) FROM reward_redemptions r WHERE r.business_id=${businessId} AND r.customer_id=c.id AND r.status='redeemed'), c.created_at)
    ) DESC LIMIT 5
  `) as Array<{id:string;name:string;email:string|null;activity:{type:string;date:string}}>;
  const activityRows = (await sql`
    WITH days AS (
      SELECT generate_series(date_trunc('day', ${startIso}::timestamptz), date_trunc('day', ${endIso}::timestamptz), interval '1 day') AS day
    )
    SELECT d.day::date::text AS date,
      (SELECT count(*)::int FROM customers c WHERE c.business_id=${businessId} AND c.created_at >= d.day AND c.created_at < d.day + interval '1 day') AS new_customers,
      (SELECT count(*)::int FROM visits v WHERE v.business_id=${businessId} AND v.created_at >= d.day AND v.created_at < d.day + interval '1 day') AS stamps_issued,
      (SELECT count(*)::int FROM reward_redemptions r WHERE r.business_id=${businessId} AND r.status='redeemed' AND r.redeemed_at >= d.day AND r.redeemed_at < d.day + interval '1 day') AS rewards_redeemed
    FROM days d ORDER BY d.day
  `) as Array<{date:string;new_customers:number;stamps_issued:number;rewards_redeemed:number}>;
  return json({
    business: publicBusiness(auth.business),
    metrics: {
      total_customers: row.customers,
      active_customers: row.active,
      visits_this_month: row.visits,
      rewards_redeemed: row.rewards,
      growth: {
        total_customers: percentChange(row.customers, row.prev_customers),
        active_customers: percentChange(row.active, row.prev_active),
        visits_this_month: percentChange(row.visits, row.prev_visits),
        rewards_redeemed: percentChange(row.rewards, row.prev_rewards),
      },
    },
    period: { key: period, start: startIso, end: endIso },
    activity: activityRows,
    recent_customers: recentCustomers,
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
          google_wallet_show_background = ${typeof body.google_wallet_show_background === "boolean" ? body.google_wallet_show_background : auth.business.google_wallet_show_background},
          updated_at = now()
        WHERE id = ${businessId}
        RETURNING *
      `) as DbBusiness[])[0];
      await syncGoogleWalletBusiness(sql, businessId);
      return json({ message: "Business profile updated.", business: publicBusiness(updated) });
    }

    if ((path[2] === "logo" || path[2] === "hero-image") && req.method === "POST") {
      const form = await req.formData();
      const file = form.get("logo");
      if (!(file instanceof File)) return error("No image uploaded.", 422);
      let uploaded: { secureUrl: string; publicId: string };
      try {
        uploaded = await uploadImageToCloudinary(file, `digital-loyalty-card-saas/${businessId}`);
      } catch (uploadError) {
        return error(uploadError instanceof Error ? uploadError.message : "Image upload failed.", 422);
      }
      const field = path[2] === "logo" ? "logo" : "hero";
      const previousPublicId = field === "logo" ? auth.business.logo_public_id : auth.business.hero_image_public_id;
      const updated = field === "logo"
        ? ((await sql`UPDATE businesses SET logo_url = ${uploaded.secureUrl}, logo_public_id = ${uploaded.publicId}, updated_at = now() WHERE id = ${businessId} RETURNING *`) as DbBusiness[])[0]
        : ((await sql`UPDATE businesses SET hero_image_url = ${uploaded.secureUrl}, hero_image_public_id = ${uploaded.publicId}, updated_at = now() WHERE id = ${businessId} RETURNING *`) as DbBusiness[])[0];
      if (previousPublicId && previousPublicId !== uploaded.publicId) {
        await deleteCloudinaryImage(previousPublicId);
      }
      await syncGoogleWalletBusiness(sql, businessId);
      return json({ message: "Image uploaded.", secure_url: uploaded.secureUrl, public_id: uploaded.publicId, business: publicBusiness(updated) });
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
    const customers = (await sql`SELECT c.*, c.created_at::text AS created_at, c.updated_at::text AS updated_at FROM customers c WHERE c.business_id = ${businessId} ORDER BY c.created_at DESC`) as DbCustomer[];
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
    await syncGoogleWalletBusiness(sql, auth.business.id);
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
  const customer = ((await sql`SELECT c.*, c.created_at::text AS created_at, c.updated_at::text AS updated_at FROM customers c WHERE c.qr_code = ${qr} AND c.business_id = ${auth.business.id} LIMIT 1`) as DbCustomer[])[0];
  if (!customer) {
    const otherCustomer = ((await sql`SELECT id, business_id FROM customers WHERE qr_code = ${qr} LIMIT 1`) as Array<{ id: string; business_id: string }>)[0];
    if (otherCustomer) {
      return error("This customer card belongs to another business. Please scan a customer card issued by your business.", 422);
    }

    let scannedBusiness: DbBusiness | undefined;
    try {
      const parsed = new URL(qr);
      const joinSlug = parsed.searchParams.get("join")?.trim();
      const joinBusinessId = parsed.searchParams.get("join_business_id")?.trim();
      if (joinSlug) scannedBusiness = ((await sql`SELECT * FROM businesses WHERE slug = ${joinSlug} LIMIT 1`) as DbBusiness[])[0];
      if (!scannedBusiness && joinBusinessId) scannedBusiness = ((await sql`SELECT * FROM businesses WHERE id = ${joinBusinessId} LIMIT 1`) as DbBusiness[])[0];
    } catch {
      // Not a URL; continue with the generic invalid-QR response.
    }

    if (scannedBusiness) {
      return error("This is a business QR code. Please scan the customer's loyalty card QR instead.", 422);
    }
    return error("Invalid QR code. Please scan a valid customer loyalty card.", 422);
  }
  const card = await defaultCard(sql, auth.business.id);
  const current = ((await sql`
    INSERT INTO customer_loyalties (id, customer_id, loyalty_card_id, current_stamps)
    VALUES (${randomUUID()}, ${customer.id}, ${card.id}, 0)
    ON CONFLICT (customer_id, loyalty_card_id) DO UPDATE SET updated_at = now()
    RETURNING *
  `) as DbLoyalty[])[0];

  if (path[0] === "redeem-reward") {
    const redeemed = (await sql`
      WITH selected AS (
        SELECT id FROM reward_redemptions
        WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} AND status = 'ready'
        ORDER BY earned_at DESC LIMIT 1
      ),
      redeemed AS (
        UPDATE reward_redemptions SET status = 'redeemed', redeemed_at = now()
        WHERE id = (SELECT id FROM selected)
        RETURNING id
      ),
      loyalty_update AS (
        UPDATE customer_loyalties
        SET current_stamps = GREATEST(0, current_stamps - ${card.required_stamps}), updated_at = now()
        WHERE id = ${current.id} AND EXISTS (SELECT 1 FROM redeemed)
        RETURNING current_stamps
      )
      SELECT r.id, l.current_stamps FROM redeemed r CROSS JOIN loyalty_update l
    `) as Array<{ id: string; current_stamps: number }>;
    if (!redeemed[0]) return error("No reward is ready to redeem.", 409);
    const remaining = redeemed[0].current_stamps;
    await syncGoogleWalletCustomer(sql, customer.id);
    return json({ message: "Reward redeemed.", reward_redeemed: true, loyalty: { current_stamps: remaining, required_stamps: card.required_stamps, reward_unlocked: remaining >= card.required_stamps, reward_redemption_created: false, reward_redeemed: true } });
  }

  const stampRows = (await sql`
    WITH visit_insert AS (
      INSERT INTO visits (id, business_id, customer_id)
      VALUES (${randomUUID()}, ${auth.business.id}, ${customer.id})
      RETURNING id
    ),
    loyalty_update AS (
      UPDATE customer_loyalties
      SET current_stamps = current_stamps + 1, updated_at = now()
      WHERE id = ${current.id} AND EXISTS (SELECT 1 FROM visit_insert)
      RETURNING *
    ),
    reward_insert AS (
      INSERT INTO reward_redemptions (id, business_id, customer_id, loyalty_card_id, status)
      SELECT ${randomUUID()}, ${auth.business.id}, ${customer.id}, ${card.id}, 'ready'
      FROM loyalty_update lu
      WHERE lu.current_stamps >= ${card.required_stamps}
        AND NOT EXISTS (
          SELECT 1 FROM reward_redemptions
          WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} AND status = 'ready'
        )
      RETURNING id
    )
    SELECT lu.*, EXISTS (SELECT 1 FROM reward_insert) AS redemption_created
    FROM loyalty_update lu
  `) as Array<DbLoyalty & { redemption_created: boolean }>;
  const updated = stampRows[0];
  if (!updated) throw new Error("Could not add stamp.");
  const unlocked = updated.current_stamps >= card.required_stamps;
  const redemptionCreated = updated.redemption_created;
  await syncGoogleWalletCustomer(sql, customer.id);
  return json({ message: "Stamp added.", loyalty: { current_stamps: updated.current_stamps, required_stamps: card.required_stamps, reward_unlocked: unlocked, reward_redemption_created: redemptionCreated } });
}

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function signGoogleWalletJwt(payload: JsonRecord, clientEmail: string, privateKey: string) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey.replace(/\\n/g, "\n"), "base64url");
  return `${unsigned}.${signature}`;
}

function walletSafeId(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}


const googleWalletDesignVersion = "v2";

function googleWalletIds(issuerId: string, businessId: string, customerId: string) {
  return {
    classId: `${issuerId}.business_${walletSafeId(businessId)}_${googleWalletDesignVersion}`,
    objectId: `${issuerId}.member_${walletSafeId(customerId)}_${googleWalletDesignVersion}`,
  };
}

async function googleWalletAccessToken() {
  const clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signGoogleWalletJwt({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }, clientEmail, privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    console.error("Google Wallet OAuth failed", response.status, await response.text());
    return null;
  }
  const data = await response.json() as { access_token?: string };
  return data.access_token || null;
}

async function patchGoogleWallet(resource: "loyaltyClass" | "loyaltyObject", id: string, body: JsonRecord, accessToken: string) {
  const response = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/${resource}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const details = await response.text();
    console.error("Google Wallet sync failed", resource, id, response.status, details);
  }
  return response.status;
}

async function upsertGoogleWallet(resource: "loyaltyClass" | "loyaltyObject", id: string, body: JsonRecord, accessToken: string) {
  const getResponse = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/${resource}/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (getResponse.ok) {
    const status = await patchGoogleWallet(resource, id, body, accessToken);
    if (status < 200 || status >= 300) throw new Error(`Google Wallet ${resource} update failed (${status}).`);
    return;
  }

  if (getResponse.status !== 404) {
    const details = await getResponse.text();
    console.error("Google Wallet lookup failed", resource, id, getResponse.status, details);
    throw new Error(`Google Wallet ${resource} lookup failed (${getResponse.status}).`);
  }

  const createResponse = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/${resource}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!createResponse.ok && createResponse.status !== 409) {
    const details = await createResponse.text();
    console.error("Google Wallet create failed", resource, id, createResponse.status, details);
    throw new Error(`Google Wallet ${resource} create failed (${createResponse.status}).`);
  }
}


function googleWalletStampStrip(current: number, required: number) {
  const total = Math.max(1, Math.min(required, 20));
  const filled = Math.max(0, Math.min(current, total));
  return Array.from({ length: total }, (_, i) => (i < filled ? "●" : "○")).join(" ");
}

async function syncGoogleWalletCustomer(sql: Sql, customerId: string) {
  try {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
    if (!issuerId) return;
    const accessToken = await googleWalletAccessToken();
    if (!accessToken) return;

    const customer = ((await sql`SELECT * FROM customers WHERE id = ${customerId} LIMIT 1`) as DbCustomer[])[0];
    if (!customer) return;
    const business = ((await sql`SELECT * FROM businesses WHERE id = ${customer.business_id} LIMIT 1`) as DbBusiness[])[0];
    if (!business) return;
    const card = await defaultCard(sql, business.id);
    const loyalty = ((await sql`SELECT * FROM customer_loyalties WHERE customer_id = ${customer.id} AND loyalty_card_id = ${card.id} LIMIT 1`) as DbLoyalty[])[0];
    const logoUrl = business.logo_url || business.hero_image_url;
    if (!logoUrl) return;

    const { classId, objectId } = googleWalletIds(issuerId, business.id, customer.id);
    const current = loyalty?.current_stamps ?? 0;
    const required = card.required_stamps;
    const remaining = Math.max(0, required - current);
    const ready = current >= required;
    const memberName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Member";

    await Promise.all([
      patchGoogleWallet("loyaltyClass", classId, {
        notifyPreference: "notifyOnUpdate",
        programName: business.name,
        programLogo: {
          sourceUri: { uri: logoUrl },
          contentDescription: { defaultValue: { language: "en-US", value: `${business.name} logo` } },
        },
        heroImage: business.google_wallet_show_background && business.hero_image_url
          ? {
              sourceUri: { uri: business.hero_image_url },
              contentDescription: { defaultValue: { language: "en-US", value: `${business.name} card background` } },
            }
          : null,
        hexBackgroundColor: business.primary_color || "#111827",
        classTemplateInfo: {
          cardTemplateOverride: {
            cardRowTemplateInfos: [
              {
                twoItems: {
                  startItem: {
                    firstValue: { fields: [{ fieldPath: "object.loyaltyPoints" }] },
                  },
                  endItem: {
                    firstValue: { fields: [{ fieldPath: "object.secondaryLoyaltyPoints" }] },
                  },
                },
              },
              {
                oneItem: {
                  item: {
                    firstValue: { fields: [{ fieldPath: "object.textModulesData['stamps']" }] },
                  },
                },
              },
            ],
          },
          cardBarcodeSectionDetails: {
            firstTopDetail: {
              fieldSelector: { fields: [{ fieldPath: "object.accountName" }] },
            },
          },
          detailsTemplateOverride: {
            detailsItemInfos: [
              { item: { firstValue: { fields: [{ fieldPath: "object.textModulesData['reward']" }] } } },
              { item: { firstValue: { fields: [{ fieldPath: "object.textModulesData['progress']" }] } } },
              { item: { firstValue: { fields: [{ fieldPath: "object.accountId" }] } } },
            ],
          },
        },
        reviewStatus: "UNDER_REVIEW",
      }, accessToken),
      patchGoogleWallet("loyaltyObject", objectId, {
        // Google Wallet uses this transient flag to immediately notify/refresh
        // supported loyalty balance changes on saved passes.
        notifyPreference: "notifyOnUpdate",
        accountName: memberName,
        barcode: {
          type: "QR_CODE",
          value: customer.qr_code || customer.id,
          alternateText: business.name,
        },
        loyaltyPoints: { label: "Stamps", balance: { string: `${current} / ${required}` } },
        secondaryLoyaltyPoints: {
          label: ready ? "Reward" : "Remaining",
          balance: { string: ready ? "READY" : String(remaining) },
        },
        appLinkData: {
          webAppLinkInfo: {
            appTarget: { targetUri: { uri: "https://digital-loyalty-card-saa-s.vercel.app/dashboard/" } },
          },
          displayText: { defaultValue: { language: "en-US", value: "Open loyalty card" } },
        },
        linksModuleData: {
          uris: [{ id: "loyvance", uri: "https://digital-loyalty-card-saa-s.vercel.app/dashboard/", description: "Open in LOYVANCE" }],
        },
        textModulesData: [
          {
            id: "stamps",
            header: "Stamp card",
            body: googleWalletStampStrip(current, required),
          },
          {
            id: "reward",
            header: ready ? "Reward ready" : card.reward_name,
            body: ready
              ? `You unlocked ${card.reward_name}. Show this card at ${business.name} to redeem it.`
              : card.reward_description || `Collect ${required} stamps to unlock ${card.reward_name}.`,
          },
          {
            id: "progress",
            header: "Your progress",
            body: ready
              ? `${current} of ${required} stamps collected. Your reward is ready.`
              : `${current} of ${required} stamps collected · ${remaining} to go.`,
          },
        ],
      }, accessToken),
    ]);
  } catch (caught) {
    console.error("Google Wallet customer sync failed", caught);
  }
}

async function syncGoogleWalletBusiness(sql: Sql, businessId: string) {
  const customers = (await sql`SELECT id FROM customers WHERE business_id = ${businessId}`) as Array<{ id: string }>;
  await Promise.all(customers.map((customer) => syncGoogleWalletCustomer(sql, customer.id)));
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
      const duplicate = ((await sql`SELECT id FROM app_users WHERE email = ${email} LIMIT 1`) as Array<{ id: string }>)[0];
      if (duplicate) return error("This email is already registered.", 422, { email: ["This email is already registered."] });
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
  if (path[1] === "profile" && path[2] === "avatar" && req.method === "POST") {
    const form = await req.formData();
    const file = form.get("avatar");
    if (!(file instanceof File)) return error("No image uploaded.", 422);
    let uploaded: { secureUrl: string; publicId: string };
    try {
      uploaded = await uploadImageToCloudinary(file, `digital-loyalty-card-saas/customers/${auth.user.id}`);
    } catch (uploadError) {
      return error(uploadError instanceof Error ? uploadError.message : "Image upload failed.", 422);
    }
    const current = ((await sql`SELECT avatar_public_id FROM customer_profiles WHERE user_id = ${auth.user.id} LIMIT 1`) as Array<{ avatar_public_id: string | null }>)[0];
    const updatedProfile = ((await sql`
      UPDATE customer_profiles SET avatar_url = ${uploaded.secureUrl}, avatar_public_id = ${uploaded.publicId}, updated_at = now()
      WHERE user_id = ${auth.user.id}
      RETURNING first_name, last_name, phone, avatar_url, preferences, ${auth.user.email} AS email
    `) as JsonRecord[])[0];
    if (current?.avatar_public_id && current.avatar_public_id !== uploaded.publicId) await deleteCloudinaryImage(current.avatar_public_id);
    return json({ message: "Profile photo uploaded.", secure_url: uploaded.secureUrl, user: publicUser(auth.user, null, updatedProfile) });
  }
  if (path[1] === "profile" && req.method === "PUT") {
    const body = await readJson(req);
    const first = asString(body.first_name);
    const last = asString(body.last_name);
    const email = asString(body.email, auth.user.email).toLowerCase();
    if (!first || !last || !email) return error("First name, last name and email are required.", 422);
    const duplicate = ((await sql`SELECT id FROM app_users WHERE email = ${email} AND id <> ${auth.user.id} LIMIT 1`) as Array<{id:string}>)[0];
    if (duplicate) return error("This email is already in use.", 422);
    await sql`UPDATE app_users SET name = ${`${first} ${last}`}, email = ${email}, updated_at = now() WHERE id = ${auth.user.id}`;
    const updatedProfile = ((await sql`
      UPDATE customer_profiles SET first_name = ${first}, last_name = ${last}, phone = ${asNullableString(body.phone)},
        avatar_url = ${asNullableString(body.avatar_url)}, preferences = ${JSON.stringify(body.preferences ?? {})}::jsonb, updated_at = now()
      WHERE user_id = ${auth.user.id}
      RETURNING first_name, last_name, phone, avatar_url, preferences, ${email} AS email
    `) as JsonRecord[])[0];
    await sql`
      UPDATE customers
      SET first_name = ${first}, last_name = ${last}, email = ${email}, updated_at = now()
      WHERE user_id = ${auth.user.id}
    `;
    const membershipsToSync = (await sql`SELECT id FROM customers WHERE user_id = ${auth.user.id}`) as Array<{ id: string }>;
    await Promise.all(membershipsToSync.map((membership) => syncGoogleWalletCustomer(sql, membership.id)));
    const updatedUser = { ...auth.user, name: `${first} ${last}`, email };
    return json({ message: "Profile saved.", user: publicUser(updatedUser, null, updatedProfile) });
  }
  if (path[1] === "password" && req.method === "PUT") {
    const body = await readJson(req);
    const oldPassword = asString(body.old_password);
    const newPassword = asString(body.new_password);
    if (!(await verifyPassword(oldPassword, auth.user.password_hash))) return error("Current password is incorrect.", 422);
    if (newPassword.length < 10 || newPassword !== asString(body.new_password_confirmation)) return error("New password is invalid or confirmation does not match.", 422);
    await sql`UPDATE app_users SET password_hash = ${await hashPassword(newPassword)}, updated_at = now() WHERE id = ${auth.user.id}`;
    return json({ message: "Password updated." });
  }
  if (path[1] === "notifications") {
    if (req.method === "POST") {
      const body = await readJson(req);
      const notificationId = asString(body.notification_id);
      if (notificationId) {
        await sql`
          INSERT INTO notification_reads (user_id, reward_redemption_id)
          SELECT ${auth.user.id}, r.id
          FROM reward_redemptions r JOIN customers c ON c.id = r.customer_id
          WHERE r.id = ${notificationId} AND c.user_id = ${auth.user.id}
          ON CONFLICT DO NOTHING
        `;
      } else {
        await sql`
          INSERT INTO notification_reads (user_id, reward_redemption_id)
          SELECT ${auth.user.id}, r.id
          FROM reward_redemptions r JOIN customers c ON c.id = r.customer_id
          WHERE c.user_id = ${auth.user.id}
          ON CONFLICT DO NOTHING
        `;
      }
      return json({ message: notificationId ? "Notification marked as read." : "Notifications marked as read." });
    }
    const rewards = (await sql`
      SELECT r.id, r.status, b.name AS business_name, COALESCE(r.redeemed_at, r.earned_at)::text AS created_at,
             (nr.reward_redemption_id IS NOT NULL) AS read
      FROM reward_redemptions r
      JOIN customers c ON c.id = r.customer_id
      JOIN businesses b ON b.id = r.business_id
      LEFT JOIN notification_reads nr ON nr.reward_redemption_id = r.id AND nr.user_id = ${auth.user.id}
      WHERE c.user_id = ${auth.user.id}
      ORDER BY COALESCE(r.redeemed_at, r.earned_at) DESC LIMIT 50
    `) as Array<{ id: string; status: string; business_name: string; created_at: string; read: boolean }>;
    return json({ data: rewards.map((r) => ({
      id: r.id,
      type: r.status === "redeemed" ? "reward_redeemed" : "reward_ready",
      title: r.status === "redeemed" ? "Reward redeemed" : "Reward ready",
      message: r.status === "redeemed" ? `Your reward at ${r.business_name} was redeemed.` : `You unlocked a reward at ${r.business_name}.`,
      created_at: r.created_at,
      read: r.read,
    })) });
  }

  const memberships = (await sql`SELECT c.*, c.created_at::text AS created_at, c.updated_at::text AS updated_at FROM customers c WHERE c.user_id = ${auth.user.id} ORDER BY c.created_at DESC`) as DbCustomer[];
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

  if (path[1] === "wallet" && path[2] === "google" && path[3] && req.method === "POST") {
    const selected = cards.find((c) => c.id === path[3]);
    if (!selected) return error("Card not found.", 404);

    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
    const clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL?.trim();
    const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY;
    if (!issuerId || !clientEmail || !privateKey) return error("Google Wallet is not configured.", 503);

    const logoUrl = selected.business.logo_url || selected.business.hero_image_url;
    if (!logoUrl) return error("This business needs a logo before its card can be added to Google Wallet.", 422);

    // Version the pass IDs when the Wallet layout changes. Google keeps fields from
    // previously created classes/objects, so a new version guarantees the compact
    // pass does not inherit the old hero image.
    const { classId, objectId } = googleWalletIds(issuerId, selected.business.id, selected.id);
    const memberName = `${selected.membership.first_name ?? ""} ${selected.membership.last_name ?? ""}`.trim() || auth.user.name;
    const qrValue = selected.qr.qr_code || selected.membership.qr_code || selected.id;
    const currentStamps = selected.loyalty?.current_stamps ?? 0;
    const requiredStamps = selected.loyalty?.required_stamps ?? selected.loyalty_card?.required_stamps ?? 10;

    const rewardName = selected.loyalty_card?.reward_name || "Loyalty reward";
    const rewardDescription =
      selected.loyalty_card?.reward_description ||
      `Collect ${requiredStamps} stamps to unlock ${rewardName}.`;
    const remainingStamps = Math.max(0, requiredStamps - currentStamps);
    const rewardReady = currentStamps >= requiredStamps;
    const cardId = selected.id.replace(/-/g, "").slice(0, 12).toUpperCase();

    const loyaltyClass = {
      id: classId,
      issuerName: "LOYVANCE",
      reviewStatus: "UNDER_REVIEW",
      programName: selected.business.name,
      programLogo: {
        sourceUri: { uri: logoUrl },
        contentDescription: {
          defaultValue: { language: "en-US", value: `${selected.business.name} logo` },
        },
      },
      heroImage: selected.business.google_wallet_show_background && selected.business.hero_image_url
        ? {
            sourceUri: { uri: selected.business.hero_image_url },
            contentDescription: {
              defaultValue: { language: "en-US", value: `${selected.business.name} card background` },
            },
          }
        : null,
      hexBackgroundColor: selected.business.primary_color || "#111827",
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: { fields: [{ fieldPath: "object.loyaltyPoints" }] },
                },
                endItem: {
                  firstValue: { fields: [{ fieldPath: "object.secondaryLoyaltyPoints" }] },
                },
              },
            },
          ],
        },
        cardBarcodeSectionDetails: {
          firstTopDetail: {
            fieldSelector: { fields: [{ fieldPath: "object.accountName" }] },
          },
        },
      },
      accountNameLabel: "Member",
      accountIdLabel: "Card ID",
    };

    const loyaltyObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      accountName: memberName,
      accountId: cardId,
      barcode: {
        type: "QR_CODE",
        value: qrValue,
        alternateText: selected.business.name,
      },
      loyaltyPoints: {
        label: "Stamps",
        balance: { string: `${currentStamps} / ${requiredStamps}` },
      },
      secondaryLoyaltyPoints: {
        label: rewardReady ? "Reward" : "Remaining",
        balance: { string: rewardReady ? "READY" : String(remainingStamps) },
      },
      appLinkData: {
        webAppLinkInfo: {
          appTarget: { targetUri: { uri: "https://digital-loyalty-card-saa-s.vercel.app/dashboard/" } },
        },
        displayText: { defaultValue: { language: "en-US", value: "Open loyalty card" } },
      },
      linksModuleData: {
        uris: [{ id: "loyvance", uri: "https://digital-loyalty-card-saa-s.vercel.app/dashboard/", description: "Open in LOYVANCE" }],
      },
      textModulesData: [
        {
          id: "stamps",
          header: "Stamp card",
          body: googleWalletStampStrip(currentStamps, requiredStamps),
        },
        {
          id: "reward",
          header: rewardReady ? "Reward ready" : rewardName,
          body: rewardReady
            ? `You unlocked ${rewardName}. Show this card at ${selected.business.name} to redeem it.`
            : rewardDescription,
        },
        {
          id: "progress",
          header: "Your progress",
          body: rewardReady
            ? `${currentStamps} of ${requiredStamps} stamps collected. Your reward is ready.`
            : `${currentStamps} of ${requiredStamps} stamps collected · ${remainingStamps} to go.`,
        },
      ],
    };

    // Deployment refresh: Google Wallet enhanced layout enabled.
    // Keep Google's server-side resources authoritative and current before
    // handing the user a Save-to-Wallet link. This also refreshes an object that
    // was previously removed from a user's Wallet (removal only unlinks it).
    const accessToken = await googleWalletAccessToken();
    if (!accessToken) return error("Could not authenticate with Google Wallet.", 502);
    try {
      await upsertGoogleWallet("loyaltyClass", classId, loyaltyClass, accessToken);
      await upsertGoogleWallet("loyaltyObject", objectId, loyaltyObject, accessToken);
    } catch (walletError) {
      console.error("Google Wallet upsert before save failed", walletError);
      return error(walletError instanceof Error ? walletError.message : "Could not synchronize Google Wallet.", 502);
    }

    // Reference the already-created resources instead of asking Save-to-Wallet
    // to recreate them from a potentially stale embedded snapshot.
    const token = signGoogleWalletJwt({
      iss: clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: ["https://digital-loyalty-card-saa-s.vercel.app"],
      payload: {
        loyaltyClasses: [{ id: classId }],
        loyaltyObjects: [{ id: objectId, classId }],
      },
    }, clientEmail, privateKey);

    return json({ url: `https://pay.google.com/gp/v/save/${token}` });
  }

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

  if (path[1] === "rewards") {
    const membershipIds = memberships.map((m) => m.id);
    if (!membershipIds.length) return json({ data: { available: [], history: [] } });
    const available = cards.filter((c) => c.loyalty_card).map((c) => ({
      loyalty_card_id: c.loyalty_card!.id,
      business_id: c.business.id,
      business_name: c.business.name,
      business_logo_url: c.business.logo_url,
      business_primary_color: c.business.primary_color,
      reward_name: c.loyalty_card!.reward_name,
      reward_description: c.loyalty_card!.reward_description,
      points_required: c.loyalty_card!.required_stamps,
      current_stamps: c.loyalty?.current_stamps ?? 0,
      progress_percent: c.loyalty?.progress_percent ?? 0,
      ready: Boolean(c.loyalty && c.loyalty.current_stamps >= c.loyalty.required_stamps),
    }));
    const history = (await sql`
      SELECT r.id, r.status, r.business_id, r.customer_id, r.earned_at::text, r.redeemed_at::text,
             b.name AS business_name, b.logo_url AS business_logo_url, b.primary_color AS business_primary_color,
             lc.reward_name, lc.reward_description, lc.required_stamps AS points_required
      FROM reward_redemptions r
      JOIN customers c ON c.id = r.customer_id
      JOIN businesses b ON b.id = r.business_id
      JOIN loyalty_cards lc ON lc.id = r.loyalty_card_id
      WHERE c.user_id = ${auth.user.id} ORDER BY r.earned_at DESC
    `) as JsonRecord[];
    return json({ data: { available, history } });
  }
  if (path[1] === "activity") {
    const visits = (await sql`
      SELECT v.id, 'visit' AS type, v.business_id, v.customer_id, v.created_at::text AS date, 1 AS points,
             b.name AS business_name, b.logo_url AS business_logo_url, b.primary_color AS business_primary_color
      FROM visits v
      JOIN customers c ON c.id = v.customer_id
      JOIN businesses b ON b.id = v.business_id
      WHERE c.user_id = ${auth.user.id}
    `) as JsonRecord[];
    const rewards = (await sql`
      SELECT r.id, CASE WHEN r.status = 'redeemed' THEN 'reward_redeemed' ELSE 'reward_earned' END AS type,
        r.business_id, r.customer_id, COALESCE(r.redeemed_at, r.earned_at)::text AS date,
        b.name AS business_name, b.logo_url AS business_logo_url, b.primary_color AS business_primary_color,
        lc.reward_name
      FROM reward_redemptions r
      JOIN customers c ON c.id = r.customer_id
      JOIN businesses b ON b.id = r.business_id
      JOIN loyalty_cards lc ON lc.id = r.loyalty_card_id
      WHERE c.user_id = ${auth.user.id}
    `) as JsonRecord[];
    const items = [...visits, ...rewards].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
    return json({ data: { items } });
  }
  if (path[1] === "join-by-qr" && req.method === "POST") {
    const body = await readJson(req);
    const qr = asString(body.qr);
    let business: DbBusiness | undefined;
    let joinSlug = "";
    let joinBusinessId = "";

    try {
      const parsed = new URL(qr);
      joinSlug = parsed.searchParams.get("join")?.trim() ?? "";
      joinBusinessId = parsed.searchParams.get("join_business_id")?.trim() ?? "";
      if (!joinSlug) {
        const segments = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
        joinSlug = segments[0] === "business" ? (segments[1] ?? "") : "";
      }
    } catch {
      const bySlug = qr.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      joinSlug = bySlug[0] === "business" ? (bySlug[1] ?? "") : (bySlug.length === 1 ? bySlug[0] : "");
    }

    if (joinSlug) {
      business = ((await sql`SELECT * FROM businesses WHERE slug = ${joinSlug} LIMIT 1`) as DbBusiness[])[0];
    }
    if (!business && joinBusinessId) {
      business = ((await sql`SELECT * FROM businesses WHERE id = ${joinBusinessId} LIMIT 1`) as DbBusiness[])[0];
    }
    if (!business) {
      const existingCustomer = ((await sql`SELECT * FROM customers WHERE qr_code = ${qr} LIMIT 1`) as DbCustomer[])[0];
      if (existingCustomer) business = ((await sql`SELECT * FROM businesses WHERE id = ${existingCustomer.business_id} LIMIT 1`) as DbBusiness[])[0];
    }
    if (!business) return error("Business QR not found.", 404);
    let membership = ((await sql`SELECT *, created_at::text, updated_at::text FROM customers WHERE user_id = ${auth.user.id} AND business_id = ${business.id} LIMIT 1`) as DbCustomer[])[0];
    if (!membership) {
      const p = profile as JsonRecord;
      membership = ((await sql`
        INSERT INTO customers (id, business_id, user_id, first_name, last_name, email, phone, qr_code)
        VALUES (${randomUUID()}, ${business.id}, ${auth.user.id}, ${asNullableString(p.first_name)}, ${asNullableString(p.last_name)}, ${auth.user.email}, ${asNullableString(p.phone)}, ${`cust_${randomBytes(16).toString("hex")}`})
        RETURNING *, created_at::text, updated_at::text
      `) as DbCustomer[])[0];
    }
    const card = await defaultCard(sql, business.id);
    const loyalty = ((await sql`
      INSERT INTO customer_loyalties (id, customer_id, loyalty_card_id, current_stamps)
      VALUES (${randomUUID()}, ${membership.id}, ${card.id}, 0)
      ON CONFLICT (customer_id, loyalty_card_id) DO UPDATE SET updated_at = now()
      RETURNING *
    `) as DbLoyalty[])[0];
    return json({ message: "Loyalty card added.", business: { id: business.id, slug: business.slug, name: business.name }, customer: { id: membership.id, qr_code: membership.qr_code }, loyalty_card: publicLoyaltyCard(card), loyalty });
  }

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
    else if (path[0] === "dashboard") response = await handleDashboard(path, req, sql);
    else if (path[0] === "realtime-version") response = await handleRealtimeVersion(req, sql);
    else if (path[0] === "business") response = await handleBusiness(path, req, sql);
    else if (path[0] === "loyalty-card") response = await handleLoyaltyCard(req, sql);
    else if (path[0] === "public") response = await handlePublic(path, req, sql);
    else if (path[0] === "stamp" || path[0] === "redeem-reward") response = await handleStamp(path, req, sql);
    else if (path[0] === "user") response = await handleCustomerUser(path, req, sql);

    return response ?? error("API route not found.", 404);
  } catch (caught) {
    if (caught instanceof Response) return caught;
    const message = caught instanceof Error ? caught.message : "Unexpected API error.";
    console.error("API request failed", { method: req.method, url: req.url, message, stack: caught instanceof Error ? caught.stack : undefined });
    return error(message, 500);
  }
}
