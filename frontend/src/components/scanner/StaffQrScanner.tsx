"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, ScanLine } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Result as ZXingResult } from "@zxing/library";
import type { BrowserCodeReader } from "@zxing/library";

export type StaffQrScannerProps = {
  onQrScanned: (qrCode: string) => Promise<void> | void;
  className?: string;
};

type CameraStatus =
  | { state: "idle" }
  | { state: "loading"; message?: string }
  | { state: "permission_denied"; message: string }
  | { state: "error"; message: string };

export function StaffQrScanner({
  onQrScanned,
  className,
}: StaffQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BrowserCodeReader | null>(null);

  // Prevent duplicate scans.
  // Use an immutable session id so any in-flight ZXing callbacks are ignored
  // after we stop the stream and wait for the user to click "Scan another".
  const scanningRef = useRef(false);
  const scanSessionRef = useRef(0);
  const acceptedRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>({
    state: "idle",
  });
  const [isDecoding, setIsDecoding] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const canScan = useMemo(() => !hasScanned && !isDecoding, [hasScanned, isDecoding]);

  const stopDecoding = useCallback(async () => {
    // Destroy/reset ZXing reader instance (do not keep it alive).
    try {
      if (scannerRef.current?.reset) {
        await scannerRef.current.reset();
      }
    } catch {
      // ignore
    }
    scannerRef.current = null;

    // Stop every MediaStream track (camera off).
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
    if (!videoRef.current) return;

    setHasScanned(false);
    setIsDecoding(false);
    scanningRef.current = false;

    scanSessionRef.current += 1;
    const sessionId = scanSessionRef.current;
    acceptedRef.current = false;

    try {
      setCameraStatus({ state: "loading", message: "Starting camera…" });

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

      const video = videoRef.current;
      video.srcObject = stream;

      // Ensure we have dimensions/metadata before starting ZXing.
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve();
        const onLoaded = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        video.addEventListener("loadedmetadata", onLoaded);
      });

      if (video.paused) {
        await video.play();
      }

      // Dynamically import to avoid SSR issues.
      const { BrowserMultiFormatReader } = await import("@zxing/library");

      // Create a fresh reader instance per session.
      const reader = new BrowserMultiFormatReader();
      scannerRef.current = reader;

      // Keep a single outstanding decode attempt at a time.
      const decodeOnce = async (): Promise<void> => {
        // If user started a new session, stop.
        if (sessionId !== scanSessionRef.current) return;
        // If already accepted, stop.
        if (acceptedRef.current) return;

        try {
          // Decode a single frame (single decode).
          const result = await reader.decodeFromVideoElement(video);

          // Ignore any stale results.
          if (sessionId !== scanSessionRef.current) return;
          if (acceptedRef.current) return;

          const raw = result.getText();
          const qr = raw?.trim();
          if (!qr) return;

          // Mark scan completed immediately and lock the session.
          acceptedRef.current = true;
          scanningRef.current = true;
          setIsDecoding(true);
          setHasScanned(true);

          // Destroy/reset ZXing reader instance and stop camera.
          await stopDecoding();

          // Call onQrScanned exactly once.
          await Promise.resolve(onQrScanned(qr));

          setIsDecoding(false);
        } catch {
          // No QR found in this single attempt; schedule another attempt
          // until success or until the user clicks "Scan another".
          if (sessionId !== scanSessionRef.current) return;
          if (acceptedRef.current) return;

          window.setTimeout(() => {
            void decodeOnce();
          }, 150);
        }
      };

      // Begin decoding attempts.
      void decodeOnce();

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
          message:
            "Camera permission denied. Please allow camera access and reload.",
        });
      } else {
        setCameraStatus({ state: "error", message: msg });
      }
    }
  }, [canScan, onQrScanned]);

  useEffect(() => {
    // Start only on client mount.
    void start();

    const currentVideo = videoRef.current;
    const currentStream =
      currentVideo?.srcObject && currentVideo.srcObject instanceof MediaStream
        ? currentVideo.srcObject
        : null;

    return () => {
      void stopDecoding();
      try {
        currentStream?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, stopDecoding]);

  const reset = useCallback(() => {
    setHasScanned(false);
    setIsDecoding(false);
    scanningRef.current = false;
    acceptedRef.current = false;
    void stopDecoding();
    void start();
  }, [start, stopDecoding]);

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
          <Alert className="border-red-500/30 text-red-600">
            {cameraStatus.message}
          </Alert>
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
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={isDecoding}
            >
              Scan another
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
