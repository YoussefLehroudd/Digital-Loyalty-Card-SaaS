"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, ScanLine } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrowserCodeReader } from "@zxing/library";

export type StaffQrScannerProps = {
  onQrScanned: (qrCode: string) => Promise<void> | void;
  className?: string;
  /**
   * Optional escape hatch for parent UI:
   * lets the parent trigger the existing "Scan another" reset without changing scan lifecycle.
   */
  onResetReady?: (reset: () => void) => void;
};

type CameraStatus =
  | { state: "idle" }
  | { state: "loading"; message?: string }
  | { state: "permission_denied"; message: string }
  | { state: "error"; message: string };

export function StaffQrScanner({
  onQrScanned,
  className,
  onResetReady,
}: StaffQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BrowserCodeReader | null>(null);

  const startingRef = useRef(false);
  const scanSessionRef = useRef(0);
  const acceptedRef = useRef(false);
  const hasScannedRef = useRef(false);
  const lastAcceptedQrRef = useRef<{ value: string; at: number } | null>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>({
    state: "idle",
  });
  const [isDecoding, setIsDecoding] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const canScan = useMemo(() => !hasScanned && !isDecoding, [hasScanned, isDecoding]);

  const stopDecoding = useCallback(async () => {
    // Destroy/reset ZXing reader instance and stop camera tracks.
    try {
      if (scannerRef.current?.reset) {
        await scannerRef.current.reset();
      }
    } catch {
      // ignore
    } finally {
      scannerRef.current = null;
    }

    try {
      const currentVideo = videoRef.current;
      const stream =
        currentVideo?.srcObject && currentVideo.srcObject instanceof MediaStream
          ? currentVideo.srcObject
          : null;

      stream?.getTracks().forEach((t) => t.stop());
      if (currentVideo) currentVideo.srcObject = null;
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (startingRef.current) return;

    startingRef.current = true;

    // New session: invalidate prior attempts.
    scanSessionRef.current += 1;
    const sessionId = scanSessionRef.current;
    acceptedRef.current = false;
    hasScannedRef.current = false;

    setHasScanned(false);
    setIsDecoding(false);
    try {
      setCameraStatus({ state: "loading", message: "Starting camera…" });

      // Stop any previous stream/reader before starting a new one.
      await stopDecoding();

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus({
          state: "error",
          message: "Camera API is not supported in this browser.",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      video.srcObject = stream;

      // Ensure video metadata is fully loaded before ZXing decode.
      // ZXing will handle playback internally after metadata readiness.
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve();
        const onLoaded = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        video.addEventListener("loadedmetadata", onLoaded);
      });

      const { BrowserMultiFormatReader } = await import("@zxing/library");
      const reader = new BrowserMultiFormatReader();
      scannerRef.current = reader;

      const decodeUntilSuccessOrReset = async (): Promise<void> => {
        // If session changed or already accepted, do nothing.
        if (sessionId !== scanSessionRef.current) return;
        if (acceptedRef.current) return;

        try {
          const result = await reader.decodeFromVideoElement(video);

          if (sessionId !== scanSessionRef.current) return;
          if (acceptedRef.current) return;

          const raw = result?.getText?.();
          const qr = raw?.trim();
          if (!qr) {
            // No usable QR: try again after a short delay.
            window.setTimeout(() => {
              void decodeUntilSuccessOrReset();
            }, 150);
            return;
          }

          // Ignore an accidental immediate re-scan of the same QR across scanner resets.
          const previous = lastAcceptedQrRef.current;
          const now = Date.now();
          if (previous?.value === qr && now - previous.at < 2500) {
            window.setTimeout(() => { void decodeUntilSuccessOrReset(); }, 250);
            return;
          }

          // First successful QR for this session.
          lastAcceptedQrRef.current = { value: qr, at: now };
          acceptedRef.current = true;
          hasScannedRef.current = true;
          setIsDecoding(true);
          setHasScanned(true);

          // Destroy reader + stop camera.
          await stopDecoding();

          // Ensure callback fires exactly once.
          await Promise.resolve(onQrScanned(qr));

          if (sessionId === scanSessionRef.current) {
            setIsDecoding(false);
          }
        } catch {
          // No QR detected in this attempt: schedule another single decode attempt.
          if (sessionId !== scanSessionRef.current) return;
          if (acceptedRef.current) return;

          window.setTimeout(() => {
            void decodeUntilSuccessOrReset();
          }, 150);
        }
      };

      // Kick off decode attempts.
      void decodeUntilSuccessOrReset();

      setCameraStatus({ state: "idle" });
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Camera error.";

      if (
        msg.toLowerCase().includes("denied") ||
        msg.toLowerCase().includes("permission")
      ) {
        setCameraStatus({
          state: "permission_denied",
          message: "Camera permission denied. Please allow camera access and reload.",
        });
      } else {
        setCameraStatus({ state: "error", message: msg });
      }
    } finally {
      startingRef.current = false;
    }
  }, [canScan, onQrScanned, stopDecoding]);

  useEffect(() => {
    // Auto-start on mount.
    void start();

    return () => {
      // Cleanup: stop camera + reader.
      void stopDecoding();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    // Disable until stop completes, then start a fresh session.
    void (async () => {
      acceptedRef.current = true; // block in-flight decode promises
      await stopDecoding();
      // allow a brand new session
      acceptedRef.current = false;
      void start();
    })();
  }, [start, stopDecoding]);

  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  }, [reset]);

  // Expose reset trigger once to avoid parent/state feedback loops.
  useEffect(() => {
    if (!onResetReady) return;
    onResetReady(() => resetRef.current());
     
  }, [onResetReady]);

  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="size-4 text-muted-foreground" />
          Scan customer QR code
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {cameraStatus.state === "permission_denied" ? (
          <Alert className="border-red-500/30 text-red-600">
            {cameraStatus.message}
          </Alert>
        ) : null}

        {cameraStatus.state === "error" ? (
          <Alert className="border-red-500/30 text-red-600">{cameraStatus.message}</Alert>
        ) : null}

        {cameraStatus.state === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {cameraStatus.message ?? "Loading camera…"}
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-lg border bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-[320px] w-full object-cover"
          />
          {/* overlay guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-lg border-2 border-primary/70 shadow-[0_0_0_999px_rgba(0,0,0,0.0)]" />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {hasScanned ? "QR detected." : "Align the QR code within the frame."}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={isDecoding}>
              Scan another
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
