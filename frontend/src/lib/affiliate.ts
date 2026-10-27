export type Affiliate = {
  id: string; name: string; code: string; email: string; commission_bps: number;
  active: boolean; revision: number; created_at: string; visits?: number; referrals?: number;
  month_sales?: number; month_earned?: number; month_paid?: number; due?: number;
};
export type AffiliateCommission = {
  id: string; affiliate_id: string; business_name: string; business_id: string;
  event_id: string; receipt_number: string; duration_months: number;
  payment_centimes: number; rate_bps: number; amount_centimes: number;
  earned_at: string; payout_id: string | null; voided_at: string | null; void_reason: string;
};
export type AffiliatePayout = {
  id: string; amount_centimes: number; through_month: string; paid_at: string;
  reference: string; actor_name: string; created_at: string;
};
export type AffiliateList = {
  data: Affiliate[]; total: number; page: number; month: string;
  summary: { partners: number; referrals: number; month_sales: number; month_earned: number; month_paid: number; due: number };
};
export type AffiliateDetail = {
  affiliate: Affiliate; month: string; page: number;
  commissions: AffiliateCommission[]; commission_total: number;
  referrals: { business_id: string; business_name: string; created_at: string }[]; referral_total: number;
  payouts: AffiliatePayout[]; payout_total: number;
  settlement: { ids: string[]; amount_centimes: number };
};
export function commissionRate(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return bps > 0 && bps <= 10000 ? bps : null;
}
export function affiliateMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
}
