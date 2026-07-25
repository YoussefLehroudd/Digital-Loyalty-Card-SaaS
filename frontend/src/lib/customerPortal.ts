import { apiFetch } from "@/lib/api";

export type CustomerPortalProfile = {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    qr_code: string | null;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
  };
  loyalty: {
    current_stamps: number;
    required_stamps: number;
    progress_percent: number;
    tier: string;
  };
  totals: {
    total_visits: number;
    last_visit_at: string | null;
  };
};

export type CustomerPortalCardsResponse = {
  id: string;
  business_id: string;
  reward_name: string | null;
  required_stamps: number;
  reward_description: string | null;
  progress_percent: number;
  current_stamps: number;
  business: {
    id: string | null;
    name: string | null;
    logo_url: string | null;
    primary_color: string | null;
  };
  customer_qr_code: string | null;
};

export type CustomerPortalRewardsResponse = {
  available: Array<{
    reward_name: string | null;
    reward_description: string | null;
    points_required: number;
    ready: boolean;
  }>;
  history: Array<{
    id: string;
    status: "collecting" | "ready" | "redeemed";
    earned_at: string | null;
    redeemed_at: string | null;
  }>;
};

export type CustomerPortalActivityResponse = {
  items: Array<{
    id: string;
    type: string;
    date: string | null;
    points?: number;
  }>;
};

export type CustomerPortalResponseShape<T> = {
  data: T;
  meta?: unknown;
  summary?: unknown;
};

export type CustomerPortalErrorType =
  | "invalid_token"
  | "disabled_token"
  | "not_found"
  | "unauthenticated"
  | "api_error";

export function classifyPortalError(err: unknown): CustomerPortalErrorType {
  const maybe = err as {
    message?: unknown;
    status?: unknown;
  };

  const message =
    typeof maybe?.message === "string"
      ? maybe.message.toLowerCase()
      : "";

  const status = typeof maybe?.status === "number" ? maybe.status : undefined;

  // Our backend token middleware returns: {"message":"Unauthenticated."} 401
  if (status === 401) return "unauthenticated";
  if (status === 404) return "not_found";
  if (message.includes("unauthenticated")) return "unauthenticated";

  // Fallback: treat as generic api_error
  return "api_error";
}

export async function fetchCustomerPortalProfile(token: string) {
  return apiFetch<CustomerPortalResponseShape<CustomerPortalProfile>>(
    "/customer/portal/profile",
    { token },
  );
}

export async function fetchCustomerPortalCards(token: string) {
  return apiFetch<CustomerPortalResponseShape<CustomerPortalCardsResponse[]>>(
    "/customer/portal/cards",
    { token },
  );
}

export async function fetchCustomerPortalRewards(token: string) {
  return apiFetch<CustomerPortalResponseShape<CustomerPortalRewardsResponse>>(
    "/customer/portal/rewards",
    { token },
  );
}

export async function fetchCustomerPortalActivity(token: string) {
  return apiFetch<CustomerPortalResponseShape<CustomerPortalActivityResponse>>(
    "/customer/portal/activity",
    { token },
  );
}
