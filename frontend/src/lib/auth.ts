import { apiFetch } from "@/lib/api";

export const AUTH_TOKEN_STORAGE_KEY = "digital_loyalty_token";

export type UserRole = "platform_admin" | "business_owner" | "customer";

export type Business = {
  id: string;
  name: string;
  email: string;
  logo_url: string | null;
  primary_color: string;
  phone: string | null;
  address: string | null;
};

export type AuthUser = {
  id: string;
  business_id?: string | null;
  name: string;
  email: string;
  role: UserRole;
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
};

export type DashboardOverview = {
  business: Pick<Business, "id" | "name" | "email" | "logo_url" | "primary_color">;
  metrics: DashboardMetrics;
  generated_at: string;
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

export function logout(token: string) {
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

export function getDashboardOverview(token: string) {
  return apiFetch<DashboardOverview>("/dashboard", {
    token,
  });
}
