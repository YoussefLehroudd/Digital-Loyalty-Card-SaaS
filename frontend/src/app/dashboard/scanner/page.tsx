"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QrCode, RefreshCw, XCircle } from "lucide-react";

import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

import { apiFetch, ApiError } from "@/lib/api";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { StampResult } from "@/components/scanner/StampResult";
import QRCode from "qrcode";

type StampApiResponse = {
  message: string;
  loyalty: {
    current_stamps: number;
    required_stamps: number;
    reward_unlocked: boolean;
    reward_redemption_created: boolean;
    reward_redeemed?: boolean;
  };
};

export default function ScannerPage() {
  const { token } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [stampResult, setStampResult] = useState<StampApiResponse["loyalty"] | null>(null);
  const [decodedQr, setDecodedQr] = useState<string | null>(null);
  const [decodedQrDataUrl, setDecodedQrDataUrl] = useState<string | null>(null);

  const [redeeming, setRedeeming] = useState(false);

  const scanAnotherRef = useRef<(() => void) | null>(null);

  const qrValue = useMemo(() => decodedQr ?? "", [decodedQr]);

  const handleResetReady = useCallback((resetFn: () => void) => {
    scanAnotherRef.current = resetFn;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      if (!decodedQr) {
        setDecodedQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrValue, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
          color: {
            dark: "#111110",
            light: "#ffffff",
          },
        });

        if (!cancelled) setDecodedQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setDecodedQrDataUrl(null);
      }
    }

    void generate();

    return () => {
      cancelled = true;
    };
  }, [decodedQr, qrValue]);

  function clearResult() {
    setStampResult(null);
    setError(null);
    setDecodedQr(null);
    setDecodedQrDataUrl(null);
  }

  async function handleQrScanned(qrCode: string) {
    setError(null);
    setRedeeming(false);
    setDecodedQr(qrCode);

    try {
      const response = await apiFetch<StampApiResponse>("/stamp", {
        method: "POST",
        token,
        body: JSON.stringify({ qr_code: qrCode }),
      });

      setStampResult(response.loyalty);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to add stamp. Please try again.";

      setError(message);
    }
  }

  async function handleRedeemReward() {
    if (!decodedQr) return;
    if (!token) return;

    setError(null);
    setRedeeming(true);

    try {
      const response = await apiFetch<StampApiResponse & { reward_redeemed?: boolean }>("/redeem-reward", {
        method: "POST",
        token,
        body: JSON.stringify({ qr_code: decodedQr }),
      });

      // backend returns `loyalty` plus `reward_redeemed` at top-level; merge it into loyalty for StampResult.
      const nextLoyalty = response.loyalty;
      const rewardRedeemedFlag =
        (response as unknown as { reward_redeemed?: boolean }).reward_redeemed ?? false;

      setStampResult({
        ...nextLoyalty,
        reward_redeemed: rewardRedeemedFlag,
      } as StampApiResponse["loyalty"]);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to redeem reward. Please try again.";

      setError(message);
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <DashboardShell activeItem="scanner">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-2">
        <div className="w-full flex-none">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold leading-tight">
                Staff QR Scanner
              </h1>
              <p className="text-sm text-muted-foreground">
                Scan a customer QR code to add a stamp.
              </p>
            </div>

            <div className="text-muted-foreground">
              <QrCode className="size-5" />
            </div>
          </div>

          {error ? (
            <Alert className="mt-4 border-red-500/30 text-red-600">
              <XCircle className="mr-2 size-4 inline" />
              {error}
            </Alert>
          ) : null}
        </div>

        {/* Desktop (md+): 2 columns side-by-side; no internal scroll.
            Mobile: single column; allow normal page scrolling. */}
        <div className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 md:items-start">
            {/* Left: scanner */}
            <div className="min-w-0">
              <StaffQrScanner onQrScanned={handleQrScanned} onResetReady={handleResetReady} />
            </div>

            {/* Right: your customer QR (stretch to match left card height when possible) */}
            <div className="min-w-0 flex">
              <div className="w-full h-full rounded-lg border bg-card p-4 flex flex-col">
                {decodedQr ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Your customer QR</div>
                        <div className="text-xs text-muted-foreground">
                          Scan this QR to receive stamps
                        </div>
                      </div>
                      <div className="text-muted-foreground">
                        <QrCode className="size-5" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
                      <div className="flex items-center justify-center rounded-md border bg-background p-3">
                        {decodedQrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={decodedQrDataUrl}
                            alt="Customer QR code"
                            className="h-auto w-[320px] bg-white p-1"
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">Generating QR…</div>
                        )}
                      </div>

                      <div className="w-full sm:col-span-2">
                        <div className="text-xs text-muted-foreground text-center">QR value</div>
                        <div className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-center text-xs text-foreground/90 whitespace-normal break-all">
                          {decodedQr}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-center text-sm text-muted-foreground">
                    <div className="font-medium">Your customer QR</div>
                    <div className="mt-1">Scan this QR to receive stamps</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal (contains Close + Scan another) */}
          {stampResult ? (
            <StampResult
              currentStamps={stampResult.current_stamps}
              requiredStamps={stampResult.required_stamps}
              rewardUnlocked={stampResult.reward_unlocked}
              rewardRedeemed={stampResult.reward_redeemed}
              redeeming={redeeming}
              onRedeemReward={handleRedeemReward}
              onClose={clearResult}
              onScanAnother={() => {
                clearResult();
                scanAnotherRef.current?.();
              }}
            />
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
