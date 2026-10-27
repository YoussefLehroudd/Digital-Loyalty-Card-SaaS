import type { getSql } from "@/lib/server/db";

// Additive migration. Lock and DDL share a transaction across concurrent cold starts.
export async function ensureAffiliateSchema(sql: ReturnType<typeof getSql>) {
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(73819264)`,
    sql`CREATE TABLE IF NOT EXISTS affiliates (
      id uuid PRIMARY KEY, name text NOT NULL, code text UNIQUE NOT NULL,
      email text NOT NULL DEFAULT '', commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 1 AND 10000),
      active boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK(code ~ '^[a-z0-9][a-z0-9-]{2,47}$')
    )`,
    sql`CREATE TABLE IF NOT EXISTS affiliate_visits (
      token_hash text PRIMARY KEY, affiliate_id uuid NOT NULL REFERENCES affiliates(id),
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
    )`,
    sql`CREATE INDEX IF NOT EXISTS affiliate_visits_partner ON affiliate_visits(affiliate_id)`,
    sql`CREATE TABLE IF NOT EXISTS affiliate_referrals (
      business_id uuid PRIMARY KEY REFERENCES businesses(id), affiliate_id uuid NOT NULL REFERENCES affiliates(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    sql`CREATE INDEX IF NOT EXISTS affiliate_referrals_partner ON affiliate_referrals(affiliate_id)`,
    sql`CREATE TABLE IF NOT EXISTS affiliate_payouts (
      id uuid PRIMARY KEY, affiliate_id uuid NOT NULL REFERENCES affiliates(id),
      amount_centimes bigint NOT NULL CHECK(amount_centimes > 0), through_month text NOT NULL,
      paid_at timestamptz NOT NULL, reference text NOT NULL, request_hash text NOT NULL,
      actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL, actor_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    sql`CREATE INDEX IF NOT EXISTS affiliate_payouts_partner_date ON affiliate_payouts(affiliate_id, paid_at)`,
    sql`CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), affiliate_id uuid NOT NULL REFERENCES affiliates(id),
      business_id uuid NOT NULL REFERENCES businesses(id), event_id uuid NOT NULL UNIQUE REFERENCES subscription_events(id),
      business_name text NOT NULL, receipt_number text NOT NULL, duration_months integer NOT NULL,
      payment_centimes integer NOT NULL CHECK(payment_centimes > 0), rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 1 AND 10000),
      amount_centimes integer NOT NULL CHECK(amount_centimes >= 0), earned_at timestamptz NOT NULL,
      payout_id uuid REFERENCES affiliate_payouts(id), voided_at timestamptz, void_reason text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(), CHECK(payout_id IS NULL OR voided_at IS NULL)
    )`,
    sql`CREATE INDEX IF NOT EXISTS affiliate_commissions_partner_date ON affiliate_commissions(affiliate_id,earned_at)`,
    sql`CREATE OR REPLACE FUNCTION loyvance_accrue_affiliate_commission() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        -- A free activation / proof submission never earns commission. Payment and commission commit atomically.
        IF NEW.amount_centimes IS NOT NULL AND NEW.amount_centimes > 0
          AND NEW.paid_at IS NOT NULL AND NEW.payment_method IS NOT NULL AND NEW.receipt_number IS NOT NULL THEN
          INSERT INTO affiliate_commissions(affiliate_id,business_id,event_id,business_name,receipt_number,duration_months,
            payment_centimes,rate_bps,amount_centimes,earned_at)
          SELECT a.id,NEW.business_id,NEW.id,b.name,NEW.receipt_number,NEW.duration_months,
            NEW.amount_centimes,a.commission_bps,round(NEW.amount_centimes::numeric*a.commission_bps/10000)::integer,NEW.paid_at
          FROM affiliate_referrals r JOIN affiliates a ON a.id=r.affiliate_id JOIN businesses b ON b.id=r.business_id
          WHERE r.business_id=NEW.business_id AND r.created_at<=NEW.created_at
          ON CONFLICT(event_id) DO NOTHING;
        END IF;
        RETURN NEW;
      END
    $$`,
    sql`CREATE OR REPLACE TRIGGER affiliate_subscription_payment AFTER INSERT ON subscription_events
      FOR EACH ROW EXECUTE FUNCTION loyvance_accrue_affiliate_commission()`,
  ]);
}
