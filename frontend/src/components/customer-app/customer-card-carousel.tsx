"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { RewardGoalChooser } from "@/components/customer-app/reward-goal-chooser";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Gift, Info, QrCode, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import type { CustomerCardItem } from "@/lib/customerAuth";
import { customerAppleWalletLink, customerAppleWalletStatus, customerDeleteCard, customerGoogleWalletLink } from "@/lib/customerAuth";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
export function CustomerCardCarousel({ cards, selectedId, onChange, onRefresh, dashboardMode = false, }: {
    cards: CustomerCardItem[];
    selectedId?: string | null;
    onChange?: (card: CustomerCardItem) => void;
    onRefresh?: () => Promise<CustomerCardItem[]>;
    dashboardMode?: boolean;
}) {
    const { t: tr } = useI18n();
    const router = useRouter();
    const { token } = useCustomerAuth();
    const initialIndex = useMemo(() => {
        if (!cards.length)
            return 0;
        if (!selectedId)
            return 0;
        const idx = cards.findIndex((c) => c.id === selectedId);
        return idx >= 0 ? idx : 0;
    }, [cards, selectedId]);
    const [index, setIndex] = useState(initialIndex);
    useEffect(() => {
        if (!selectedId)
            return;
        const idx = cards.findIndex((c) => c.id === selectedId);
        if (idx < 0)
            return;
        if (idx !== index)
            setIndex(idx);
    }, [cards, selectedId]); // intentionally exclude `index` to avoid loops
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
    const [isSwitching, setIsSwitching] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [dragging, setDragging] = useState(false);
    const dragFrame = useRef<number | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const touchDeltaX = useRef(0);
    const touchDeltaY = useRef(0);
    const [downloadingQr, setDownloadingQr] = useState(false);
    const [qrDownloadError, setQrDownloadError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [addingToWallet, setAddingToWallet] = useState(false);
    const [addingToAppleWallet, setAddingToAppleWallet] = useState(false);
    const [appleWalletUrl, setAppleWalletUrl] = useState<string | null>(null);
    const [appleWalletReady, setAppleWalletReady] = useState(false);
    useEffect(() => {
        if (!token || dashboardMode)
            return;
        let cancelled = false;
        setAppleWalletReady(false);
        void customerAppleWalletStatus(token)
            .then((res) => {
            if (!cancelled)
                setAppleWalletReady(res.available);
        })
            .catch(() => {
            if (!cancelled)
                setAppleWalletReady(false);
        });
        return () => { cancelled = true; };
    }, [token, dashboardMode]);
    const [toast, setToast] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const showToast = (t: {
        type: "success" | "error";
        message: string;
    }) => {
        setToast(t);
        window.setTimeout(() => setToast(null), 3500);
    };
    const current = cards[index] ?? cards[0];
    const setAndNotify = (nextIndex: number) => {
        const normalized = Math.min(cards.length - 1, Math.max(0, nextIndex));
        if (normalized === index || isSwitching)
            return;
        setSlideDirection(normalized > index ? "left" : "right");
        setIsSwitching(true);
        setIndex(normalized);
        onChange?.(cards[normalized]);
        window.setTimeout(() => setIsSwitching(false), 360);
    };
    const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        // Swipe navigation is intentionally touch-only. Mouse/trackpad gestures on desktop
        // are left to normal page scrolling and the explicit card controls.
        if (event.touches.length !== 1)
            return;
        touchStartX.current = event.touches[0]?.clientX ?? null;
        touchStartY.current = event.touches[0]?.clientY ?? null;
        touchDeltaX.current = 0;
        touchDeltaY.current = 0;
        setDragX(0);
        setDragging(true);
    };
    const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
        if (touchStartX.current === null || touchStartY.current === null)
            return;
        const touch = event.touches[0];
        if (!touch)
            return;
        touchDeltaX.current = touch.clientX - touchStartX.current;
        touchDeltaY.current = touch.clientY - touchStartY.current;
        const horizontalDistance = Math.abs(touchDeltaX.current);
        const verticalDistance = Math.abs(touchDeltaY.current);
        if (horizontalDistance > 6 && horizontalDistance > verticalDistance * 1.2) {
            const nextDrag = Math.max(-170, Math.min(170, touchDeltaX.current));
            if (dragFrame.current !== null)
                cancelAnimationFrame(dragFrame.current);
            dragFrame.current = requestAnimationFrame(() => {
                setDragX(nextDrag);
                dragFrame.current = null;
            });
        }
        else if (verticalDistance > horizontalDistance) {
            if (dragFrame.current !== null)
                cancelAnimationFrame(dragFrame.current);
            dragFrame.current = requestAnimationFrame(() => {
                setDragX(0);
                dragFrame.current = null;
            });
        }
    };
    const onTouchEnd = () => {
        const deltaX = touchDeltaX.current;
        const deltaY = touchDeltaY.current;
        touchStartX.current = null;
        touchStartY.current = null;
        touchDeltaX.current = 0;
        touchDeltaY.current = 0;
        if (dragFrame.current !== null) {
            cancelAnimationFrame(dragFrame.current);
            dragFrame.current = null;
        }
        setDragging(false);
        setDragX(0);
        const horizontalDistance = Math.abs(deltaX);
        const verticalDistance = Math.abs(deltaY);
        // A card changes only for a deliberate horizontal swipe. Normal vertical
        // scrolling may drift sideways, so horizontal movement must clearly dominate.
        if (horizontalDistance < 48)
            return;
        if (horizontalDistance < verticalDistance * 1.25)
            return;
        if (deltaX < 0)
            setAndNotify(index + 1);
        else
            setAndNotify(index - 1);
    };
    const handleDelete = async () => {
        if (!token)
            return;
        setDeleting(true);
        try {
            await customerDeleteCard(token, current.id);
            const refreshed = onRefresh ? await onRefresh() : [];
            setConfirmDeleteOpen(false);
            showToast({ type: "success", message: "Card deleted successfully." });
            if ((refreshed?.length ?? 0) === 0) {
                router.push("/user/join");
            }
        }
        catch (err) {
            setConfirmDeleteOpen(false);
            showToast({
                type: "error",
                message: err instanceof Error ? err.message : "Failed to delete card.",
            });
        }
        finally {
            setDeleting(false);
        }
    };
    const handleGoogleWallet = async () => {
        if (!token || !current)
            return;
        setAddingToWallet(true);
        try {
            const { url } = await customerGoogleWalletLink(token, current.id);
            window.location.assign(url);
        }
        catch (err) {
            showToast({
                type: "error",
                message: err instanceof Error ? err.message : "Could not open Google Wallet.",
            });
            setAddingToWallet(false);
        }
    };
    const handleAppleWallet = async () => {
        if (!token || !current || !appleWalletReady || addingToAppleWallet)
            return;
        setAddingToAppleWallet(true);
        try {
            const { url } = await customerAppleWalletLink(token, current.id);
            if (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent))
                window.location.assign(url);
            else
                setAppleWalletUrl(url);
        }
        catch (err) {
            showToast({ type: "error", message: err instanceof Error ? err.message : "Could not open Apple Wallet." });
        }
        finally {
            setAddingToAppleWallet(false);
        }
    };
    if (!cards.length || !current) {
        return (<Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">{tr(" You do not have a loyalty card yet. Scan a business QR code or join a participating business to get your first card. ")}</p>
          <Button type="button" className="w-full" onClick={() => router.push("/user/join")}>{tr(" Add your first card ")}</Button>
        </CardContent>
      </Card>);
    }
    const displayName = `${current.membership?.first_name ?? ""} ${current.membership?.last_name ?? ""}`.trim();
    const rewardName = current.loyalty_card?.reward_name ?? null;
    const rewardDescription = current.loyalty_card?.reward_description ?? null;
    const qrValue = current.qr?.qr_code ?? current.membership?.qr_code ?? null;
    async function downloadQr() {
        if (!qrValue || downloadingQr)
            return;
        setDownloadingQr(true);
        setQrDownloadError(null);
        try {
            const { default: QRCode } = await import("qrcode");
            const url = await QRCode.toDataURL(qrValue, { width: 800, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
            const link = document.createElement("a");
            link.href = url;
            link.download = "loyvance-customer-qr.png";
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
        catch {
            setQrDownloadError("Could not download your QR. Please try again.");
        }
        finally {
            setDownloadingQr(false);
        }
    }
    const progressPercent = current.loyalty?.progress_percent ?? 0;
    const currentStamps = current.loyalty?.current_stamps ?? 0;
    const requiredStamps = current.loyalty?.required_stamps ?? current.loyalty_card?.required_stamps ?? 0;
    const showNav = cards.length > 1;
    return (<div className="space-y-3">
      {toast ? (<div className={cn("rounded-md border p-3 text-sm", toast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border-destructive/30 bg-destructive/10 text-destructive")} role="status" aria-live="polite">
          {tr(toast.message)}
        </div>) : null}

      <div className={cn("space-y-4 overflow-visible px-3 pb-2 sm:px-5", !dashboardMode && "lg:pe-[310px] lg:space-y-2 lg:pb-0")}>
        <div key={`wallet-stage-${current.id}`} className={cn("space-y-3 transform-gpu will-change-transform [perspective:1200px]", "animate-in fade-in zoom-in-[0.92] duration-500 ease-out", slideDirection === "left"
            ? "slide-in-from-right-16"
            : "slide-in-from-left-16")}>
          <div className={cn("relative mx-auto w-full touch-pan-y select-none overscroll-contain [perspective:1500px]", "max-w-[300px] sm:max-w-[340px]", dashboardMode ? "lg:max-w-[380px]" : "lg:max-w-[340px]")} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="relative grid">
              {cards.map((card, cardIndex) => {
            const offset = cardIndex - index;
            const distance = Math.abs(offset);
            const isActive = offset === 0;
            if (distance > 3)
                return null;
            const displayNameForCard = `${card.membership?.first_name ?? ""} ${card.membership?.last_name ?? ""}`.trim();
            const qrForCard = card.qr?.qr_code ?? card.membership?.qr_code ?? null;
            const progressForCard = card.loyalty?.progress_percent ?? 0;
            const stampsForCard = card.loyalty?.current_stamps ?? 0;
            const requiredForCard = card.loyalty?.required_stamps ?? card.loyalty_card?.required_stamps ?? 0;
            const side = offset > 0 ? 1 : -1;
            // Fan the inactive cards upward and outward so their rounded top
            // corner is visible instead of looking like a flat side strip.
            const baseX = side * (18 + (distance - 1) * 12);
            const baseY = 10 + (distance - 1) * 3;
            const baseScale = 1 - distance * 0.035;
            const baseRotateY = 0;
            const baseRotateZ = 0;
            const opacity = 1 - distance * 0.12;
            const activeTransform = dragging
                ? `translate3d(${dragX}px,0,0) scale(${1 - Math.min(Math.abs(dragX), 170) / 2600})`
                : "translateX(0px) rotateY(0deg) scale(1)";
            const stackedTransform = `translate3d(${baseX}px, ${baseY}px, ${-distance * 18}px) rotateY(${baseRotateY}deg) rotateZ(${baseRotateZ}deg) scale(${baseScale})`;
            return (<div key={card.id} className={cn("relative col-start-1 row-start-1 transform-gpu [backface-visibility:hidden] [transform-style:preserve-3d]", dragging && isActive ? "transition-none will-change-transform" : "transition-[transform,opacity] duration-[360ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]", !isActive && "pointer-events-none")} style={{
                    zIndex: isActive ? 40 : 30 - distance,
                    opacity,
                    transform: isActive ? activeTransform : stackedTransform,
                    transformOrigin: "center center",
                }}>
                    <LoyaltyCardVisual headerAction={isActive ? <RewardGoalChooser card={card} token={token} onSaved={() => onRefresh?.()}/> : null} businessName={card.business.name} businessLogoUrl={card.business.logo_url} heroImageUrl={card.business.hero_image_url} heroImageZoom={card.business.hero_image_zoom} heroImagePositionX={card.business.hero_image_position_x} heroImagePositionY={card.business.hero_image_position_y} brandPrimaryColor={card.business.primary_color} memberName={displayNameForCard} rewardName={card.loyalty_card?.reward_name ?? null} rewardDescription={card.loyalty_card?.reward_description ?? null} cardNumber={card.id} qrToken={qrForCard} showQrPayloadText={false} stampUiVariant="customer" progressPercent={progressForCard} currentStamps={stampsForCard} requiredStamps={requiredForCard}/>
                  </div>);
        })}
            </div>

            {showNav && dashboardMode ? (<>
                <button type="button" aria-label={tr("Previous loyalty card")} onClick={() => setAndNotify(index - 1)} disabled={index <= 0} className="absolute start-[-54px] top-1/2 z-[70] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#111210]/90 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] transition hover:border-[#d8a63f]/35 hover:bg-[#191a17] disabled:opacity-35 lg:flex">
                  <ChevronLeft className="size-5"/>
                </button>
                <button type="button" aria-label={tr("Next loyalty card")} onClick={() => setAndNotify(index + 1)} disabled={index >= cards.length - 1} className="absolute end-[-54px] top-1/2 z-[70] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#111210]/90 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] transition hover:border-[#d8a63f]/35 hover:bg-[#191a17] disabled:opacity-35 lg:flex">
                  <ChevronRight className="size-5"/>
                </button>
              </>) : null}
          </div>


        </div>

      {showNav && !dashboardMode ? (<nav className="mx-auto flex max-w-[420px] items-center justify-center gap-3 pb-1 pt-2" aria-label={tr("Loyalty card navigation")}>
          <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full border-[#d8a63f]/25 bg-black/25 text-[#ffd369] transition hover:border-[#e7b354]/50 hover:bg-[#d79b16]/10 disabled:opacity-30" aria-label={tr("Previous loyalty card")} onClick={() => setAndNotify(index - 1)} disabled={index <= 0 || isSwitching}>
            <ChevronLeft className="size-5"/>
          </Button>
          <div className="flex min-w-0 flex-wrap items-center justify-center" aria-label={tr("Card position")}>
            {cards.map((card, cardIndex) => (<button key={card.id} type="button" aria-label={tr("Show card {0}", { "0": cardIndex + 1 })} aria-current={cardIndex === index ? "true" : undefined} disabled={isSwitching} onClick={() => setAndNotify(cardIndex)} className="flex h-11 min-w-6 items-center justify-center rounded-full px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd369]">
                <span className={cn("h-1.5 rounded-full transition-all duration-300", cardIndex === index ? "w-6 bg-[#ffd369] shadow-[0_0_10px_rgba(255,211,105,.25)]" : "w-1.5 bg-white/25")}/>
              </button>))}
          </div>
          <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full border-[#d8a63f]/25 bg-black/25 text-[#ffd369] transition hover:border-[#e7b354]/50 hover:bg-[#d79b16]/10 disabled:opacity-30" aria-label={tr("Next loyalty card")} onClick={() => setAndNotify(index + 1)} disabled={index >= cards.length - 1 || isSwitching}>
            <ChevronRight className="size-5"/>
          </Button>
        </nav>) : null}



        {dashboardMode ? (<div className="mx-auto grid max-w-[960px] gap-2.5 pt-1 sm:grid-cols-3 lg:pt-3">
            <Button type="button" variant="outline" className="h-11 w-full border-[#d8a63f]/30 bg-black/25 font-medium hover:border-[#e7b354]/50 hover:bg-[#d79b16]/10 lg:h-12" onClick={() => router.push("/user/rewards")}>
              <Gift className="size-4 text-[#ffc857]"/>{tr(" View Rewards ")}</Button>
            <Button type="button" className="h-11 w-full border border-[#ffd56b]/45 bg-[linear-gradient(180deg,#ffd36a,#eeb84d)] font-semibold text-black shadow-[0_8px_24px_rgba(215,155,22,.16)] hover:bg-[#f4c86f] lg:h-12" onClick={() => router.push(`/user/cards?selected=${encodeURIComponent(current.id)}`)}>
              <QrCode className="size-4"/>{tr(" Show QR Code ")}</Button>
            <Button type="button" variant="outline" className="h-11 w-full border-[#d8a63f]/30 bg-black/25 font-medium hover:border-[#e7b354]/50 hover:bg-[#d79b16]/10 lg:h-12" onClick={() => router.push(`/user/cards?selected=${encodeURIComponent(current.id)}`)}>
              <Info className="size-4 text-[#ffc857]"/>{tr(" Card Details ")}</Button>
          </div>) : (<div className="mx-auto flex w-full max-w-[420px] flex-col gap-2.5 pt-3 sm:pt-5 lg:absolute lg:end-8 lg:top-[76px] lg:m-0 lg:w-[283px] lg:max-w-none lg:pt-0">
            <Button type="button" variant="outline" className="h-11 w-full lg:rounded-full" disabled={!qrValue || downloadingQr} onClick={() => void downloadQr()}><Download className="size-4"/>{downloadingQr ? tr("Preparing QR…") : tr("Download my QR")}</Button>
            <p className="text-center text-xs text-muted-foreground">{tr("Share this QR with the business for an online order.")}</p>
            {qrDownloadError ? <p role="alert" className="text-center text-xs text-rose-300">{tr(qrDownloadError)}</p> : null}
            <div className="flex flex-col items-center gap-2 p-2 lg:px-0">
              <button type="button" className="block max-w-full cursor-pointer rounded-full bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#10110f] disabled:cursor-wait" onClick={() => void handleGoogleWallet()} disabled={addingToWallet} aria-label={tr("Add to Google Wallet")} aria-busy={addingToWallet}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/add-to-google-wallet.svg" alt={tr("Add to Google Wallet")} width={283} height={50} className="block h-auto w-[283px] max-w-full"/>
              </button>
              {addingToWallet ? <p role="status" className="text-xs text-white/70">{tr("Opening Google Wallet...")}</p> : null}
            </div>
            <div className="flex flex-col items-center gap-2 p-2 lg:px-0">
              <button type="button" className="flex h-[50px] w-[283px] max-w-full items-center justify-center rounded-xl bg-black p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#10110f] disabled:cursor-default" onClick={() => void handleAppleWallet()} disabled={!appleWalletReady || addingToAppleWallet} aria-label={appleWalletReady ? tr("Add to Apple Wallet") : tr("Apple Wallet — coming soon")} aria-describedby="apple-wallet-availability" aria-busy={addingToAppleWallet}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/add-to-apple-wallet.svg" alt={tr("Add to Apple Wallet")} width={283} height={50} className="block h-full w-full"/>
              </button>
              <p id="apple-wallet-availability" role="status" className="text-center text-xs text-white/60">
                {addingToAppleWallet ? tr("Opening Apple Wallet...") : appleWalletReady ? tr("Open on iPhone to add your card.") : tr("Coming soon")}
              </p>
            </div>
            <Button type="button" variant="ghost" className="mx-auto h-11 rounded-xl px-5 lg:h-[50px] lg:w-[283px] lg:rounded-full lg:border lg:border-rose-400/25 lg:bg-rose-500/5 text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200 focus-visible:ring-rose-300" onClick={() => setConfirmDeleteOpen(true)} disabled={deleting}>
              <Trash2 className="size-4"/>{tr(" Delete Card ")}</Button>
          </div>)}
      </div>



      <Modal isOpen={Boolean(appleWalletUrl)} onClose={() => setAppleWalletUrl(null)} title={tr("Add to Apple Wallet")} description={tr("Scan this QR code with your iPhone camera to add your loyalty card.")}>
        {appleWalletUrl ? (<div className="flex flex-col items-center gap-4 py-3">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={appleWalletUrl} size={192} level="M" title={tr("Open your loyalty card in Apple Wallet")}/>
            </div>
            <p className="text-center text-sm text-muted-foreground">{tr("This private link expires in 15 minutes.")}</p>
            <a href={appleWalletUrl} className="text-sm font-medium text-[#ffd369] underline underline-offset-4">{tr("Download the pass")}</a>
          </div>) : null}
      </Modal>

      <Modal isOpen={confirmDeleteOpen} onClose={() => (deleting ? null : setConfirmDeleteOpen(false))} title={tr("Remove Loyalty Card")} description={tr("Are you sure you want to remove this loyalty card?")} allowOverlayClose={!deleting} closeDisabled={deleting} icon={<Trash2 />}>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{tr(" This will remove your loyalty card and progress for this business. ")}</div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>{tr(" Cancel ")}</Button>
            <Button type="button" variant="secondary" className="h-11 flex-1 border border-rose-400/25 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? tr("Removing...") : tr("Delete Card")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>);
}
