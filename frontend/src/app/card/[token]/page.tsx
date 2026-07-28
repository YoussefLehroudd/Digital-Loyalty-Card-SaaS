"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  classifyPortalError,
  fetchCustomerPortalActivity,
  fetchCustomerPortalCards,
  fetchCustomerPortalProfile,
  fetchCustomerPortalRewards,
  CustomerPortalCardsResponse,
  CustomerPortalErrorType,
  CustomerPortalProfile,
  CustomerPortalRewardsResponse,
} from "@/lib/customerPortal";
import CustomerHeader from "@/components/customer-portal/CustomerHeader";
import LoyaltyCard from "@/components/customer-portal/LoyaltyCard";
import RewardsList from "@/components/customer-portal/RewardsList";
import ActivityList from "@/components/customer-portal/ActivityList";

type ApiState<T> = {
  loading: boolean;
  errorType?: CustomerPortalErrorType;
  data?: T;
};

export default function CustomerCardPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [profile, setProfile] = useState<ApiState<CustomerPortalProfile>>({
    loading: true,
  });

  const [cards, setCards] = useState<ApiState<CustomerPortalCardsResponse[]>>({
    loading: true,
  });

  const [rewards, setRewards] = useState<ApiState<CustomerPortalRewardsResponse>>({
    loading: true,
  });

  const [activity, setActivity] = useState<
    ApiState<{ items: Array<{ id: string; type: string; date: string | null; points?: number }> }>
  >({ loading: true });

  const isValidToken = useMemo(() => token.length > 0, [token]);

  useEffect(() => {
    if (!isValidToken) return;

    let cancelled = false;

    async function run() {
      try {
        const [p, c, r, a] = await Promise.all([
          fetchCustomerPortalProfile(token),
          fetchCustomerPortalCards(token),
          fetchCustomerPortalRewards(token),
          fetchCustomerPortalActivity(token),
        ]);

        if (cancelled) return;

        setProfile({ loading: false, data: p.data });
        setCards({ loading: false, data: c.data });
        setRewards({ loading: false, data: r.data });
        setActivity({ loading: false, data: a.data });
      } catch (err) {
        if (cancelled) return;

        const type = classifyPortalError(err);

        setProfile({ loading: false, errorType: type });
        setCards({ loading: false, errorType: type });
        setRewards({ loading: false, errorType: type });
        setActivity({ loading: false, errorType: type });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isValidToken, token]);

  const anyLoading = profile.loading || cards.loading || rewards.loading || activity.loading;

  const errorType =
    profile.errorType ?? cards.errorType ?? rewards.errorType ?? activity.errorType;

  const errorMessage = useMemo(() => {
    if (!errorType) return null;
    if (errorType === "disabled_token") return "Access to this card has been disabled by the business.";
    if (errorType === "not_found") return "Card not found or expired.";
    if (errorType === "invalid_token") return "Card not found or expired.";
    if (errorType === "unauthenticated") return "Card not found or expired.";
    return "We couldn’t load your card right now.";
  }, [errorType]);

  const primaryColor = profile.data?.business.primary_color ?? "#0f172a";
  const loyalty = profile.data?.loyalty;

  const loyaltyCard = (cards.data && cards.data[0]) || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="px-4 py-6 sm:px-6">
        <div className="mb-6">
          <div className="text-xs font-semibold tracking-wide text-slate-500">
            Loyalty Card
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Your rewards
          </h1>
        </div>

        {anyLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-1/2 mt-3 animate-pulse" />
            <div className="h-24 bg-slate-100 rounded mt-6 animate-pulse" />
          </div>
        ) : errorType ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg"
              style={{ background: primaryColor }}
            >
              ?
            </div>
            <div className="mt-4 text-lg font-semibold text-slate-900">
              {errorMessage}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              If you used a QR code link, ask the business to resend access.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile */}
            {profile.data ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <CustomerHeader
                  name={`${profile.data.customer.first_name} ${profile.data.customer.last_name}`.trim()}
                  tier={profile.data.loyalty.tier}
                  pointsBalance={profile.data.loyalty.current_stamps}
                  avatarUrl={null}
                />
                <div className="mt-3 text-xs text-slate-500">
                  {profile.data.business.name} • Card access
                </div>
              </div>
            ) : null}

            {/* Loyalty card */}
            {profile.data && loyalty && loyaltyCard ? (
              <LoyaltyCard
                businessName={profile.data.business.name ?? ""}
                brandPrimaryColor={profile.data.business.primary_color}
                memberName={`${profile.data.customer.first_name} ${profile.data.customer.last_name}`.trim()}
                cardNumber={null}
                qrCode={loyaltyCard.customer_qr_code}
                rewardName={loyaltyCard.reward_name}
                rewardDescription={loyaltyCard.reward_description}
                progressPercent={loyalty.progress_percent}
                currentStamps={loyalty.current_stamps}
                requiredStamps={loyalty.required_stamps}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Loyalty card details unavailable.
              </div>
            )}

            {/* Rewards */}
            {rewards.data ? (
              <RewardsList
                availableRewards={rewards.data.available}
                history={rewards.data.history}
              />
            ) : null}

            {/* Activity */}
            {activity.data ? <ActivityList items={activity.data.items} /> : null}

            {/* Google Wallet */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    Add to Google Wallet
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Phase 1 placeholder — real pass integration later.
                  </div>
                </div>

                <div
                  className="w-28 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-600"
                  role="button"
                  aria-disabled="true"
                >
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
