import { effectiveRewardCard } from "@/lib/server/reward-levels";
import { createHash, createPrivateKey, randomBytes, timingSafeEqual, X509Certificate } from "crypto";
import { connect } from "http2";
import { after } from "next/server";
import { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
type StoredPass = { customer_id: string; pass_type_id: string; authentication_token: string; updated_at: string; update_tag: string };
type PassData = {
  id: string; user_id: string | null; first_name: string | null; last_name: string | null; qr_code: string | null;
  business_name: string; logo_url: string | null; primary_color: string | null;
  reward_name: string; reward_description: string | null; required_stamps: number; current_stamps: number;
};
const noStore = { "Cache-Control": "no-store" };
const response = (status: number, message?: string) => message
  ? Response.json({ message }, { status, headers: noStore })
  : new Response(null, { status, headers: noStore });
const pem = (key: string) => process.env[key]?.replace(/\\n/g, "\n").trim() || "";

function configuration() {
  const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID?.trim() || "";
  const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID?.trim() || "";
  const signerCert = pem("APPLE_WALLET_SIGNER_CERT");
  const signerKey = pem("APPLE_WALLET_SIGNER_KEY");
  const wwdr = pem("APPLE_WALLET_WWDR_CERT");
  const signerKeyPassphrase = process.env.APPLE_WALLET_KEY_PASSPHRASE || undefined;
  const baseUrl = (process.env.APPLE_WALLET_BASE_URL || "https://digital-loyalty-card-saa-s.vercel.app").replace(/\/+$/, "");
  if (process.env.APPLE_WALLET_ENABLED !== "true" || !passTypeIdentifier || !teamIdentifier || !signerCert || !signerKey || !wwdr) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    const cert = new X509Certificate(signerCert);
    const issuer = new X509Certificate(wwdr);
    const key = createPrivateKey({ key: signerKey, passphrase: signerKeyPassphrase });
    if (!cert.checkPrivateKey(key) || Date.parse(cert.validTo) <= Date.now() || Date.parse(cert.validFrom) > Date.now()) return null;
    if (!cert.subject.split("\n").includes("UID=" + passTypeIdentifier) || !cert.subject.split("\n").includes("OU=" + teamIdentifier)) return null;
    if (!cert.verify(issuer.publicKey) || Date.parse(issuer.validTo) <= Date.now()) return null;
    return { passTypeIdentifier, teamIdentifier, signerCert, signerKey, wwdr, signerKeyPassphrase, baseUrl };
  } catch { return null; }
}

export function appleWalletAvailable() { return configuration() !== null; }

export async function ensureAppleWalletSchema(sql: Sql) {
  await sql`CREATE SEQUENCE IF NOT EXISTS apple_wallet_update_sequence`;
  await sql`CREATE TABLE IF NOT EXISTS apple_wallet_passes (
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pass_type_id text NOT NULL,
    authentication_token text NOT NULL,
    update_tag bigint NOT NULL DEFAULT nextval('apple_wallet_update_sequence'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, pass_type_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS apple_wallet_registrations (
    device_library_id text NOT NULL, customer_id uuid NOT NULL, pass_type_id text NOT NULL,
    push_token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (device_library_id, customer_id, pass_type_id),
    FOREIGN KEY (customer_id, pass_type_id) REFERENCES apple_wallet_passes(customer_id, pass_type_id) ON DELETE CASCADE
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_apple_wallet_registrations_pass ON apple_wallet_registrations(customer_id, pass_type_id)`;
  await sql`CREATE TABLE IF NOT EXISTS apple_wallet_downloads (
    token_hash text PRIMARY KEY, customer_id uuid NOT NULL, pass_type_id text NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
    FOREIGN KEY (customer_id, pass_type_id) REFERENCES apple_wallet_passes(customer_id, pass_type_id) ON DELETE CASCADE
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_apple_wallet_downloads_expiry ON apple_wallet_downloads(expires_at)`;
}

