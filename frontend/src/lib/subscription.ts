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
