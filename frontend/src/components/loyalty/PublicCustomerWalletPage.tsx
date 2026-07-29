"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Gift,
  Loader2,
  QrCode,
  Star,
} from "lucide-react";
import QRCode from "qrcode";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  getPublicCustomerWallet,
  type PublicCustomerWalletResponse,
} from "@/lib/public";
import { useEcho } from "@/components/echo/echo-provider";

export function PublicCustomerWalletPage({ qrCode }: { qrCode: string }) {
  const echo = useEcho();
  const [data, setData] = useState<PublicCustomerWalletResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Animation / UX state
  const [stampAddedPulse, setStampAddedPulse] = useState(0);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [rewardUnlockedPulse, setRewardUnlockedPulse] = useState(0);
  const [showRewardUnlocked, setShowRewardUnlocked] = useState(false);

  // Track previous values to avoid replaying animations on initial load.
  const prevStampsRef = useRef<number | null>(null);
  const prevRewardUnlockedRef = useRef<boolean | null>(null);
  const didInitRef = useRef(false);

  async function reloadWallet(qrCodeToLoad: string, silent = false) {
    if (!silent) {
      setIsLoading(true);
      setError(null);
      setNotFound(false);
    }

    try {
      const response = await getPublicCustomerWallet(qrCodeToLoad);
      setData(response);

      // trigger animations by comparing against previous values
      const nextCard = response.loyalty_card;
      const nextLoyalty = response.loyalty;

      const required = nextCard?.required_stamps ?? 0;
      const raw = nextLoyalty?.current_stamps ?? 0;
      const nextStamps = required ? Math.min(raw, required) : raw;

      const nextRewardUnlocked =
        !!nextCard && required > 0 ? nextStamps >= required : false;

      const prevStamps = prevStampsRef.current;
      const prevRewardUnlocked = prevRewardUnlockedRef.current;

      if (!didInitRef.current) {
        prevStampsRef.current = nextStamps;
        prevRewardUnlockedRef.current = nextRewardUnlocked;
      } else {
        if (prevStamps !== null && nextStamps > prevStamps) {
          setStampAddedPulse((x) => x + 1);
          setShowPlusOne(true);
          window.setTimeout(() => setShowPlusOne(false), 1600);
        }
        if (prevRewardUnlocked !== null && !prevRewardUnlocked && nextRewardUnlocked) {
          setRewardUnlockedPulse((x) => x + 1);
          setShowRewardUnlocked(true);
          window.setTimeout(() => setShowRewardUnlocked(false), 2200);
        }

        prevStampsRef.current = nextStamps;
        prevRewardUnlockedRef.current = nextRewardUnlocked;
      }

      didInitRef.current = true;
    } catch (unknownError) {
      if (unknownError instanceof ApiError && unknownError.status === 404) {
        setNotFound(true);
        setData(null);
      } else {
        setError("Unable to load wallet right now. Please try again.");
        setData(null);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      if (!qrCode) {
        setQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrCode, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
          color: {
            dark: "#111110",
            light: "#ffffff",
          },
        });

        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    }

    void generate();

    return () => {
      cancelled = true;
    };
  }, [qrCode]);

  // Initial load
  useEffect(() => {
    didInitRef.current = false;
    prevStampsRef.current = null;
    prevRewardUnlockedRef.current = null;

    void reloadWallet(qrCode, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrCode]);

  // Realtime updates via Reverb
  useEffect(() => {
    if (!echo.echo) return;
    const currentCustomerId = data?.customer?.id;
    if (!currentCustomerId) return;

    const channel = `customer.${currentCustomerId}`;

    const onStamp = () => void reloadWallet(qrCode, true);
    const onReward = () => void reloadWallet(qrCode, true);
    const onMembershipDeleted = () => void reloadWallet(qrCode, true);

    const c = echo.echo.private(channel);
    c.listen("StampAdded", onStamp);
    c.listen("RewardRedeemed", onReward);
    c.listen("MembershipDeleted", onMembershipDeleted);

    return () => {
      try {
        c.stopListening("StampAdded");
        c.stopListening("RewardRedeemed");
        c.stopListening("MembershipDeleted");
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo.echo, data?.customer?.id, qrCode]);

  const computed = useMemo(() => {
    const loyalty = data?.loyalty ?? null;
    const loyaltyCard = data?.loyalty_card ?? null;

    const currentStampsRaw = loyalty?.current_stamps ?? 0;
    const requiredStamps = loyaltyCard?.required_stamps ?? 0;
    const currentStamps = requiredStamps
      ? Math.min(currentStampsRaw, requiredStamps)
      : currentStampsRaw;

    const progressPercent = !requiredStamps
      ? 0
      : Math.min(100, Math.round((currentStamps / requiredStamps) * 100));

    const stampCount = Math.max(1, Math.min(requiredStamps || 8, 16));
    const stampSlots = Array.from(
      { length: stampCount },
      (_, index) => index < currentStamps,
    );

    const rewardUnlocked =
      !!loyaltyCard && requiredStamps > 0 ? currentStamps >= requiredStamps : false;

    return {
      business: data?.business ?? null,
      customer: data?.customer ?? null,
      loyalty_card: loyaltyCard,
      loyalty,
      currentStampsRaw,
      requiredStamps,
      currentStamps,
      progressPercent,
      stampCount,
      stampSlots,
      rewardUnlocked,
    };
  }, [data]);

  if (isLoading) {
    return <WalletSkeleton />;
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
        <div className="mx-auto w-full max-w-md space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="size-5 text-amber-500" />
                Wallet not found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This QR code is invalid or the wallet is no longer available.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (error || !data || !computed.business || !computed.customer) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
        <div className="mx-auto w-full max-w-md">
          <Alert className="border-red-500/30 text-red-600">
            {error ?? "Unexpected error while loading wallet."}
          </Alert>
        </div>
      </main>
    );
  }

  const { business, customer, loyalty_card, loyalty, progressPercent } = computed;
  const { stampSlots, currentStamps, requiredStamps } = computed;

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <Card className="overflow-hidden border-white/15">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {business.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${business.name} logo`}
                    className="size-full object-cover"
                    src={business.logo_url}
                  />
                ) : (
                  <Building2 className="size-6 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{business.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {customer.first_name} {customer.last_name}
                </p>
              </div>
            </div>

            <div
              className="rounded-xl border border-white/20 p-4 text-white"
              style={{ backgroundColor: business.primary_color || "#171717" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium opacity-90">
                    Digital loyalty card
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {loyalty_card?.reward_name ?? "Loyalty reward"}
                  </p>
                </div>
                <Badge className="bg-white/20 text-white">
                  <Gift className="size-4" />
                  Reward
                </Badge>
              </div>

              <p className="mt-2 text-sm opacity-90">
                {loyalty_card?.reward_description ?? "No reward description yet."}
              </p>

              {loyalty_card ? (
                <>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>
                        {currentStamps} / {requiredStamps} stamps
                      </span>
                      <span>{progressPercent}%</span>
                    </div>

                    {/* progress bar (animate width change) */}
                    <div className="h-2 overflow-hidden rounded-full bg-white/25">
                      <div
                        key={stampAddedPulse}
                        className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* temporary notifications */}
                    {showPlusOne ? (
                      <div className="pt-1 text-xs font-semibold text-white/95">
                        +1 Stamp added 🎉
                      </div>
                    ) : null}

                    {showRewardUnlocked ? (
                      <div className="pt-1 text-xs font-semibold text-white/95 animate-pulse">
                        Reward unlocked ✨
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {stampSlots.map((filled, index) => (
                      <div
                        key={index}
                        className="flex aspect-square items-center justify-center rounded-md border border-white/30 bg-white/10"
                      >
                        {filled ? (
                          <CheckCircle2 className="size-5 text-white" />
                        ) : (
                          <Star className="size-4 text-white/60" />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-md border border-white/25 bg-white/10 p-3 text-xs">
                  Loyalty card is not configured yet for this business.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your customer QR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <QrCode className="size-4" />
              Present this code to receive stamps
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-center rounded-lg bg-white/90 p-2">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="Customer QR code"
                    className="h-auto w-[320px]"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Generating QR…
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 font-mono text-xs">
                {computed.customer.qr_code}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {loyalty
                ? "Stamps update automatically when business scans your code."
                : "No activity yet. Ask business staff to scan your QR to add your first stamp."}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function WalletSkeleton() {
  return (
    <main className="min-h-screen bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-56 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading wallet...
        </div>
      </div>
    </main>
  );
}