async function passData(sql: Sql, customerId: string) {
  const data = ((await sql`
    SELECT c.id, c.user_id, c.first_name, c.last_name, c.qr_code,
           b.name AS business_name, b.logo_url, b.primary_color,
           lc.id AS card_id,lc.business_id,lc.reward_name, lc.reward_description, lc.required_stamps,
           COALESCE(cl.current_stamps, 0)::int AS current_stamps
    FROM customers c JOIN businesses b ON b.id = c.business_id
    JOIN loyalty_cards lc ON lc.business_id = c.business_id
    LEFT JOIN customer_loyalties cl ON cl.customer_id = c.id AND cl.loyalty_card_id = lc.id
    WHERE c.id = ${customerId} LIMIT 1
  `) as Array<PassData & {card_id:string;business_id:string}>)[0];
  if (!data) return data;
  const card=await effectiveRewardCard(sql,customerId,{id:data.card_id,business_id:data.business_id,required_stamps:data.required_stamps,reward_name:data.reward_name,reward_description:data.reward_description});
  return {...data,required_stamps:card.required_stamps,reward_name:card.reward_name,reward_description:card.reward_description};
}

function color(hex: string | null) {
  const valid = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex! : "#111827";
  return `rgb(${parseInt(valid.slice(1, 3), 16)}, ${parseInt(valid.slice(3, 5), 16)}, ${parseInt(valid.slice(5, 7), 16)})`;
}

async function imageAssets(logoUrl: string | null) {
  const { default: sharp } = await import("sharp");
  const fallback = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" rx="22" fill="#111827"/><path d="M28 23h15v46h31v13H28z" fill="#ffd369"/></svg>');
  let source = fallback;
  if (logoUrl) {
    try {
      const url = new URL(logoUrl);
      // Uploaded business logos are served by Cloudinary. Never fetch an arbitrary URL.
      if (url.protocol === "https:" && url.hostname === "res.cloudinary.com") {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "error" });
        const length = Number(res.headers.get("content-length") || 0);
        if (res.ok && length <= 2_000_000) {
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.length <= 2_000_000) source = bytes;
        }
      }
    } catch { /* A failed logo download must not prevent pass creation. */ }
  }
  try {
    const input = sharp(source, { limitInputPixels: 16_000_000 });
    const assets = await Promise.all([
      input.clone().resize(29, 29, { fit: "contain" }).png().toBuffer(),
      input.clone().resize(58, 58, { fit: "contain" }).png().toBuffer(),
      input.clone().resize(87, 87, { fit: "contain" }).png().toBuffer(),
      input.clone().resize(160, 50, { fit: "contain", background: "#00000000" }).png().toBuffer(),
      input.clone().resize(320, 100, { fit: "contain", background: "#00000000" }).png().toBuffer(),
    ]);
    return Object.fromEntries(["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"].map((name, i) => [name, assets[i]]));
  } catch {
    if (source === fallback) throw new Error("Could not prepare Apple Wallet images.");
    return imageAssets(null);
  }
}

