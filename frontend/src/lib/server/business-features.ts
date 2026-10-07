import { ensureRewardLevelSchema, reconcileRewardGoals } from "@/lib/server/reward-levels";
import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

export type BusinessFeatures = { custom_stamp_quantity: boolean; stamp_messages: boolean; reward_levels_enabled: boolean };
export type FeatureState = BusinessFeatures & { access: BusinessFeatures; preferences: BusinessFeatures; reward_levels_configured:boolean };
type Sql = ReturnType<typeof getSql>;
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function ensureFeatureSchema(sql: Sql) {
  await ensureRewardLevelSchema(sql);
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS custom_stamp_quantity boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stamp_messages boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS custom_stamp_quantity_active boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stamp_messages_active boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count BETWEEN 1 AND 100)`;
  await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS stamp_message text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE visits ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL`;
}

export async function readBusinessFeatures(sql: Sql, businessId: string): Promise<FeatureState | null> {
  const rows = await sql`SELECT custom_stamp_quantity,stamp_messages,reward_levels_enabled,
    custom_stamp_quantity_active,stamp_messages_active,reward_levels_active,reward_levels FROM businesses WHERE id=${businessId} LIMIT 1` as Array<Record<string,unknown>>;
  const row = rows[0]; if (!row) return null;
  const access = { custom_stamp_quantity:row.custom_stamp_quantity === true,stamp_messages:row.stamp_messages === true,reward_levels_enabled:row.reward_levels_enabled === true };
  const preferences = {custom_stamp_quantity:row.custom_stamp_quantity_active === true,stamp_messages:row.stamp_messages_active === true,reward_levels_enabled:row.reward_levels_active === true};
  return {access,preferences,reward_levels_configured:Array.isArray(row.reward_levels)&&row.reward_levels.length>0,custom_stamp_quantity:access.custom_stamp_quantity && preferences.custom_stamp_quantity,
    stamp_messages:access.stamp_messages && preferences.stamp_messages,reward_levels_enabled:access.reward_levels_enabled && preferences.reward_levels_enabled};
}

export async function ownerBusinessFeatures(req: Request, sql: Sql, businessId: string, actor: {id:string;name:string}) {
  if (req.method === "GET") return reply({features:await readBusinessFeatures(sql,businessId)});
  if (req.method !== "PATCH") return reply({message:"Method not allowed."},405);
  const body = await req.json().catch(()=>null);
  if (!body || typeof body.custom_stamp_quantity !== "boolean" || typeof body.stamp_messages !== "boolean" || typeof body.reward_levels_enabled !== "boolean") return reply({message:"Choose a valid value for each business option."},422);
  const rows=await sql`WITH previous AS (SELECT * FROM businesses WHERE id=${businessId} FOR UPDATE),
    updated AS (
      UPDATE businesses b SET custom_stamp_quantity_active=${body.custom_stamp_quantity},stamp_messages_active=${body.stamp_messages},reward_levels_active=${body.reward_levels_enabled},
        reward_config_version=b.reward_config_version+1,updated_at=now() FROM previous p WHERE b.id=p.id
        AND (NOT ${body.custom_stamp_quantity} OR p.custom_stamp_quantity) AND (NOT ${body.stamp_messages} OR p.stamp_messages)
        AND (NOT ${body.reward_levels_enabled} OR (p.reward_levels_enabled AND jsonb_array_length(p.reward_levels)>0)) RETURNING b.id
    ), audit AS (
      INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
      SELECT ${randomUUID()},${actor.id},${actor.name},'business_options_change','business',p.id,p.name,
        CONCAT('Business activation: quantity=',${body.custom_stamp_quantity}::text,', messages=',${body.stamp_messages}::text,', reward levels=',${body.reward_levels_enabled}::text)
      FROM previous p JOIN updated u ON u.id=p.id
     ) SELECT id FROM updated` as Array<{id:string}>;
  if (!rows.length) return reply({message:"Administrator access is required. Save at least one reward level before enabling customer goals."},403);
  await reconcileRewardGoals(sql,businessId);
  return reply({features:await readBusinessFeatures(sql,businessId),message:"Business options saved."});
}

export async function adminBusinessFeatures(req: Request, sql: Sql, businessId: string, actor: { id: string; name: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) return reply({ message: "Invalid business identifier." }, 422);
  if (req.method === "GET") {
    const features = await readBusinessFeatures(sql, businessId);
    return features ? reply({ features:features.access }) : reply({ message: "Business not found." }, 404);
  }
  if (req.method !== "PATCH") return reply({ message: "Method not allowed." }, 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.custom_stamp_quantity !== "boolean" || typeof body.stamp_messages !== "boolean" || typeof body.reward_levels_enabled !== "boolean") return reply({ message: "Choose a valid value for each business option." }, 422);
  const rows = await sql`WITH previous AS (
    SELECT id, name, custom_stamp_quantity, stamp_messages, reward_levels_enabled FROM businesses WHERE id = ${businessId} FOR UPDATE
  ), updated AS (
    UPDATE businesses b SET custom_stamp_quantity = ${body.custom_stamp_quantity}, stamp_messages = ${body.stamp_messages}, reward_levels_enabled=${body.reward_levels_enabled}, reward_config_version=b.reward_config_version+CASE WHEN p.reward_levels_enabled IS DISTINCT FROM ${body.reward_levels_enabled} THEN 1 ELSE 0 END, updated_at = now()
    FROM previous p WHERE b.id = p.id RETURNING b.id, b.custom_stamp_quantity, b.stamp_messages, b.reward_levels_enabled
  ), audit AS (
    INSERT INTO admin_audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, entity_name, reason)
    SELECT ${randomUUID()}, ${actor.id}, ${actor.name}, 'business_features_change', 'business', p.id, p.name,
      CONCAT('Stamp quantity: ', p.custom_stamp_quantity::text, ' → ', u.custom_stamp_quantity::text, '; stamp messages: ', p.stamp_messages::text, ' → ', u.stamp_messages::text, '; reward levels: ',p.reward_levels_enabled::text,' → ',u.reward_levels_enabled::text)
    FROM previous p JOIN updated u ON p.id=u.id
    WHERE p.custom_stamp_quantity IS DISTINCT FROM u.custom_stamp_quantity OR p.stamp_messages IS DISTINCT FROM u.stamp_messages OR p.reward_levels_enabled IS DISTINCT FROM u.reward_levels_enabled
  ) SELECT custom_stamp_quantity, stamp_messages, reward_levels_enabled FROM updated` as BusinessFeatures[];
  if (rows[0]) await reconcileRewardGoals(sql,businessId);
  return rows[0] ? reply({ features: rows[0], message: "Business options saved." }) : reply({ message: "Business not found." }, 404);
}

export function stampOptions(body: Record<string, unknown>, features: Pick<BusinessFeatures, "custom_stamp_quantity" | "stamp_messages">) {
  const count = body.stamp_count === undefined ? 1 : body.stamp_count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 100) throw new Error("Choose a whole number of stamps between 1 and 100.");
  if (!features.custom_stamp_quantity && count !== 1) throw new Error("Custom stamp quantity is not enabled for your business.");
  if (body.stamp_message !== undefined && typeof body.stamp_message !== "string") throw new Error("Enter a valid stamp message.");
  const message = typeof body.stamp_message === "string" ? body.stamp_message.trim() : "";
  if (message.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) throw new Error("Stamp message must contain at most 500 printable characters.");
  if (message && !features.stamp_messages) throw new Error("Stamp messages are not enabled for your business.");
  return { count, message };
}
