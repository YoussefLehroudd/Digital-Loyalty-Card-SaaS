import { apiFetch } from "@/lib/api";
import type { BusinessSubscription } from "@/lib/subscription";

export const ADMIN_TOKEN_KEY = "loyvance_admin_token";
export type AdminUser = { id: string; name: string; email: string; role: "platform_admin" };
export type AdminRow = { id: string; name: string; email: string; status: "active" | "suspended"; created_at: string; cards: number; stamps?: number; logo_url?: string | null; avatar_url?: string | null; slug?: string; subscription?: BusinessSubscription };
export type AdminList = { data: AdminRow[]; total: number; page: number; per_page: number };
export type AdminDetail = AdminRow & { phone?: string | null; address?: string | null; reward_name?: string; required_stamps?: number; redeemed?: number; cards: number };
export type AdminCustomerDetail = Omit<AdminDetail, "cards"> & { cards: Array<{ id: string; business_name: string; current_stamps: number | null; required_stamps: number | null; reward_name: string | null }> };
export type AdminEvent = { id: string; type: "stamp" | "reward" | "admin"; name: string; business_name: string; title: string; reason: string; date: string };
export type AdminActivity = { data: AdminEvent[]; total: number; page: number; per_page: number };
export type AdminOverview = { data: { stats: { businesses: number; active_businesses: number; customers: number; cards: number; stamps: number; stamps_today: number; redeemed: number; ready_rewards: number }; subscriptions?: {payments_month_centimes: string;subscribed:number;ending_soon:number;pending_requests:number}; trend: Array<{ date: string; stamps: number; rewards: number }>; businesses: Array<Pick<AdminRow, "id" | "name" | "status" | "logo_url" | "cards">> }; generated_at: string };
export type AdminSettings = { data: { account: AdminUser; integrations: Record<"google_wallet" | "apple_wallet" | "email" | "images", boolean>; access: string; refresh_seconds: number } };

export function adminRequest<T>(path: string, token: string, options?: RequestInit) {
  return apiFetch<T>("/admin/" + path, { token, ...options });
}
export function storeAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  document.cookie = `${ADMIN_TOKEN_KEY}=${token}; path=/admin; max-age=2592000; SameSite=Strict${location.protocol === "https:" ? "; Secure" : ""}`;
}
export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  document.cookie = `${ADMIN_TOKEN_KEY}=; path=/admin; max-age=0; SameSite=Strict`;
}