async function signedPass(sql: Sql, stored: StoredPass) {
  const config = configuration();
  if (!config || stored.pass_type_id !== config.passTypeIdentifier) return response(503, "Apple Wallet is coming soon.");
  const data = await passData(sql, stored.customer_id);
  if (!data || !data.qr_code) return response(404, "Loyalty card not found.");
  const current = Number(data.current_stamps);
  const required = Math.max(1, Number(data.required_stamps));
  const ready = current >= required;
  const { PKPass } = await import("passkit-generator");
  const pass = new PKPass(await imageAssets(data.logo_url), {
    wwdr: config.wwdr, signerCert: config.signerCert, signerKey: config.signerKey, signerKeyPassphrase: config.signerKeyPassphrase,
  }, {
    formatVersion: 1, passTypeIdentifier: config.passTypeIdentifier, teamIdentifier: config.teamIdentifier,
    serialNumber: data.id, organizationName: data.business_name,
    description: `${data.business_name} loyalty card`, logoText: data.business_name,
    backgroundColor: color(data.primary_color), foregroundColor: "rgb(255, 255, 255)", labelColor: "rgb(255, 211, 105)",
    webServiceURL: config.baseUrl + "/api/apple-wallet",
    authenticationToken: stored.authentication_token,
  });
  pass.type = "storeCard";
  pass.headerFields.push({ key: "stamps", label: "STAMPS", value: `${current}/${required}`, changeMessage: "Your stamp balance is now %@." });
  pass.primaryFields.push({ key: "reward", label: "YOUR REWARD", value: data.reward_name });
  pass.secondaryFields.push({ key: "member", label: "MEMBER", value: [data.first_name, data.last_name].filter(Boolean).join(" ") || "Member" });
  pass.auxiliaryFields.push({ key: "status", label: "STATUS", value: ready ? "Reward unlocked" : `${required - current} stamps to go`, changeMessage: "Loyalty card updated: %@." });
  pass.backFields.push(
    { key: "details", label: "Reward details", value: data.reward_description || `Collect ${required} stamps to unlock ${data.reward_name}.` },
    { key: "business", label: "Business", value: data.business_name },
    { key: "card", label: "Membership", value: data.id },
    { key: "website", label: "LOYVANCE", value: config.baseUrl + "/user/cards?selected=" + encodeURIComponent(data.id) },
    { key: "legal", label: "Apple Wallet", value: "Apple and Apple Wallet are trademarks of Apple Inc." },
  );
  pass.setBarcodes({ format: "PKBarcodeFormatQR", message: data.qr_code, messageEncoding: "iso-8859-1", altText: data.business_name });
  const bytes = pass.getAsBuffer();
  return new Response(new Uint8Array(bytes), { headers: {
    ...noStore, "Content-Type": "application/vnd.apple.pkpass",
    "Content-Disposition": 'attachment; filename="loyvance-loyalty-card.pkpass"',
    "Last-Modified": new Date(stored.updated_at).toUTCString(),
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function createAppleWalletLink(sql: Sql, customerId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return response(404, "Loyalty card not found.");
  const data = await passData(sql, customerId);
  if (!data || data.user_id !== userId) return response(404, "Loyalty card not found.");
  const config = configuration();
  if (!config) return response(503, "Apple Wallet is coming soon.");
  await sql`
    INSERT INTO apple_wallet_passes (customer_id, pass_type_id, authentication_token)
    VALUES (${customerId}, ${config.passTypeIdentifier}, ${randomBytes(32).toString("hex")})
    ON CONFLICT (customer_id, pass_type_id) DO NOTHING
  `;
  const ticket = randomBytes(32).toString("hex");
  await sql`DELETE FROM apple_wallet_downloads WHERE expires_at < now()`;
  await sql`
    INSERT INTO apple_wallet_downloads (token_hash, customer_id, pass_type_id)
    VALUES (${createHash("sha256").update(ticket).digest("hex")}, ${customerId}, ${config.passTypeIdentifier})
  `;
  return Response.json({ url: config.baseUrl + "/api/apple-wallet/download/" + ticket }, { headers: noStore });
}

function validToken(req: Request, stored: StoredPass) {
  const provided = req.headers.get("authorization")?.match(/^ApplePass (.+)$/i)?.[1] || "";
  const expected = Buffer.from(stored.authentication_token);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function handleAppleWallet(path: string[], req: Request, sql: Sql): Promise<Response> {
  if (path[1] === "download" && path.length === 3 && req.method === "GET") {
    if (!/^[0-9a-f]{64}$/.test(path[2])) return response(404, "Download link expired.");
    const found = ((await sql`
      SELECT p.*, p.updated_at::text, p.update_tag::text FROM apple_wallet_downloads d
      JOIN apple_wallet_passes p ON p.customer_id = d.customer_id AND p.pass_type_id = d.pass_type_id
      WHERE d.token_hash = ${createHash("sha256").update(path[2]).digest("hex")} AND d.expires_at > now() LIMIT 1
    `) as StoredPass[])[0];
    return found ? signedPass(sql, found) : response(404, "Download link expired. Open your loyalty card and try again.");
  }
  if (path[1] !== "v1") return response(404, "Not found.");
  if (path[2] === "log" && path.length === 3 && req.method === "POST") {
    // Acknowledge Wallet diagnostics without storing pass tokens or client-supplied private data.
    return response(200);
  }
  if (path[2] === "devices" && path[4] === "registrations" && path.length === 6 && req.method === "GET") {
    const since = new URL(req.url).searchParams.get("passesUpdatedSince") || "0";
    if (!/^\d{1,18}$/.test(since) || path[3].length > 256 || path[5].length > 256) return response(400);
    const changed = (await sql`
      SELECT p.customer_id::text AS serial, p.update_tag::text AS tag
      FROM apple_wallet_registrations r JOIN apple_wallet_passes p
      ON p.customer_id = r.customer_id AND p.pass_type_id = r.pass_type_id
      WHERE r.device_library_id = ${path[3]} AND r.pass_type_id = ${path[5]} AND p.update_tag > ${since}::bigint
    `) as Array<{ serial: string; tag: string }>;
    if (!changed.length) return response(204);
    const lastUpdated = changed.reduce((latest, p) => BigInt(p.tag) > BigInt(latest) ? p.tag : latest, "0");
    return Response.json({ serialNumbers: changed.map(p => p.serial), lastUpdated }, { headers: noStore });
  }
  const registration = path[2] === "devices" && path[4] === "registrations" && path.length === 7;
  const fetchPass = path[2] === "passes" && path.length === 5 && req.method === "GET";
  if (!registration && !fetchPass) return response(404, "Not found.");
  const type = registration ? path[5] : path[3];
  const serial = registration ? path[6] : path[4];
  if (!/^[0-9a-f-]{36}$/i.test(serial) || type.length > 256) return response(401);
  const found = ((await sql`SELECT *, updated_at::text, update_tag::text FROM apple_wallet_passes WHERE customer_id = ${serial} AND pass_type_id = ${type} LIMIT 1`) as StoredPass[])[0];
  if (!found || !validToken(req, found)) return response(401);
  if (fetchPass) {
    // Always return current data: second-resolution HTTP timestamps can hide rapid consecutive scans.
    return signedPass(sql, found);
  }
  const device = path[3];
  if (!device || device.length > 256) return response(400);
  if (req.method === "DELETE") {
    await sql`DELETE FROM apple_wallet_registrations WHERE device_library_id = ${device} AND customer_id = ${serial} AND pass_type_id = ${type}`;
    return response(200);
  }
  if (req.method !== "POST") return response(405);
  const body = await req.json().catch(() => ({})) as { pushToken?: unknown };
  if (typeof body.pushToken !== "string" || !/^[0-9a-f]{32,256}$/i.test(body.pushToken)) return response(400);
  const rows = (await sql`
    INSERT INTO apple_wallet_registrations (device_library_id, customer_id, pass_type_id, push_token)
    VALUES (${device}, ${serial}, ${type}, ${body.pushToken})
    ON CONFLICT (device_library_id, customer_id, pass_type_id) DO UPDATE SET push_token = EXCLUDED.push_token
    RETURNING (xmax = 0) AS inserted
  `) as Array<{ inserted: boolean }>;
  return response(rows[0].inserted ? 201 : 200);
}

async function pushUpdates(sql: Sql, customerId: string) {
  const config = configuration();
  if (!config) return;
  const devices = (await sql`SELECT DISTINCT device_library_id, push_token FROM apple_wallet_registrations WHERE customer_id = ${customerId} AND pass_type_id = ${config.passTypeIdentifier}`) as Array<{ device_library_id: string; push_token: string }>;
  if (!devices.length) return;
  const client = connect("https://api.push.apple.com", { cert: config.signerCert, key: config.signerKey, passphrase: config.signerKeyPassphrase });
  client.on("error", () => {});
  try {
    await Promise.allSettled(devices.map(device => new Promise<void>((resolve, reject) => {
      const stream = client.request({
        ":method": "POST", ":path": "/3/device/" + device.push_token,
        "apns-topic": config.passTypeIdentifier, "apns-priority": "5", "content-type": "application/json",
      });
      let status = 0;
      let body = "";
      stream.setTimeout(8000, () => { stream.close(); reject(new Error("Apple Wallet push timed out.")); });
      stream.on("response", headers => { status = Number(headers[":status"]); });
      stream.on("data", chunk => { body += chunk.toString(); });
      stream.on("error", reject);
      stream.on("end", () => {
        const invalid = status === 410 || (status === 400 && body.includes("BadDeviceToken"));
        if (invalid) {
          void sql`DELETE FROM apple_wallet_registrations WHERE device_library_id = ${device.device_library_id} AND push_token = ${device.push_token}`.then(() => resolve(), reject);
        } else if (status === 200) resolve();
        else { console.error("Apple Wallet push failed", { status }); reject(new Error("Apple Wallet push failed.")); }
      });
      stream.end("{}");
    })));
  } finally { client.destroy(); }
}

export async function syncAppleWalletCustomer(sql: Sql, customerId: string) {
  if (!appleWalletAvailable()) return;
  try {
    const updated = (await sql`
      UPDATE apple_wallet_passes SET updated_at = now(), update_tag = nextval('apple_wallet_update_sequence')
      WHERE customer_id = ${customerId} RETURNING customer_id
    `) as Array<{ customer_id: string }>;
    if (updated.length) after(async () => { await pushUpdates(sql, customerId).catch(() => console.error("Apple Wallet push unavailable.")); });
  } catch { console.error("Apple Wallet update unavailable."); }
}
