import { randomUUID } from "crypto";
import type { getSql } from "@/lib/server/db";

type Sql = ReturnType<typeof getSql>;
export type RewardLevel = { stamps: number; name: string; message: string };
type BaseCard = { id: string; business_id: string; required_stamps: number; reward_name: string; reward_description: string | null };

export async function ensureRewardLevelSchema(sql: Sql) {
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reward_levels_enabled boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reward_levels_active boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reward_levels jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reward_config_version integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE customer_loyalties ADD COLUMN IF NOT EXISTS target_stamps integer`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS required_stamps_snapshot integer`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS reward_name_snapshot text`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS description_snapshot text`;
  await sql`UPDATE reward_redemptions r SET required_stamps_snapshot=lc.required_stamps,reward_name_snapshot=lc.reward_name,description_snapshot=lc.reward_description FROM loyalty_cards lc WHERE r.loyalty_card_id=lc.id AND r.required_stamps_snapshot IS NULL`;
}

export function validateRewardLevels(value: unknown): RewardLevel[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) throw new Error("Configure between 1 and 10 reward levels.");
  const seen = new Set<number>();
  return value.map(level => {
    if (!level || typeof level !== "object" || !Number.isInteger(level.stamps) || level.stamps < 1 || level.stamps > 10 || seen.has(level.stamps)) throw new Error("Each reward level needs a unique stamp count from 1 to 10.");
    if (typeof level.name !== "string" || level.name.trim().length < 2 || level.name.trim().length > 120 || typeof level.message !== "string" || level.message.trim().length > 160) throw new Error("Enter a reward name (2–120 characters) and a message of at most 160 characters.");
    seen.add(level.stamps);
    return { stamps: level.stamps, name: level.name.trim(), message: level.message.trim() };
  }).sort((a, b) => a.stamps - b.stamps);
}

export async function effectiveRewardCard<T extends BaseCard>(sql: Sql, customerId: string, card: T) {
  const rows = await sql`SELECT (b.reward_levels_enabled AND b.reward_levels_active) AS reward_levels_enabled, b.reward_levels, b.reward_config_version,
    (SELECT target_stamps FROM customer_loyalties WHERE customer_id=${customerId} AND loyalty_card_id=${card.id} LIMIT 1) AS target_stamps
    FROM businesses b WHERE b.id=${card.business_id}` as Array<{ reward_levels_enabled: boolean; reward_levels: RewardLevel[]; reward_config_version: number; target_stamps: number | null }>;
  const config = rows[0];
  const levels = config?.reward_levels_enabled && Array.isArray(config.reward_levels) ? config.reward_levels : [];
  const chosen = levels.find(level => level.stamps === config.target_stamps) ?? levels[0];
  return { ...card, ...(chosen ? { required_stamps: chosen.stamps, reward_name: chosen.name, reward_description: chosen.message || null } : {}),
    reward_levels: levels, selected_goal: chosen?.stamps ?? null, goal_selection: config?.target_stamps ?? null, reward_config_version: config?.reward_config_version ?? 0 };
}

