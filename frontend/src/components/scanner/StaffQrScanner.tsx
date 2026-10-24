"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RefreshCw, ScanLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrowserCodeReader } from "@zxing/library";
export type StaffQrScannerProps = {
    onQrScanned: (qrCode: string) => Promise<boolean> | boolean;
    className?: string;
    /**
     * Optional escape hatch for parent UI:
     * lets the parent trigger the existing "Scan another" reset without changing scan lifecycle.
     */
    onResetReady?: (reset: () => void) => void;
};
type CameraStatus = {
    state: "idle";
} | {
    state: "loading";
    message?: string;
} | {
    state: "permission_denied";
    message: string;
} | {
    state: "error";
    message: string;
};
export function StaffQrScanner({ onQrScanned, className, onResetReady, }: StaffQrScannerProps) {
    const { t: tr } = useI18n();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const scannerRef = useRef<BrowserCodeReader | null>(null);
    const startingRef = useRef(false);
    const scanSessionRef = useRef(0);
    const acceptedRef = useRef(false);
    const hasScannedRef = useRef(false);
    const [cameraStatus, setCameraStatus] = useState<CameraStatus>({
        state: "idle",
    });
    const [isDecoding, setIsDecoding] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const stopDecoding = useCallback(async () => {
        // Destroy/reset ZXing reader instance and stop camera tracks.
        try {
            if (scannerRef.current?.reset) {
                await scannerRef.current.reset();
            }
        }
        catch {
            // ignore
        }
        finally {
            scannerRef.current = null;
        }
        try {
            const currentVideo = videoRef.current;
            const stream = currentVideo?.srcObject && currentVideo.srcObject instanceof MediaStream
                ? currentVideo.srcObject
                : null;
            stream?.getTracks().forEach((t) => t.stop());
            if (currentVideo)
                currentVideo.srcObject = null;
        }
        catch {
            // ignore
        }
    }, []);
    const start = useCallback(async () => {
        const video = videoRef.current;
        if (!video)
            return;
        if (startingRef.current)
            return;
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
                if (video.readyState >= 2)
                    return resolve();
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
                if (sessionId !== scanSessionRef.current)
                    return;
                if (acceptedRef.current)
                    return;
                try {
                    const result = await reader.decodeFromVideoElement(video);
                    if (sessionId !== scanSessionRef.current)
                        return;
                    if (acceptedRef.current)
                        return;
                    const raw = result?.getText?.();
                    const qr = raw?.trim();
                    if (!qr) {
                        // No usable QR: try again after a short delay.
                        window.setTimeout(() => {
                            void decodeUntilSuccessOrReset();
                        }, 150);
                        return;
                    }
                    // Pause this scan while the backend validates the QR.
                    acceptedRef.current = true;
                    setIsDecoding(true);
                    // Stop camera before submitting so the same QR cannot be sent twice.
                    await stopDecoding();
                    // Only show success feedback after the backend confirms this is a valid LOYVANCE QR.
                    const isValid = await Promise.resolve(onQrScanned(qr));
                    if (sessionId !== scanSessionRef.current)
                        return;
                    if (isValid) {
                        hasScannedRef.current = true;
                        setHasScanned(true);
                        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                            navigator.vibrate(80);
                        }
                        try {
                            const AudioContextClass = window.AudioContext ||
                                (window as typeof window & {
                                    webkitAudioContext?: typeof AudioContext;
                                }).webkitAudioContext;
                            if (AudioContextClass) {
                                const audioContext = new AudioContextClass();
                                const now = audioContext.currentTime;
                                const gain = audioContext.createGain();
                                gain.gain.setValueAtTime(0.0001, now);
                                gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
                                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
                                gain.connect(audioContext.destination);
                                [880, 1174].forEach((frequency, index) => {
                                    const oscillator = audioContext.createOscillator();
                                    oscillator.type = "sine";
                                    oscillator.frequency.value = frequency;
                                    oscillator.connect(gain);
                                    oscillator.start(now + index * 0.08);
                                    oscillator.stop(now + 0.14 + index * 0.08);
                                });
                                window.setTimeout(() => void audioContext.close(), 350);
                            }
                        }
                        catch {
                            // Audio feedback is optional.
                        }
                    }
                    else {
                        setHasScanned(false);
                    }
                    setIsDecoding(false);
                }
                catch {
                    // No QR detected in this attempt: schedule another single decode attempt.
                    if (sessionId !== scanSessionRef.current)
                        return;
                    if (acceptedRef.current)
                        return;
                    window.setTimeout(() => {
                        void decodeUntilSuccessOrReset();
                    }, 150);
                }
            };
            // Kick off decode attempts.
            void decodeUntilSuccessOrReset();
            setCameraStatus({ state: "idle" });
        }
        catch (err: unknown) {
            const msg = typeof err === "object" &&
                err !== null &&
                "message" in err &&
                typeof (err as {
                    message?: unknown;
                }).message === "string"
                ? (err as {
                    message: string;
                }).message
                : "Camera error.";
            if (msg.toLowerCase().includes("denied") ||
                msg.toLowerCase().includes("permission")) {
                setCameraStatus({
                    state: "permission_denied",
                    message: "Camera permission denied. Please allow camera access and reload.",
                });
            }
            else {
                setCameraStatus({ state: "error", message: msg });
            }
        }
        finally {
            startingRef.current = false;
        }
    }, [onQrScanned, stopDecoding]);
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
        if (!onResetReady)
            return;
        onResetReady(() => resetRef.current());
    }, [onResetReady]);
    return (<Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="size-4 text-muted-foreground"/>{tr(" Scan customer QR code ")}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {cameraStatus.state === "permission_denied" ? (<Alert className="border-red-500/30 text-red-500">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{tr(cameraStatus.message)}</span>
              <Button className="shrink-0" onClick={() => void start()} size="sm" type="button" variant="outline">
                <RefreshCw className="size-4"/>{tr(" Try again ")}</Button>
            </div>
          </Alert>) : null}

        {cameraStatus.state === "error" ? (<Alert className="border-red-500/30 text-red-600">{tr(cameraStatus.message)}</Alert>) : null}

        {cameraStatus.state === "loading" ? (<div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin"/>
            {cameraStatus.message ?? tr("Loading camera…")}
          </div>) : null}

        <div className="relative overflow-hidden rounded-lg border bg-black">
          <video ref={videoRef} muted playsInline className="h-[260px] w-full object-cover sm:h-[320px]"/>
          {/* overlay guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-xl border-2 border-[#f3bd55]/75 shadow-[0_0_24px_rgba(243,189,85,.12)] sm:h-56 sm:w-56"/>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {hasScanned ? <span className="inline-flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="size-4"/>{tr(" QR scanned successfully.")}</span> : tr("Align the QR code within the frame.")}
          </div>

          <div className="flex gap-2">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={reset} disabled={isDecoding}>{tr(" Scan another ")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>);
}
