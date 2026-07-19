import { apiFetch } from "@/lib/api";

export type PublicBusiness = {
  id: string;
  slug: string;
  name: string;
  email?: string;
  logo_url: string | null;
  primary_color: string;
};

export type PublicLoyaltyCard = {
  id: string;
  business_id?: string;
  reward_name: string;
  required_stamps: number;
  reward_description: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PublicBusinessLookupResponse = {
  business: PublicBusiness;
  loyalty_card: PublicLoyaltyCard | null;
};

export type PublicCustomerRegisterPayload = {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
};

export type PublicWalletCustomer = {
  id: string;
  business_id?: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  qr_code: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PublicWalletLoyalty = {
  id: string;
  customer_id: string;
  loyalty_card_id: string;
  current_stamps: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PublicCustomerRegisterResponse = {
  message: string;
  customer: PublicWalletCustomer;
  wallet_url?: string;
};

export type PublicCustomerWalletResponse = {
  business: PublicBusiness;
  customer: PublicWalletCustomer;
  loyalty_card: PublicLoyaltyCard | null;
  loyalty: PublicWalletLoyalty | null;
};

export function getPublicBusinessBySlug(slug: string) {
  return apiFetch<PublicBusinessLookupResponse>(`/public/businesses/${slug}`);
}

export function registerPublicCustomer(
  slug: string,
  payload: PublicCustomerRegisterPayload,
) {
  return apiFetch<PublicCustomerRegisterResponse>(
    `/public/businesses/${slug}/customers/register`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function getPublicCustomerWallet(qrCode: string) {
  return apiFetch<PublicCustomerWalletResponse>(`/public/customers/wallet/${qrCode}`);
}
