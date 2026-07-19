"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Gift,
  Loader2,
  QrCode,
  Star,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  getPublicCustomerWallet,
  type PublicCustomerWalletResponse,
} from "@/lib/public";

export function PublicCustomerWalletPage({ qrCode }: { qrCode: string }) {
  const [data, setData] = useState<PublicCustomerWalletResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
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
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [qrCode]);

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

  if (error || !data) {
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

  const { business, customer, loyalty_card, loyalty } = data;
  const currentStamps = loyalty?.current_stamps ?? 0;
  const requiredStamps = loyalty_card?.required_stamps ?? 0;
  const progressPercent = !requiredStamps
    ? 0
    : Math.min(100, Math.round((currentStamps / requiredStamps) * 100));
  const stampCount = Math.max(1, Math.min(requiredStamps || 8, 16));
  const stampSlots = Array.from(
    { length: stampCount },
    (_, index) => index < currentStamps,
  );

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
                  <p className="text-sm font-medium opacity-90">Digital loyalty card</p>
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
                    <div className="h-2 overflow-hidden rounded-full bg-white/25">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
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
            <div className="rounded-lg border bg-muted/20 p-3 font-mono text-xs">
              {customer.qr_code}
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
