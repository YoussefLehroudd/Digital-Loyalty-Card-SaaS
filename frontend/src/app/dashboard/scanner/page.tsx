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
  const [rewardReadyBlocked, setRewardReadyBlocked] = useState(false);

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
    setRewardReadyBlocked(false);
  }

  async function handleQrScanned(qrCode: string) {
    setError(null);
    setRedeeming(false);
    setRewardReadyBlocked(false);
    setDecodedQr(qrCode);

    try {
      const response = await apiFetch<StampApiResponse>("/stamp", {
        method: "POST",
        token,
        body: JSON.stringify({ qr_code: qrCode }),
      });

      setStampResult(response.loyalty);
    } catch (err) {
      if (err instanceof ApiError && err.message.toLowerCase().includes("reward is ready")) {
        setRewardReadyBlocked(true);
        setStampResult({ current_stamps: 1, required_stamps: 1, reward_unlocked: true, reward_redemption_created: false });
        return;
      }
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
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="rounded-2xl border border-[#e7b354]/20 bg-[linear-gradient(145deg,rgba(15,16,13,.92),rgba(8,9,7,.82))] p-5 shadow-[0_18px_55px_rgba(0,0,0,.25)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold leading-tight text-white">
                Staff QR Scanner
              </h1>
              <p className="text-sm text-muted-foreground">
                Scan a customer QR code to add a stamp.
              </p>
            </div>

            <div className="flex size-11 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[#8b5d12]/20 text-[#ffc857]">
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
        <div className="mt-5">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 md:items-start">
            {/* Left: scanner */}
            <div className="min-w-0">
              <StaffQrScanner onQrScanned={handleQrScanned} onResetReady={handleResetReady} />
            </div>

            {/* Right: your customer QR (stretch to match left card height when possible) */}
            <div className="min-w-0 flex">
              <div className="flex h-full min-h-[180px] w-full flex-col rounded-2xl border border-[#e7b354]/20 bg-[linear-gradient(145deg,rgba(15,16,13,.94),rgba(8,9,7,.9))] p-5 shadow-[0_16px_45px_rgba(0,0,0,.25)]">
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
                            className="h-auto w-full max-w-[320px] bg-white p-1"
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
                  <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-[#d69b2d]/25 bg-[#8b5d12]/20 text-[#ffc857] shadow-[0_0_24px_rgba(225,163,44,.08)]">
                      <QrCode className="size-7" />
                    </div>
                    <div className="mt-4 text-[15px] font-bold text-white">Customer QR preview</div>
                    <div className="mt-1 max-w-[280px] text-xs leading-5 text-white/45">
                      Scan a customer loyalty card to display its QR code here.
                    </div>
                    <div className="mt-4 rounded-full border border-[#e7b354]/15 bg-[#e7b354]/[.05] px-3 py-1 text-[10px] font-medium uppercase tracking-[.12em] text-[#ffc857]/75">
                      Waiting for scan
                    </div>
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
              rewardAlreadyReady={rewardReadyBlocked}
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
