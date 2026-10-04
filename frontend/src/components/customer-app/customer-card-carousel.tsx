"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Gift, Info, QrCode, Trash2, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";

import type { CustomerCardItem } from "@/lib/customerAuth";
import { customerDeleteCard, customerGoogleWalletLink } from "@/lib/customerAuth";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";

import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CustomerCardCarousel({
  cards,
  selectedId,
  onChange,
  onRefresh,
  dashboardMode = false,
}: {
  cards: CustomerCardItem[];
  selectedId?: string | null;
  onChange?: (card: CustomerCardItem) => void;
  onRefresh?: () => Promise<CustomerCardItem[]>;
  dashboardMode?: boolean;
}) {
  const router = useRouter();
  const { token } = useCustomerAuth();

  const initialIndex = useMemo(() => {
    if (!cards.length) return 0;
    if (!selectedId) return 0;
    const idx = cards.findIndex((c) => c.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [cards, selectedId]);

  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (!selectedId) return;
    const idx = cards.findIndex((c) => c.id === selectedId);
    if (idx < 0) return;
    if (idx !== index) setIndex(idx);
  }, [cards, selectedId]); // intentionally exclude `index` to avoid loops

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const [isSwitching, setIsSwitching] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const touchDeltaY = useRef(0);
  const [deleting, setDeleting] = useState(false);
  const [addingToWallet, setAddingToWallet] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const showToast = (t: { type: "success" | "error"; message: string }) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 3500);
  };

  const current = cards[index] ?? cards[0];

  const setAndNotify = (nextIndex: number) => {
    const normalized = Math.min(cards.length - 1, Math.max(0, nextIndex));
    if (normalized === index || isSwitching) return;
    setSlideDirection(normalized > index ? "left" : "right");
    setIsSwitching(true);
    setIndex(normalized);
    onChange?.(cards[normalized]);
    window.setTimeout(() => setIsSwitching(false), 620);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    // Swipe navigation is intentionally touch-only. Mouse/trackpad gestures on desktop
    // are left to normal page scrolling and the explicit card controls.
    if (event.touches.length !== 1) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchStartY.current = event.touches[0]?.clientY ?? null;
    touchDeltaX.current = 0;
    touchDeltaY.current = 0;
    setDragX(0);
    setDragging(true);
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchDeltaX.current = touch.clientX - touchStartX.current;
    touchDeltaY.current = touch.clientY - touchStartY.current;
    const horizontalDistance = Math.abs(touchDeltaX.current);
    const verticalDistance = Math.abs(touchDeltaY.current);
    if (horizontalDistance > 8 && horizontalDistance > verticalDistance * 1.35) {
      setDragX(Math.max(-150, Math.min(150, touchDeltaX.current)));
    } else if (verticalDistance > horizontalDistance) {
      setDragX(0);
    }
  };

  const onTouchEnd = () => {
    const deltaX = touchDeltaX.current;
    const deltaY = touchDeltaY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchDeltaX.current = 0;
    touchDeltaY.current = 0;
    setDragging(false);
    setDragX(0);

    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    // A card changes only for a deliberate horizontal swipe. Normal vertical
    // scrolling may drift sideways, so horizontal movement must clearly dominate.
    if (horizontalDistance < 70) return;
    if (horizontalDistance < verticalDistance * 1.6) return;

    if (deltaX < 0) setAndNotify(index + 1);
    else setAndNotify(index - 1);
  };

  const handleDelete = async () => {
    if (!token) return;

    setDeleting(true);
    try {
      await customerDeleteCard(token, current.id);

      const refreshed = onRefresh ? await onRefresh() : [];
      setConfirmDeleteOpen(false);

      showToast({ type: "success", message: "Card deleted successfully." });

      if ((refreshed?.length ?? 0) === 0) {
        router.push("/user/join");
      }
    } catch (err) {
      setConfirmDeleteOpen(false);
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete card.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleGoogleWallet = async () => {
    if (!token || !current) return;
    setAddingToWallet(true);
    try {
      const { url } = await customerGoogleWalletLink(token, current.id);
      window.location.assign(url);
    } catch (err) {
      showToast({
        type: "error",
        message: err instanceof Error ? err.message : "Could not open Google Wallet.",
      });
      setAddingToWallet(false);
    }
  };

  if (!cards.length || !current) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            You do not have a loyalty card yet. Scan a business QR code or join a participating business to get your first card.
          </p>
          <Button type="button" className="w-full" onClick={() => router.push("/user/join")}>
            Add your first card
          </Button>
        </CardContent>
      </Card>
    );
  }

  const displayName = `${current.membership?.first_name ?? ""} ${current.membership?.last_name ?? ""}`.trim();
  const rewardName = current.loyalty_card?.reward_name ?? null;
  const rewardDescription = current.loyalty_card?.reward_description ?? null;
  const qrValue = current.qr?.qr_code ?? current.membership?.qr_code ?? null;
  const progressPercent = current.loyalty?.progress_percent ?? 0;
  const currentStamps = current.loyalty?.current_stamps ?? 0;
  const requiredStamps =
    current.loyalty?.required_stamps ?? current.loyalty_card?.required_stamps ?? 0;

  const showNav = cards.length > 1;

  return (
    <div className="space-y-3">
      {toast ? (
        <div
          className={cn(
            "rounded-md border p-3 text-sm",
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}

      <div className="space-y-3 overflow-visible px-3 pb-2">
        <div
          key={`wallet-stage-${current.id}`}
          className={cn(
            "space-y-3 transform-gpu will-change-transform [perspective:1200px]",
            "animate-in fade-in zoom-in-[0.92] duration-500 ease-out",
            slideDirection === "left"
              ? "slide-in-from-right-16"
              : "slide-in-from-left-16",
          )}
        >
          <div
            className={cn("relative mx-auto w-full touch-pan-y select-none [perspective:1500px]", dashboardMode ? "max-w-[560px] lg:max-w-[720px]" : "max-w-[560px]")}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="relative grid">
              {cards.map((card, cardIndex) => {
                const offset = cardIndex - index;
                const distance = Math.abs(offset);
                const isActive = offset === 0;
                if (distance > 3) return null;

                const displayNameForCard = `${card.membership?.first_name ?? ""} ${card.membership?.last_name ?? ""}`.trim();
                const qrForCard = card.qr?.qr_code ?? card.membership?.qr_code ?? null;
                const progressForCard = card.loyalty?.progress_percent ?? 0;
                const stampsForCard = card.loyalty?.current_stamps ?? 0;
                const requiredForCard = card.loyalty?.required_stamps ?? card.loyalty_card?.required_stamps ?? 0;

                const side = offset > 0 ? 1 : -1;
                // Fan the inactive cards upward and outward so their rounded top
                // corner is visible instead of looking like a flat side strip.
                const baseX = side * ((dashboardMode ? 34 : 24) + (distance - 1) * 18);
                const baseY = dashboardMode ? 8 - (distance - 1) * 4 : -10 - (distance - 1) * 7;
                const baseScale = 1 - distance * (dashboardMode ? 0.045 : 0.055);
                const baseRotateY = side * distance * -5;
                const baseRotateZ = side * distance * 0.7;
                const opacity = 1 - distance * 0.16;
                const brightness = 1 - distance * 0.07;
                const activeTransform = dragging
                  ? `translateX(${dragX}px) rotateZ(${dragX * 0.055}deg) scale(${1 - Math.min(Math.abs(dragX), 150) / 1800})`
                  : "translateX(0px) rotateY(0deg) scale(1)";
                const stackedTransform = `translate3d(${baseX}px, ${baseY}px, ${-distance * 18}px) rotateY(${baseRotateY}deg) rotateZ(${baseRotateZ}deg) scale(${baseScale})`;

                return (
                  <div
                    key={card.id}
                    className={cn(
                      "col-start-1 row-start-1 transform-gpu [transform-style:preserve-3d]",
                      dragging && isActive ? "transition-none" : "transition-all duration-[600ms] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]",
                      !isActive && "pointer-events-none",
                    )}
                    style={{
                      zIndex: isActive ? 40 : 30 - distance,
                      opacity,
                      filter: `brightness(${brightness})`,
                      transform: isActive ? activeTransform : stackedTransform,
                      transformOrigin: "center center",
                    }}
                  >
                    <LoyaltyCardVisual
                      businessName={card.business.name}
                      businessLogoUrl={card.business.logo_url}
                      heroImageUrl={card.business.hero_image_url}
                      heroImageZoom={card.business.hero_image_zoom}
                      heroImagePositionX={card.business.hero_image_position_x}
                      heroImagePositionY={card.business.hero_image_position_y}
                      brandPrimaryColor={card.business.primary_color}
                      memberName={displayNameForCard}
                      rewardName={card.loyalty_card?.reward_name ?? null}
                      rewardDescription={card.loyalty_card?.reward_description ?? null}
                      cardNumber={card.id}
                      qrToken={qrForCard}
                      showQrPayloadText={false}
                      stampUiVariant="customer"
                      dashboardCompact={dashboardMode}
                      progressPercent={progressForCard}
                      currentStamps={stampsForCard}
                      requiredStamps={requiredForCard}
                    />
                  </div>
                );
              })}
            </div>

            {showNav && dashboardMode ? (
              <>
                <button
                  type="button"
                  aria-label="Previous loyalty card"
                  onClick={() => setAndNotify(index - 1)}
                  disabled={index <= 0}
                  className="absolute left-[-54px] top-1/2 z-[70] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#111210]/90 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] transition hover:border-[#d8a63f]/35 hover:bg-[#191a17] disabled:opacity-35 lg:flex"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next loyalty card"
                  onClick={() => setAndNotify(index + 1)}
                  disabled={index >= cards.length - 1}
                  className="absolute right-[-54px] top-1/2 z-[70] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#111210]/90 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] transition hover:border-[#d8a63f]/35 hover:bg-[#191a17] disabled:opacity-35 lg:flex"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          {showNav && !dashboardMode ? (
            <div className="flex justify-center gap-1.5 pt-3" aria-label="Card position">
              {cards.map((card, cardIndex) => (
                <button
                  key={card.id}
                  type="button"
                  aria-label={`Show card ${cardIndex + 1}`}
                  onClick={() => setAndNotify(cardIndex)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    cardIndex === index ? "w-7 bg-foreground" : "w-1.5 bg-muted-foreground/35 hover:bg-muted-foreground/60",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>

        {dashboardMode ? (
          <div className="mx-auto grid max-w-[960px] gap-2.5 pt-1 sm:grid-cols-3 lg:pt-3">
            <Button type="button" variant="outline" className="h-11 w-full border-[#d8a63f]/30 bg-black/25 font-medium hover:border-[#e7b354]/50 hover:bg-[#d79b16]/10 lg:h-12" onClick={() => router.push("/user/rewards")}>
              <Gift className="size-4 text-[#ffc857]" /> View Rewards
            </Button>
            <Button type="button" className="h-11 w-full border border-[#ffd56b]/45 bg-[linear-gradient(180deg,#ffd36a,#eeb84d)] font-semibold text-black shadow-[0_8px_24px_rgba(215,155,22,.16)] hover:bg-[#f4c86f] lg:h-12" onClick={() => router.push(`/user/cards?selected=${encodeURIComponent(current.id)}`)}>
              <QrCode className="size-4" /> Show QR Code
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full border-[#d8a63f]/30 bg-black/25 font-medium hover:border-[#e7b354]/50 hover:bg-[#d79b16]/10 lg:h-12" onClick={() => router.push(`/user/cards?selected=${encodeURIComponent(current.id)}`)}>
              <Info className="size-4 text-[#ffc857]" /> Card Details
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Card
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoogleWallet()}
              disabled={addingToWallet}
            >
              <WalletCards className="mr-2 h-4 w-4" />
              {addingToWallet ? "Opening Google Wallet..." : "Add to Google Wallet"}
            </Button>
          </>
        )}
      </div>

      {showNav && !dashboardMode ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("flex-1")}
            onClick={() => setAndNotify(index - 1)}
            disabled={index <= 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={cn("flex-1")}
            onClick={() => setAndNotify(index + 1)}
            disabled={index >= cards.length - 1}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => (deleting ? null : setConfirmDeleteOpen(false))}
        title="Remove Loyalty Card"
        description="Are you sure you want to remove this loyalty card?"
        allowOverlayClose={!deleting}
        className="border-destructive/30"
      >
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            This will remove your loyalty card and progress for this business.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Delete Card"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
