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

const POLL_MS = 5000;

export function PublicCustomerWalletPage({ qrCode }: { qrCode: string }) {
  const [data, setData] = useState<PublicCustomerWalletResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Animation / UX state
  const [stampAddedPulse, setStampAddedPulse] = useState(0); // key to retrigger
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [rewardUnlockedPulse, setRewardUnlockedPulse] = useState(0);
  const [showRewardUnlocked, setShowRewardUnlocked] = useState(false);

  // Track previous values to avoid replaying animations on refresh / no-change polling.
  const prevStampsRef = useRef<number | null>(null);
  const prevRewardUnlockedRef = useRef<boolean | null>(null);
  const didInitRef = useRef(false);

  async function loadWallet(qrCodeToLoad: string) {
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await getPublicCustomerWallet(qrCodeToLoad);
      if (cancelled) return;

      setData(response);
    } catch (unknownError) {
      if (cancelled) return;

      if (unknownError instanceof ApiError && unknownError.status === 404) {
        setNotFound(true);
        setData(null);
        return;
      }

      setError("Unable to load wallet right now. Please try again.");
      setData(null);
    } finally {
      if (!cancelled) setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }

  async function fetchWalletForPolling(qrCodeToLoad: string) {
    // Keep this polling silent: don't flip isLoading for every poll.
    try {
      const response = await getPublicCustomerWallet(qrCodeToLoad);
      return response;
    } catch {
      return null;
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

  useEffect(() => {
    didInitRef.current = false;
    prevStampsRef.current = null;
    prevRewardUnlockedRef.current = null;

    let intervalId: number | null = null;
    let mounted = true;

    async function init() {
      setIsLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const response = await getPublicCustomerWallet(qrCode);
        if (!mounted) return;
        setData(response);
      } catch (unknownError) {
        if (!mounted) return;

        if (unknownError instanceof ApiError && unknownError.status === 404) {
          setNotFound(true);
          setData(null);
          return;
        }

        setError("Unable to load wallet right now. Please try again.");
        setData(null);
      } finally {
        if (mounted) setIsLoading(false);
        // First load should not trigger animations.
        didInitRef.current = true;
      }
    }

    void init();

    intervalId = window.setInterval(async () => {
      if (!mounted) return;

      const response = await fetchWalletForPolling(qrCode);
      if (!mounted) return;
      if (!response) return;

      setData(response);

      // Compare and trigger animations only when loyalty values change.
      const nextLoyalty = response.loyalty;
      const nextCard = response.loyalty_card;

      const required = nextCard?.required_stamps ?? 0;
      const raw = nextLoyalty?.current_stamps ?? 0;
      const nextStamps = required ? Math.min(raw, required) : raw;

      const nextRewardUnlocked =
        !!nextCard && required > 0 ? nextStamps >= required : false;

      const prevStamps = prevStampsRef.current;
      const prevRewardUnlocked = prevRewardUnlockedRef.current;

      // Avoid animating on first poll right after init (and on refresh).
      if (!didInitRef.current) {
        prevStampsRef.current = nextStamps;
        prevRewardUnlockedRef.current = nextRewardUnlocked;
        return;
      }

      if (prevStamps === null) {
        prevStampsRef.current = nextStamps;
      } else if (nextStamps > prevStamps) {
        setStampAddedPulse((x) => x + 1);
        setShowPlusOne(true);
        setTimeout(() => setShowPlusOne(false), 1600);
        prevStampsRef.current = nextStamps;
      } else {
        prevStampsRef.current = nextStamps;
      }

      if (prevRewardUnlocked === null) {
        prevRewardUnlockedRef.current = nextRewardUnlocked;
      } else if (!prevRewardUnlocked && nextRewardUnlocked) {
        setRewardUnlockedPulse((x) => x + 1);
        setShowRewardUnlocked(true);
        setTimeout(() => setShowRewardUnlocked(false), 2200);
        prevRewardUnlockedRef.current = nextRewardUnlocked;
      } else {
        prevRewardUnlockedRef.current = nextRewardUnlocked;
      }
    }, POLL_MS);

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [qrCode]);

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
