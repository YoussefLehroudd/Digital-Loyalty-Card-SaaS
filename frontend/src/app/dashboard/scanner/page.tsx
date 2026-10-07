"use client";

import { useCallback, useRef, useState } from "react";
import { QrCode, XCircle } from "lucide-react";

import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";

import { apiFetch, ApiError } from "@/lib/api";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { OnlineOrderScanner } from "@/components/scanner/OnlineOrderScanner";
import { Button } from "@/components/ui/button";
import { StampResult } from "@/components/scanner/StampResult";
import { ShareLoyaltyLink } from "@/components/loyalty/share-loyalty-link";

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
  const { token, user } = useAuth();
  const [mode, setMode] = useState<"camera" | "image">("camera");

  const [error, setError] = useState<string | null>(null);
  const [stampResult, setStampResult] = useState<StampApiResponse["loyalty"] | null>(null);
  const [decodedQr, setDecodedQr] = useState<string | null>(null);

  const [redeeming, setRedeeming] = useState(false);
  const [rewardReadyBlocked, setRewardReadyBlocked] = useState(false);

  const scanAnotherRef = useRef<(() => void) | null>(null);

  const handleResetReady = useCallback((resetFn: () => void) => {
    scanAnotherRef.current = resetFn;
  }, []);

  function clearResult() {
    setStampResult(null);
    setError(null);
    setDecodedQr(null);
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
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.message.toLowerCase().includes("reward is ready")) {
        setRewardReadyBlocked(true);
        setStampResult({ current_stamps: 1, required_stamps: 1, reward_unlocked: true, reward_redemption_created: false });
        return true;
      }
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to add stamp. Please try again.";

      setError(message);
      return false;
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
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[#8b5d12]/20 text-[#ffc857]">
              <QrCode className="size-5" />
            </div>

            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-bold leading-tight text-white">
                Staff QR Scanner
              </h1>
              <p className="text-sm text-muted-foreground">
                Scan in person or upload a QR image for an online order.
              </p>
            </div>
          </div>

          {error ? (
            <Alert className="mt-4 border-red-500/30 text-red-600">
              <XCircle className="mr-2 size-4 inline" />
              {error}
            </Alert>
          ) : null}
        </div>

        <div className="mx-auto mt-5 max-w-2xl">
          <div className="mb-4"><ShareLoyaltyLink businessId={user.business?.id} name={user.business?.name} /></div>
          <div className="mb-4 grid grid-cols-2 gap-2" aria-label="Scan method">
            <Button variant={mode === "camera" ? "default" : "outline"} aria-pressed={mode === "camera"} onClick={() => { clearResult(); setMode("camera"); }}>Camera scan</Button>
            <Button variant={mode === "image" ? "default" : "outline"} aria-pressed={mode === "image"} onClick={() => { clearResult(); setMode("image"); }}>QR image / online</Button>
          </div>
          {mode === "camera" ? <StaffQrScanner onQrScanned={handleQrScanned} onResetReady={handleResetReady} /> : <OnlineOrderScanner token={token} />}

          {mode === "camera" && stampResult ? (
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
