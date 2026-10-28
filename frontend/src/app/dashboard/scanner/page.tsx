"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useCallback, useRef, useState } from "react";
import { QrCode, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiError } from "@/lib/api";
import { StaffQrScanner } from "@/components/scanner/StaffQrScanner";
import { OnlineOrderScanner } from "@/components/scanner/OnlineOrderScanner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StampOptions, defaultStampSelection, type ScanPreview } from "@/components/scanner/stamp-options";
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
    const { t: tr } = useI18n();
    const { token, user } = useAuth();
    const isCashier=user.role==="staff";
    const [mode, setMode] = useState<"camera" | "image">("camera");
    const [error, setError] = useState<string | null>(null);
    const [stampResult, setStampResult] = useState<StampApiResponse["loyalty"] | null>(null);
    const [decodedQr, setDecodedQr] = useState<string | null>(null);
    const [pending, setPending] = useState<ScanPreview | null>(null);
    const [selection, setSelection] = useState(defaultStampSelection);
    const [confirming, setConfirming] = useState(false);
    const confirmingRef = useRef(false);
    const [redeeming, setRedeeming] = useState(false);
    const [rewardReadyBlocked, setRewardReadyBlocked] = useState(false);
    const scanAnotherRef = useRef<(() => void) | null>(null);
    const handleResetReady = useCallback((resetFn: () => void) => {
        scanAnotherRef.current = resetFn;
    }, []);
    function clearResult() {
        setPending(null);
        setSelection(defaultStampSelection());
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
            const preview = await apiFetch<ScanPreview>("/scan-preview", { method: "POST", token, body: JSON.stringify({ qr_code: qrCode }) });
            if (preview.reward_ready) {
                setRewardReadyBlocked(true);
                setStampResult({ current_stamps: preview.current_stamps, required_stamps: preview.required_stamps, reward_unlocked: true, reward_redemption_created: false });
                return true;
            }
            if (preview.features?.custom_stamp_quantity || preview.features?.stamp_messages) {
                setSelection(defaultStampSelection());
                setPending(preview);
                return true;
            }
            const response = await apiFetch<StampApiResponse>("/stamp", {
                method: "POST",
                token,
                body: JSON.stringify({ qr_code: qrCode }),
            });
            setStampResult(response.loyalty);
            return true;
        }
        catch (err) {
            if (err instanceof ApiError && err.message.toLowerCase().includes("reward is ready")) {
                setRewardReadyBlocked(true);
                setStampResult({ current_stamps: 1, required_stamps: 1, reward_unlocked: true, reward_redemption_created: false });
                return true;
            }
            const message = err instanceof ApiError
                ? err.message
                : "Failed to add stamp. Please try again.";
            setError(message);
            return false;
        }
    }
    async function confirmPurchase() {
        if (!decodedQr || !pending || confirmingRef.current)
            return;
        confirmingRef.current = true;
        setConfirming(true);
        setError(null);
        try {
            const response = await apiFetch<StampApiResponse>("/stamp", { method: "POST", token, body: JSON.stringify({ qr_code: decodedQr, ...selection }) });
            setStampResult(response.loyalty);
            setPending(null);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to confirm purchase.");
        }
        finally {
            confirmingRef.current = false;
            setConfirming(false);
        }
    }
    async function handleRedeemReward() {
        if (!decodedQr)
            return;
        if (!token)
            return;
        setError(null);
        setRedeeming(true);
        try {
            const response = await apiFetch<StampApiResponse & {
                reward_redeemed?: boolean;
            }>("/redeem-reward", {
                method: "POST",
                token,
                body: JSON.stringify({ qr_code: decodedQr }),
            });
            // backend returns `loyalty` plus `reward_redeemed` at top-level; merge it into loyalty for StampResult.
            const nextLoyalty = response.loyalty;
            const rewardRedeemedFlag = (response as unknown as {
                reward_redeemed?: boolean;
            }).reward_redeemed ?? false;
            setStampResult({
                ...nextLoyalty,
                reward_redeemed: rewardRedeemedFlag,
            } as StampApiResponse["loyalty"]);
        }
        catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : "Failed to redeem reward. Please try again.";
            setError(message);
        }
        finally {
            setRedeeming(false);
        }
    }
    return (<DashboardShell activeItem="scanner">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="rounded-2xl border border-[#e7b354]/20 bg-[linear-gradient(145deg,rgba(15,16,13,.92),rgba(8,9,7,.82))] p-5 shadow-[0_18px_55px_rgba(0,0,0,.25)]">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[#8b5d12]/20 text-[#ffc857]">
              <QrCode className="size-5"/>
            </div>

            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-bold leading-tight text-white">{tr(" Staff QR Scanner ")}</h1>
              <p className="text-sm text-muted-foreground">{tr(" Scan in person or upload a QR image for an online order. ")}</p>
            </div>
          </div>

          {error ? (<Alert className="mt-4 border-red-500/30 text-red-600">
              <XCircle className="me-2 size-4 inline"/>
              {tr(error)}
            </Alert>) : null}
        </div>

        <div className="mx-auto mt-5 max-w-2xl">
          {!isCashier?<div className="mb-4"><ShareLoyaltyLink businessId={user.business?.id} name={user.business?.name}/></div>:null}
          {!isCashier?<div className="mb-4 grid grid-cols-2 gap-2" aria-label={tr("Scan method")}>
            <Button variant={mode === "camera" ? "default" : "outline"} aria-pressed={mode === "camera"} onClick={() => { clearResult(); setMode("camera"); }}>{tr("Camera scan")}</Button>
            <Button variant={mode === "image" ? "default" : "outline"} aria-pressed={mode === "image"} onClick={() => { clearResult(); setMode("image"); }}>{tr("QR image / online")}</Button>
          </div>:null}
          {mode === "camera" ? <StaffQrScanner onQrScanned={handleQrScanned} onResetReady={handleResetReady}/> : <OnlineOrderScanner token={token}/>}

          <Modal isOpen={!!pending} onClose={() => { if (!confirming) {
        clearResult();
        scanAnotherRef.current?.();
    } }} closeDisabled={confirming} title={tr("Confirm purchase")} description={pending?.customer_name} icon={<QrCode className="size-6"/>}>
            {pending ? <div className="space-y-4"><p className="text-sm text-muted-foreground">{tr("Current progress: ")}<span className="font-semibold text-[#ffc857]">{pending.current_stamps}/{pending.required_stamps}</span>{tr(". No stamps are added until you confirm.")}</p><StampOptions prefix="camera-stamp" features={pending.features} value={selection} onChange={setSelection} remaining={pending.required_stamps - pending.current_stamps} disabled={confirming}/>{error ? <p role="alert" className="text-sm text-rose-300">{tr(error)}</p> : null}<div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={confirming} onClick={() => { clearResult(); scanAnotherRef.current?.(); }}>{tr("Cancel")}</Button><Button disabled={confirming || !Number.isInteger(selection.stamp_count) || selection.stamp_count < 1 || selection.stamp_count > pending.required_stamps - pending.current_stamps} onClick={() => void confirmPurchase()}>{confirming ? tr("Confirming…") : tr("Confirm & add {0} {1}", { "0": selection.stamp_count, "1": selection.stamp_count === 1 ? tr("stamp") : tr("stamps") })}</Button></div></div> : null}
          </Modal>

          {mode === "camera" && stampResult ? (<StampResult currentStamps={stampResult.current_stamps} requiredStamps={stampResult.required_stamps} rewardUnlocked={stampResult.reward_unlocked} rewardRedeemed={stampResult.reward_redeemed} rewardAlreadyReady={rewardReadyBlocked} redeeming={redeeming} onRedeemReward={isCashier?undefined:handleRedeemReward} onClose={clearResult} onScanAnother={() => {
                clearResult();
                scanAnotherRef.current?.();
            }}/>) : null}
        </div>
      </div>
    </DashboardShell>);
}
