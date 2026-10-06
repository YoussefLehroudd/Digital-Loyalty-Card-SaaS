import type { getSql } from "@/lib/server/db";
import type { BusinessSubscription, SubscriptionDetails } from "@/lib/subscription";

type Sql = ReturnType<typeof getSql>;

export async function ensureSubscriptionSchema(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS business_subscriptions (
    business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    trial_started_at timestamptz NOT NULL, trial_ends_at timestamptz NOT NULL,
    paid_started_at timestamptz, paid_ends_at timestamptz,
    revision integer NOT NULL DEFAULT 0,
    CHECK(trial_ends_at > trial_started_at),
    CHECK((paid_started_at IS NULL AND paid_ends_at IS NULL) OR (paid_started_at IS NOT NULL AND paid_ends_at > paid_started_at))
  )`;
  await sql`CREATE TABLE IF NOT EXISTS subscription_events (
    id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL, actor_name text NOT NULL,
    action text NOT NULL CHECK(action = 'activate'),
    started_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
    previous_started_at timestamptz NOT NULL, previous_ends_at timestamptz NOT NULL,
    previous_state text NOT NULL, note text NOT NULL, reference text NOT NULL DEFAULT '',
    revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(business_id, revision)
  )`;
  // Preserve old activation evidence: its duration was one month, price was not recorded.
  await sql`ALTER TABLE subscription_events ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 1 CHECK(duration_months IN (1,3,6,12))`;
  await sql`ALTER TABLE subscription_events ADD COLUMN IF NOT EXISTS amount_dh integer CHECK(amount_dh > 0)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscription_events_business ON subscription_events(business_id, created_at DESC)`;
  // Bootstrap existing businesses once. ON CONFLICT never restarts a trial on cold starts.
  await sql`INSERT INTO business_subscriptions(business_id,trial_started_at,trial_ends_at)
    SELECT id, now(), now() + interval '14 days' FROM businesses ON CONFLICT(business_id) DO NOTHING`;
}

export async function subscriptionFor(sql: Sql, businessId: string): Promise<BusinessSubscription> {
  // New registrations start their trial at registration, even if first accessed later.
  await sql`INSERT INTO business_subscriptions(business_id,trial_started_at,trial_ends_at)
    SELECT id, created_at, created_at + interval '14 days' FROM businesses WHERE id = ${businessId}
    ON CONFLICT(business_id) DO NOTHING`;
  return (await subscriptionsFor(sql, [businessId]))[0];
}

export async function subscriptionsFor(sql: Sql, businessIds: string[]): Promise<BusinessSubscription[]> {
  if (!businessIds.length) return [];
  const rows = await sql`SELECT business_id, trial_started_at::text, trial_ends_at::text,
    paid_started_at::text, paid_ends_at::text, revision,
    CASE WHEN paid_ends_at IS NOT NULL THEN CASE WHEN paid_ends_at > now() THEN 'active' ELSE 'expired' END
      WHEN trial_ends_at > now() THEN 'trial' ELSE 'expired' END AS state,
    COALESCE(paid_started_at,trial_started_at)::text AS period_started_at,
    COALESCE(paid_ends_at,trial_ends_at)::text AS period_ends_at,
    GREATEST(0,EXTRACT(EPOCH FROM COALESCE(paid_ends_at,trial_ends_at) - now()))::int AS remaining_seconds,
    now()::text AS server_time
    FROM business_subscriptions WHERE business_id = ANY(${businessIds}::uuid[])`;
  return rows as unknown as BusinessSubscription[];
}

export async function subscriptionDetails(sql: Sql, businessId: string): Promise<SubscriptionDetails> {
  const subscription = await subscriptionFor(sql, businessId);
  const rows = await sql`SELECT id, actor_id, actor_name, action, started_at::text, ends_at::text,
    previous_started_at::text, previous_ends_at::text, previous_state, note, reference, duration_months, amount_dh, revision, created_at::text
    FROM subscription_events WHERE business_id = ${businessId} ORDER BY revision DESC`;
  return { subscription, history: rows as unknown as SubscriptionDetails['history'] };
}

export async function requireSubscription(sql: Sql, businessId: string) {
  const subscription = await subscriptionFor(sql, businessId);
  if (!subscription || subscription.state === "expired") throw Response.json({
    message: "Your subscription has expired. Contact the administrator to activate a subscription.",
    code: "SUBSCRIPTION_EXPIRED", subscription,
  }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
