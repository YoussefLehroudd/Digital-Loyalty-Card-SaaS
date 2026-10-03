import { apiFetch, ApiError, API_BASE_URL } from "@/lib/api";

export const AUTH_TOKEN_STORAGE_KEY = "digital_loyalty_token";

export type UserRole = "platform_admin" | "business_owner" | "customer";

export type Business = {
  id: string;
  slug?: string;
  name: string;
  email: string;
  logo_url: string | null;
  logo_public_id?: string | null;
  hero_image_url?: string | null;
  hero_image_public_id?: string | null;
  hero_image_zoom?: number | null;
  hero_image_position_x?: number | null;
  hero_image_position_y?: number | null;
  google_wallet_show_background?: boolean;
  primary_color: string;
  phone: string | null;
  address: string | null;
  created_at?: string;
};

export type AuthUser = {
  id: string;
  business_id?: string | null;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string | null;
  business: Business | null;
};

export type AuthResponse = {
  token: string;
  token_type: "Bearer";
  user: AuthUser;
};

export type DashboardMetrics = {
  total_customers: number;
  active_customers: number;
  visits_this_month: number;
  rewards_redeemed: number;
  growth: {
    total_customers: number;
    active_customers: number;
    visits_this_month: number;
    rewards_redeemed: number;
  };
};

export type DashboardOverview = {
  business: Pick<
    Business,
    "id" | "name" | "email" | "logo_url" | "logo_public_id" | "primary_color" | "created_at"
  >;
  metrics: DashboardMetrics;
  generated_at: string;
};

export type LoyaltyCard = {
  id: string;
  business_id: string;
  reward_name: string;
  required_stamps: number;
  reward_description: string | null;
  created_at: string;
  updated_at: string;
};

export type LoyaltyCardPayload = {
  reward_name: string;
  required_stamps: number;
  reward_description?: string | null;
};

export type BusinessProfilePayload = {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  primary_color: string;
  hero_image_url?: string | null;
  hero_image_public_id?: string | null;
  hero_image_zoom?: number | null;
  hero_image_position_x?: number | null;
  hero_image_position_y?: number | null;
  google_wallet_show_background?: boolean;
};

export type AccountProfilePayload = {
  name: string;
  email: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

export type RegisterBusinessOwnerPayload = {
  business_name: string;
  business_email: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  device_name?: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
};

const cookieMaxAge = 60 * 60 * 24 * 30;

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  document.cookie = `${AUTH_TOKEN_STORAGE_KEY}=${token}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
}

export function clearStoredToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  document.cookie = `${AUTH_TOKEN_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export function registerBusinessOwner(payload: RegisterBusinessOwnerPayload) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getCookie(name: string) {
  if (typeof window === "undefined") return null;

  const cookieStr = window.document.cookie ?? "";
  const parts = cookieStr.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

function getSanctumCsrfCookieUrl() {
  // DevTools indicates backend route is:
  //   http://localhost:8000/sanctum/csrf-cookie
  // while API_BASE_URL typically includes `/api` already:
  //   http://localhost:8000/api
  // So strip trailing `/api` from API_BASE_URL.
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}/sanctum/csrf-cookie`;
}

export async function logout(token: string) {
  return apiFetch<{ message: string }>("/auth/logout", {
    method: "POST",
    token,
  });
}

export function getCurrentUser(token: string) {
  return apiFetch<{ user: AuthUser }>("/auth/me", {
    token,
  });
}

export function updateAccountProfile(token: string, payload: AccountProfilePayload) {
  return apiFetch<{ message: string; user: AuthUser }>("/auth/profile", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function uploadAccountAvatar(token: string, file: File) {
  const body = new FormData();
  body.append("avatar", file);

  return apiFetch<{
    message: string;
    secure_url: string;
    public_id: string;
    user: AuthUser;
  }>("/auth/avatar", {
    method: "POST",
    token,
    body,
  });
}

export function removeAccountAvatar(token: string) {
  return apiFetch<{ message: string; user: AuthUser }>("/auth/avatar", {
    method: "DELETE",
    token,
  });
}

export function updateAccountPassword(token: string, payload: ChangePasswordPayload) {
  return apiFetch<{ message: string }>("/auth/password", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(payload: ForgotPasswordPayload) {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: ResetPasswordPayload) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDashboardSession(token: string) {
  return apiFetch<{ message: string; user: AuthUser }>("/dashboard/session", {
    token,
  });
}

export function getDashboardOverview(token: string, period = "current_month") {
  return apiFetch<DashboardOverview>(`/dashboard?period=${encodeURIComponent(period)}`, {
    token,
  });
}

export function getBusinessProfile(token: string) {
  return apiFetch<{ business: Business }>("/business/profile", {
    token,
  });
}

export async function updateBusinessProfile(
  token: string,
  payload: BusinessProfilePayload,
) {
  return apiFetch<{ message: string; business: Business }>("/business/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

async function uploadBusinessImage(
  token: string,
  file: File,
  endpoint: "logo" | "hero-image",
) {
  const body = new FormData();
  body.append("logo", file);

  return apiFetch<{
    message: string;
    secure_url: string;
    public_id: string;
    business: Business;
  }>(`/business/profile/${endpoint}`, {
    method: "POST",
    token,
    body,
  });
}

export function uploadBusinessLogo(token: string, file: File) {
  return uploadBusinessImage(token, file, "logo");
}

export function uploadBusinessHeroImage(token: string, file: File) {
  return uploadBusinessImage(token, file, "hero-image");
}

export function getLoyaltyCard(token: string) {
  return apiFetch<{ loyalty_card: LoyaltyCard }>("/loyalty-card", {
    token,
  });
}

async function mutateLoyaltyCard(
  token: string,
  method: "POST" | "PUT",
  payload: LoyaltyCardPayload,
) {
  return apiFetch<{ message: string; loyalty_card: LoyaltyCard }>("/loyalty-card", {
    method,
    token,
    body: JSON.stringify({
      reward_name: payload.reward_name,
      required_stamps: payload.required_stamps,
      reward_description: payload.reward_description ?? null,
    }),
  });
}

export function createLoyaltyCard(token: string, payload: LoyaltyCardPayload) {
  return mutateLoyaltyCard(token, "POST", payload);
}

export function updateLoyaltyCard(token: string, payload: LoyaltyCardPayload) {
  return mutateLoyaltyCard(token, "PUT", payload);
}