// Business/configuration mutations and goal selection share the same lock order:
// business first, loyalty second. Completed rewards retain their original promise.
export async function reconcileRewardGoals(sql: Sql, businessId: string, levels?: RewardLevel[], actor?: {id:string;name:string}) {
  const encoded = levels ? JSON.stringify(levels) : null;
  await sql`WITH locked_business AS (
    SELECT * FROM businesses WHERE id=${businessId} FOR UPDATE
  ), business AS (
    UPDATE businesses b SET reward_levels=COALESCE(${encoded}::jsonb,b.reward_levels),
      reward_config_version=b.reward_config_version+CASE WHEN ${encoded}::text IS NULL THEN 0 ELSE 1 END,updated_at=now()
    FROM locked_business lb WHERE b.id=lb.id AND (${encoded}::text IS NULL OR lb.reward_levels_enabled) RETURNING b.*
  ), audit AS (
    INSERT INTO admin_audit_logs(id,actor_id,actor_name,action,entity_type,entity_id,entity_name,reason)
    SELECT ${randomUUID()},${actor?.id ?? null},${actor?.name ?? "Platform"},'reward_levels_change','business',id,name,
      CONCAT('Previous: ',(SELECT reward_levels::text FROM locked_business),'; new: ',${encoded}::text)
    FROM business WHERE ${encoded}::text IS NOT NULL
  ), desired AS (
    SELECT l.id, c.id AS customer_id, lc.id AS card_id, l.current_stamps,
      tier.stamps AS target, COALESCE(tier.stamps,lc.required_stamps) AS required,
      COALESCE(tier.name,lc.reward_name) AS name, COALESCE(tier.message,lc.reward_description) AS message
    FROM business b JOIN customers c ON c.business_id=b.id JOIN customer_loyalties l ON l.customer_id=c.id
    JOIN loyalty_cards lc ON lc.id=l.loyalty_card_id
    LEFT JOIN LATERAL (
      SELECT t.* FROM jsonb_to_recordset(b.reward_levels) AS t(stamps integer,name text,message text)
      WHERE b.reward_levels_enabled AND b.reward_levels_active ORDER BY (t.stamps=l.target_stamps) DESC NULLS LAST,t.stamps LIMIT 1
    ) tier ON true FOR UPDATE OF l
  ), updated AS (
    UPDATE customer_loyalties l SET target_stamps=CASE WHEN l.target_stamps IS NULL THEN NULL ELSE d.target END, updated_at=now() FROM desired d WHERE l.id=d.id RETURNING l.id
  ), cancelled AS (
    UPDATE reward_redemptions r SET status='cancelled' FROM desired d WHERE r.customer_id=d.customer_id AND r.loyalty_card_id=d.card_id AND r.status='ready'
      AND (COALESCE(r.required_stamps_snapshot,d.required)<>d.required OR COALESCE(r.reward_name_snapshot,d.name)<>d.name OR r.description_snapshot IS DISTINCT FROM d.message)
    RETURNING r.id
  ), ready AS (
    INSERT INTO reward_redemptions(id,business_id,customer_id,loyalty_card_id,status,required_stamps_snapshot,reward_name_snapshot,description_snapshot)
    SELECT gen_random_uuid(),${businessId},d.customer_id,d.card_id,'ready',d.required,d.name,d.message FROM desired d
    WHERE d.current_stamps>=d.required AND NOT EXISTS(SELECT 1 FROM reward_redemptions r WHERE r.customer_id=d.customer_id AND r.loyalty_card_id=d.card_id AND r.status='ready' AND r.id NOT IN (SELECT id FROM cancelled))
    RETURNING id,customer_id,reward_name_snapshot
  ) INSERT INTO customer_notifications(id,customer_id,type,title,message,reward_id)
    SELECT CONCAT('reward_ready-',id::text),customer_id,'reward_ready','Reward unlocked',CONCAT('Your reward (',reward_name_snapshot,') is ready. You can choose a higher goal to keep collecting.'),id FROM ready`;
}

export async function saveRewardLevels(sql: Sql, businessId: string, actor: { id: string; name: string }, levels: RewardLevel[]) {
  await reconcileRewardGoals(sql,businessId,levels,actor);
}

export async function selectRewardGoal(sql: Sql, userId: string, customerId: string, stamps: number) {
  const rows = await sql`WITH business AS (
    SELECT b.* FROM businesses b JOIN customers c ON c.business_id=b.id WHERE c.id=${customerId} AND c.user_id=${userId} AND b.status='active' FOR SHARE OF b
  ), choice AS (
    SELECT b.id AS business_id,b.name AS business_name,t.* FROM business b CROSS JOIN LATERAL jsonb_to_recordset(b.reward_levels) AS t(stamps integer,name text,message text)
    WHERE b.reward_levels_enabled AND b.reward_levels_active AND t.stamps=${stamps}
  ), locked AS (
    SELECT l.* FROM customer_loyalties l WHERE l.customer_id=${customerId} AND EXISTS(SELECT 1 FROM choice) FOR UPDATE
  ), changed AS (
    UPDATE customer_loyalties l SET target_stamps=${stamps},updated_at=now() FROM locked k
    WHERE l.id=k.id AND k.target_stamps IS DISTINCT FROM ${stamps} RETURNING l.*
  ), cancelled AS (
    UPDATE reward_redemptions SET status='cancelled' WHERE customer_id=${customerId} AND status='ready' AND EXISTS(SELECT 1 FROM changed) RETURNING id
  ), ready AS (
    INSERT INTO reward_redemptions(id,business_id,customer_id,loyalty_card_id,status,required_stamps_snapshot,reward_name_snapshot,description_snapshot)
    SELECT ${randomUUID()},ch.business_id,${customerId},l.loyalty_card_id,'ready',ch.stamps,ch.name,ch.message FROM changed l CROSS JOIN choice ch WHERE l.current_stamps>=ch.stamps RETURNING id
  ), unlocked_notification AS (
    INSERT INTO customer_notifications(id,customer_id,type,title,message,reward_id)
    SELECT CONCAT('reward_ready-',r.id::text),${customerId},'reward_ready','Reward unlocked',
      CONCAT('Your reward (',ch.name,') is ready. You can redeem it or choose a higher goal.'),r.id FROM ready r CROSS JOIN choice ch
  ), notification AS (
    INSERT INTO customer_notifications(id,customer_id,type,title,message)
    SELECT ${randomUUID()},${customerId},'goal_changed','Reward goal updated',CONCAT('Your goal at ',ch.business_name,' is now ',ch.stamps,' stamps: ',ch.name,'. ',ch.message,' Your collected stamps are unchanged.') FROM changed l CROSS JOIN choice ch
  ) SELECT ch.stamps,ch.name,ch.message,l.current_stamps FROM choice ch CROSS JOIN locked l` as Array<{stamps:number;name:string;message:string;current_stamps:number}>;
  return rows[0] ?? null;
}
