export const SUBSCRIPTION_PLANS = [
  { months: 1, price: 149, label: "1 month" },
  { months: 3, price: 399, label: "3 months" },
  { months: 6, price: 749, label: "6 months" },
  { months: 12, price: 1299, label: "12 months" },
] as const;
export type SubscriptionMonths = typeof SUBSCRIPTION_PLANS[number]["months"];
export function subscriptionPlan(months: unknown) {
  return SUBSCRIPTION_PLANS.find(plan => plan.months === months);
}
export function subscriptionDuration(months: number) {
  return months === 1 ? "1 month" : `${months} months`;
}
export type BusinessSubscription = {
  business_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  paid_started_at: string | null;
  paid_ends_at: string | null;
  revision: number;
  state: "trial" | "active" | "expired";
  period_started_at: string;
  period_ends_at: string;
  remaining_seconds: number;
  server_time: string;
};
export type SubscriptionEvent = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: "activate";
  duration_months: number;
  amount_dh: number | null;
  started_at: string;
  ends_at: string;
  previous_started_at: string;
  previous_ends_at: string;
  previous_state: string;
  note: string;
  reference: string;
  revision: number;
  created_at: string;
  mode: "extend" | "replace";
  amount_centimes: number | null;
  payment_method: string | null;
  paid_at: string | null;
  receipt_number: string | null;
  renewal_request_id: string | null;
};
export type RenewalRequest = { id: string; business_id: string; business_name?: string; duration_months: SubscriptionMonths; plan_price_dh: number; reference: string; note: string; status: "pending" | "approved" | "rejected"; created_at: string; reviewed_at: string | null; review_note: string; actor_name: string | null; has_proof: boolean };
export type SubscriptionDetails = { subscription: BusinessSubscription; history: SubscriptionEvent[]; requests: RenewalRequest[] };
export const PAYMENT_METHODS = [{value:"bank_transfer",label:"Bank transfer"},{value:"cash_plus",label:"Cash Plus"},{value:"cash",label:"Cash"},{value:"other",label:"Other"}] as const;
export function paymentAmount(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole)*100 + Number(fraction.padEnd(2,"0"));
  return amount > 0 && amount <= 10000000 ? amount : null;
}
export function money(centimes: number) { return new Intl.NumberFormat("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}).format(centimes/100)+" DH"; }
export function subscriptionDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

export function subscriptionExactDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false }).format(new Date(value)) + " UTC";
}

export function subscriptionUrgency(s: Pick<BusinessSubscription, "state" | "remaining_seconds">) {
  return s.state === "expired" || s.remaining_seconds <= 0 ? "expired" : s.remaining_seconds <= 3 * 86400 ? "ending" : "normal";
}
export function subscriptionRemaining(seconds: number) {
  if (seconds <= 0) return "Expired";
  if (seconds <= 3600) return `${Math.ceil(seconds / 60)} min remaining`;
  if (seconds <= 86400) return `${Math.ceil(seconds / 3600)} hours remaining`;
  return `${Math.ceil(seconds / 86400)} days remaining`;
}
export function subscriptionContact(name: string) {
  return "https://wa.me/212644819899?text=" + encodeURIComponent(`Hello, I would like to renew my LOYVANCE subscription for ${name}.`);
}

