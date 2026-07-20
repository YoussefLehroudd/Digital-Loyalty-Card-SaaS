"use client";

import { useEffect, useMemo, useState } from "react";
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
  };
};

export default function ScannerPage() {
  const { token } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [stampResult, setStampResult] = useState<StampApiResponse["loyalty"] | null>(null);
  const [decodedQr, setDecodedQr] = useState<string | null>(null);
  const [decodedQrDataUrl, setDecodedQrDataUrl] = useState<string | null>(null);

  const qrValue = useMemo(() => decodedQr ?? "", [decodedQr]);

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

  async function handleQrScanned(qrCode: string) {
    setError(null);
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

        {decodedQr ? (
          <div className="rounded-lg border bg-card p-4">
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

              <div>
                <div className="text-xs text-muted-foreground">QR value</div>
                <div className="mt-1 rounded-md border bg-background px-3 py-2 font-mono text-xs text-foreground/90">
                  {decodedQr}
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
              setDecodedQr(null);
              setDecodedQrDataUrl(null);
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
