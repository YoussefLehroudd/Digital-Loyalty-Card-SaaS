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
};
export type SubscriptionDetails = { subscription: BusinessSubscription; history: SubscriptionEvent[] };
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
