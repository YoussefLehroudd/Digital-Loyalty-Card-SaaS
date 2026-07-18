"use client";

import { useState } from "react";
import { QrCode, RefreshCw, XCircle } from "lucide-react";

import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

import { apiFetch, ApiError } from "@/lib/api";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { StampResult } from "@/components/scanner/StampResult";

type StampApiResponse = {
  message: string;
  loyalty: {
    current_stamps: number;
    required_stamps: number;
    reward_unlocked: boolean;
    reward_redemption_created: boolean;
  };
};

export default function ScannerPage() {
  const { token } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [stampResult, setStampResult] = useState<StampApiResponse["loyalty"] | null>(null);

  async function handleQrScanned(qrCode: string) {
    setError(null);

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

  return (
    <DashboardShell activeItem="scanner">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
          <Alert className="border-red-500/30 text-red-600">
            <XCircle className="mr-2 size-4 inline" />
            {error}
          </Alert>
        ) : null}

        <StaffQrScanner onQrScanned={handleQrScanned} />

        {stampResult ? (
          <StampResult
            currentStamps={stampResult.current_stamps}
            requiredStamps={stampResult.required_stamps}
            rewardUnlocked={stampResult.reward_unlocked}
          />
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setStampResult(null);
              setError(null);
            }}
          >
            <RefreshCw className="mr-2 size-4" />
            Clear result
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
