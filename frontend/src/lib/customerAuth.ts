import { apiFetch } from "@/lib/api";

export const CUSTOMER_AUTH_TOKEN_STORAGE_KEY = "digital_loyalty_customer_token";

const cookieMaxAge = 60 * 60 * 24 * 30;

export type CustomerNotificationPreferences = {
  email_updates: boolean;
  reward_alerts: boolean;
  promotions: boolean;
  push_enabled: boolean;
};

export type CustomerUiPreferences = {
  dark_mode: boolean;
};

export type CustomerPreferences = {
  notifications: CustomerNotificationPreferences;
  ui: CustomerUiPreferences;
};

export type CustomerProfile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  preferences: CustomerPreferences | null;
};

export type CustomerUser = {
  id: string;
  name: string;
  email: string;
  role: "customer";
  customer_profile: CustomerProfile | null;
};

export type CustomerAuthResponse = {
  token: string;
  token_type: "Bearer";
  user: CustomerUser;
};

export type CustomerRegisterPayload = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string | null;
  avatar_url?: string | null;
  preferences?: CustomerPreferences | null;
  device_name?: string;
};

export type CustomerLoginPayload = {
  email: string;
  password: string;
  device_name?: string;
};

export type CustomerUpdateProfilePayload = {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
  preferences?: CustomerPreferences | null;
};

export type CustomerChangePasswordPayload = {
  old_password: string;
  new_password: string;
  new_password_confirmation: string;
};

export function getStoredCustomerToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CUSTOMER_AUTH_TOKEN_STORAGE_KEY);
}

export function storeCustomerToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOMER_AUTH_TOKEN_STORAGE_KEY, token);
  document.cookie = `${CUSTOMER_AUTH_TOKEN_STORAGE_KEY}=${token}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
}

export function clearStoredCustomerToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CUSTOMER_AUTH_TOKEN_STORAGE_KEY);
  document.cookie = `${CUSTOMER_AUTH_TOKEN_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export function customerRegister(payload: CustomerRegisterPayload) {
  return apiFetch<CustomerAuthResponse>("/user/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function customerLogin(payload: CustomerLoginPayload) {
  return apiFetch<CustomerAuthResponse>("/user/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function customerLogout(token: string) {
  return apiFetch<{ message: string }>("/user/logout", {
    method: "POST",
    token,
  });
}

export function customerMe(token: string) {
  return apiFetch<{ user: CustomerUser }>("/user/me", {
    token,
  });
}

export function customerUpdateProfile(token: string, payload: CustomerUpdateProfilePayload) {
  return apiFetch<{ message: string; user: CustomerUser }>("/user/profile", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function customerChangePassword(token: string, payload: CustomerChangePasswordPayload) {
  return apiFetch<{ message: string }>("/user/password", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export type CustomerCardItem = {
  id: string;
  customer_id: string;
  business: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    hero_image_url: string | null;
    hero_image_zoom: number | null;
    hero_image_position_x: number | null;
    hero_image_position_y: number | null;
  };
  membership: {
    qr_code: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  loyalty_card: {
    id: string;
    business_id: string;
    reward_name: string;
    required_stamps: number;
    reward_description: string | null;
  } | null;
  loyalty: {
    id: string;
    current_stamps: number;
    required_stamps: number;
    progress_percent: number;
  } | null;
  qr: {
    qr_code: string | null;
  };
};

export function customerCards(token: string) {
  return apiFetch<{ data: CustomerCardItem[] }>("/user/cards", { token });
}

export function customerCardById(token: string, id: string) {
  return apiFetch<{ data: CustomerCardItem }>("/user/cards/" + id, { token });
}

export function customerDeleteCard(token: string, membershipId: string) {
  return apiFetch<{ message: string }>(`/user/cards/${membershipId}`, {
    method: "DELETE",
    token,
  });
}

export function customerRewards(token: string) {
  return apiFetch<{
    data: {
      available: Array<{
        loyalty_card_id: string;
        business_id: string;
        business_name: string;
        business_logo_url: string | null;
        business_primary_color: string | null;
        reward_name: string;
        reward_description: string | null;
        points_required: number;
        current_stamps: number;
        progress_percent: number;
        ready: boolean;
      }>;
      history: Array<{
        id: string;
        status: string;
        business_id: string;
        customer_id: string;
        business_name: string;
        business_logo_url: string | null;
        business_primary_color: string | null;
        reward_name: string;
        reward_description: string | null;
        points_required: number;
        earned_at: string | null;
        redeemed_at: string | null;
      }>;
    };
  }>("/user/rewards", { token });
}

export function customerActivity(token: string) {
  return apiFetch<{
    data: {
      items: Array<{
        id: string;
        type: string;
        business_id: string;
        customer_id: string;
        date: string | null;
        points?: number;
      }>;
    };
  }>("/user/activity", { token });
}

export function customerNotifications(token: string) {
  return apiFetch<{ data: unknown[] }>("/user/notifications", { token });
}

export function customerJoinByQr(token: string, qr: string) {
  return apiFetch<{
    message: string;
    business: { id: string; slug: string; name: string };
    customer: { id: string; qr_code: string | null };
    loyalty_card: { id: string; business_id: string } | null;
    loyalty: {
      id: string;
      customer_id: string;
      loyalty_card_id: string;
      current_stamps: number;
    } | null;
  }>("/user/join-by-qr", {
    method: "POST",
    token,
    body: JSON.stringify({ qr }),
  });
}

export function customerBusinesses(token: string) {
  return apiFetch<{
    data: Array<{
      business: { id: string };
      membership: {
        customer_id: string;
        qr_code: string | null;
        first_name: string | null;
        last_name: string | null;
      };
      card: {
        id: string;
        reward_name: string;
        required_stamps: number;
        reward_description: string | null;
      } | null;
      loyalty_status: {
        current_stamps: number;
        progress_percent: number;
        required_stamps: number;
      };
    }>;
  }>("/user/businesses", { token });
}

export function defaultCustomerPreferences(
  source?: CustomerPreferences | Record<string, unknown> | null,
): CustomerPreferences {
  const raw = (source ?? {}) as Record<string, unknown>;
  const notifications = (raw.notifications ?? {}) as Record<string, unknown>;
  const ui = (raw.ui ?? {}) as Record<string, unknown>;

  return {
    notifications: {
      email_updates: Boolean(notifications.email_updates ?? true),
      reward_alerts: Boolean(notifications.reward_alerts ?? true),
      promotions: Boolean(notifications.promotions ?? false),
      push_enabled: Boolean(notifications.push_enabled ?? true),
    },
    ui: {
      dark_mode: Boolean(ui.dark_mode ?? false),
    },
  };
}
