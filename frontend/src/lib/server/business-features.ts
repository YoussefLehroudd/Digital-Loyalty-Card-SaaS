import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

export type BusinessFeatures = { custom_stamp_quantity: boolean; stamp_messages: boolean };
type Sql = ReturnType<typeof getSql>;
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function ensureFeatureSchema(sql: Sql) {
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS custom_stamp_quantity boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stamp_messages boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count BETWEEN 1 AND 100)`;
  await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS stamp_message text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL`;
}

export async function readBusinessFeatures(sql: Sql, businessId: string) {
  const rows = await sql`SELECT custom_stamp_quantity, stamp_messages FROM businesses WHERE id = ${businessId} LIMIT 1` as BusinessFeatures[];
  return rows[0] ?? null;
}

export async function adminBusinessFeatures(req: Request, sql: Sql, businessId: string, actor: { id: string; name: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) return reply({ message: "Invalid business identifier." }, 422);
  if (req.method === "GET") {
    const features = await readBusinessFeatures(sql, businessId);
    return features ? reply({ features }) : reply({ message: "Business not found." }, 404);
  }
  if (req.method !== "PATCH") return reply({ message: "Method not allowed." }, 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.custom_stamp_quantity !== "boolean" || typeof body.stamp_messages !== "boolean") return reply({ message: "Choose a valid value for each business option." }, 422);
  const rows = await sql`WITH previous AS (
    SELECT id, name, custom_stamp_quantity, stamp_messages FROM businesses WHERE id = ${businessId} FOR UPDATE
  ), updated AS (
    UPDATE businesses b SET custom_stamp_quantity = ${body.custom_stamp_quantity}, stamp_messages = ${body.stamp_messages}, updated_at = now()
    FROM previous p WHERE b.id = p.id RETURNING b.id, b.custom_stamp_quantity, b.stamp_messages
  ), audit AS (
    INSERT INTO admin_audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, entity_name, reason)
    SELECT ${randomUUID()}, ${actor.id}, ${actor.name}, 'business_features_change', 'business', p.id, p.name,
      CONCAT('Stamp quantity: ', p.custom_stamp_quantity::text, ' → ', u.custom_stamp_quantity::text, '; stamp messages: ', p.stamp_messages::text, ' → ', u.stamp_messages::text)
    FROM previous p JOIN updated u ON p.id=u.id
    WHERE p.custom_stamp_quantity IS DISTINCT FROM u.custom_stamp_quantity OR p.stamp_messages IS DISTINCT FROM u.stamp_messages
  ) SELECT custom_stamp_quantity, stamp_messages FROM updated` as BusinessFeatures[];
  return rows[0] ? reply({ features: rows[0], message: "Business options saved." }) : reply({ message: "Business not found." }, 404);
}

export function stampOptions(body: Record<string, unknown>, features: BusinessFeatures) {
  const count = body.stamp_count === undefined ? 1 : body.stamp_count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 100) throw new Error("Choose a whole number of stamps between 1 and 100.");
  if (!features.custom_stamp_quantity && count !== 1) throw new Error("Custom stamp quantity is not enabled for your business.");
  if (body.stamp_message !== undefined && typeof body.stamp_message !== "string") throw new Error("Enter a valid stamp message.");
  const message = typeof body.stamp_message === "string" ? body.stamp_message.trim() : "";
  if (message.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) throw new Error("Stamp message must contain at most 500 printable characters.");
  if (message && !features.stamp_messages) throw new Error("Stamp messages are not enabled for your business.");
  return { count, message };
}
