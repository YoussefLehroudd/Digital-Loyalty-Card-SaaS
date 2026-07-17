import { apiFetch } from "@/lib/api";

export type PublicBusiness = {
  id: string;
  slug: string;
  name: string;
  email: string;
  logo_url: string | null;
  primary_color: string;
};

export type PublicLoyaltyCard = {
  id: string;
  reward_name: string;
  required_stamps: number;
  reward_description: string | null;
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
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  qr_code: string;
};

export type PublicCustomerRegisterResponse = {
  message: string;
  customer: PublicWalletCustomer;
  wallet_url?: string;
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
