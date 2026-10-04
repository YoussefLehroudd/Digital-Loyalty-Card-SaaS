"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";

type Props = {
  businessName: string;
  businessLogoUrl?: string | null;

  brandPrimaryColor?: string | null;
  memberName?: string | null;

  rewardName?: string | null;
  rewardDescription?: string | null;

  cardNumber?: string | null;

  qrToken?: string | null;

  /**
   * Customer cards need the raw membership code text below the QR.
   * Business preview should stay pixel-identical, so default is false.
   */
  showQrPayloadText?: boolean;

  /**
   * Keep business preview styling unchanged. Enable richer stamp UI only for customer view.
   */
  stampUiVariant?: "standard" | "customer";

  /** Compact horizontal presentation used by the customer dashboard only. */
  dashboardCompact?: boolean;

  heroImageUrl?: string | null;
  heroImageZoom?: number | null;
  heroImagePositionX?: number | null;
  heroImagePositionY?: number | null;

  progressPercent: number;
  currentStamps: number;
  requiredStamps: number;
};

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function LoyaltyCardVisual({
  businessName,
  businessLogoUrl,
  brandPrimaryColor,
  memberName,
  rewardName,
  rewardDescription,
  cardNumber,
  qrToken,
  showQrPayloadText = false,
  stampUiVariant = "standard",
  dashboardCompact = false,
  heroImageUrl,
  heroImageZoom,
  heroImagePositionX,
  heroImagePositionY,
  progressPercent,
  currentStamps,
  requiredStamps,
}: Props) {
  const primary = brandPrimaryColor ?? "#0f172a";
  const progress = clampPercent(progressPercent);

  const showHero = Boolean(heroImageUrl);
  const heroZoom = Math.min(3, Math.max(1, Number(heroImageZoom ?? 1.2)));
  const heroPositionX = Math.min(50, Math.max(-50, Number(heroImagePositionX ?? 0)));
  const heroPositionY = Math.min(50, Math.max(-50, Number(heroImagePositionY ?? 0)));

  const progressLabel =
    requiredStamps > 0 ? `${currentStamps}/${requiredStamps} stamps` : `${currentStamps} stamps`;

  const [qrModalOpen, setQrModalOpen] = useState(false);

  const isCustomerStampUi = stampUiVariant === "customer";
  const shouldShowQrPayloadText = showQrPayloadText && !isCustomerStampUi;
  const qrButtonMarginTopClass = isCustomerStampUi ? "-mt-6" : "-mt-9";

  const [animateStampIndices, setAnimateStampIndices] = useState<number[]>([]);
  const [celebrate, setCelebrate] = useState(false);

  const prevFilledRef = useRef<number>(0);

  const stampGoal = Math.max(1, Math.floor(requiredStamps || 1));
  const maxSlots = 10;

  // Grid should represent CURRENT stamps, not only the goal.
  const normalizedCurrent = Math.max(0, Math.floor(currentStamps || 0));
  const filled = Math.min(normalizedCurrent, maxSlots);
  const remaining = Math.max(0, stampGoal - normalizedCurrent);

  const qrValue = qrToken ?? null;

  const memberText = (memberName ?? "").trim() || "Member";

  const showRewardDescription = Boolean(rewardDescription && rewardDescription.trim().length > 0);

  const stampEmptyText =
    stampGoal <= maxSlots
      ? remaining === 0
        ? "Reward ready to unlock"
        : `${remaining} more stamp${remaining === 1 ? "" : "s"} to unlock`
      : `Goal: ${stampGoal} stamps`;

  const qrSize = useMemo(() => 220, []);

  const normalizedReward = (rewardName ?? "").toLowerCase();

  const CompletedStampIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2a10 10 0 1 0 10 10"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.35"
        strokeLinecap="round"
      />
    </svg>
  );

  const ActiveStampIcon = isCustomerStampUi ? CompletedStampIcon : null;

  useEffect(() => {
    if (!isCustomerStampUi) return;

    // First render init
    if (prevFilledRef.current === 0 && filled === 0) {
      prevFilledRef.current = 0;
    }

    const prevFilled = prevFilledRef.current;
    const nextFilled = filled;

    if (nextFilled > prevFilled) {
      const indices: number[] = [];
      for (let i = prevFilled; i < nextFilled; i++) indices.push(i);
      setAnimateStampIndices(indices);
      window.setTimeout(() => setAnimateStampIndices([]), 650);
    }

    const isComplete = stampGoal > 0 && remaining === 0;
    if (isComplete && !celebrate) {
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 1400);
    }

    prevFilledRef.current = nextFilled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, remaining, isCustomerStampUi, stampGoal]);

  return (
    <div
      className={dashboardCompact ? "relative aspect-[2.15/1] overflow-hidden rounded-2xl border border-white/10 text-white shadow-sm" : "relative overflow-hidden rounded-2xl border border-white/10 text-white shadow-sm"}
      style={{
        background: showHero ? "transparent" : `linear-gradient(135deg, ${primary} 0%, rgba(2,6,23,1) 100%)`,
      }}
    >
      {showHero ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl as string}
            alt={`${businessName} card background`}
            className="absolute inset-0 h-full w-full select-none"
            style={{
              objectFit: "cover",
              transform: `scale(${heroZoom})`,
              transformOrigin: "center",
              objectPosition: `${heroPositionX + 50}% ${heroPositionY + 50}%`,
              zIndex: 0,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))",
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.25))",
            zIndex: 1,
          }}
        />
      )}

      <div className={dashboardCompact ? "relative z-[2] p-3.5 lg:p-4" : "relative z-[2] p-5"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mt-0 flex items-center gap-3">
              {businessLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={businessLogoUrl}
                  alt={`${businessName} logo`}
                  className="h-12 w-12 rounded-lg bg-white/10 object-contain p-1.5"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-white/10 object-contain p-1.5" />
              )}

              <div className="min-w-0 flex-1 pr-1 text-base font-semibold leading-tight sm:text-xl"><span className="block break-words sm:truncate">{businessName}</span></div>
            </div>

            <div className="text-sm text-white/80 mt-1">
              {rewardName ? `Reward: ${rewardName}` : "Keep earning stamps"}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/80">Progress</div>
            <div className="text-lg font-semibold">{progress}%</div>
          </div>
        </div>

        <div className={dashboardCompact ? "mt-1.5" : "mt-4"}>
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-black/35 bg-white/25 shadow-[0_1px_3px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.28)]">
            <div
              className="h-full rounded-full border-r border-black/25 bg-[linear-gradient(90deg,#fff3c4_0%,#f5c451_48%,#fff7d6_100%)] shadow-[0_0_7px_rgba(255,220,120,.55),0_1px_2px_rgba(0,0,0,.65)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-xs font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.95),0_0_4px_rgba(0,0,0,.75)]">{progressLabel}</div>
        </div>

        <div className={dashboardCompact ? "mt-1.5 grid grid-cols-5 gap-2 items-start" : "mt-4 grid grid-cols-5 gap-3 items-start"}>
          {/* Member */}
          <div className="col-span-3">
            <div className="text-xs text-white/80">{memberName ? "Member" : "Card code"}</div>
            <div className="mt-1 font-semibold text-sm break-words">
              {memberName ? memberText : cardNumber ? cardNumber : "—"}
            </div>

            {showRewardDescription ? (
              <div className="mt-2 max-w-full whitespace-normal break-words pr-1 text-xs leading-[1.35] text-white/80">
                {rewardDescription}
              </div>
            ) : null}
          </div>

          {/* QR */}
          <div className="col-span-2">
            <button
              type="button"
              className={`w-full flex flex-col items-center ${qrButtonMarginTopClass}`}
              onClick={() => setQrModalOpen(true)}
              aria-label="Tap to show QR fullscreen"
              disabled={!qrValue}
            >
              {qrValue ? (
                <div className="w-[104px] h-[104px] rounded-2xl bg-white flex items-center justify-center">
                  <QRCodeSVG
                    value={qrValue}
                    size={84}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    includeMargin={false}
                    level="M"
                  />
                </div>
              ) : (
                <div className="w-[104px] h-[104px] rounded-2xl bg-white/10 flex items-center justify-center text-[10px] text-white/70">
                  No QR
                </div>
              )}

              {shouldShowQrPayloadText && qrValue ? (
                <>
                  <p className="mt-2 max-w-[104px] break-all text-center font-mono text-[11px] leading-tight opacity-90">
                    {qrValue}
                  </p>
                </>
              ) : null}
            </button>
          </div>
        </div>

        <div className={dashboardCompact ? "mt-1.5 rounded-lg bg-black/10 p-2" : "mt-4 rounded-lg bg-black/10 p-3"}>
          <div className="flex items-center justify-between text-xs">
            <span className="opacity-90">Stamp progress</span>
            <span className="opacity-90">
              {filled}/{stampGoal}
            </span>
          </div>

          <div className={dashboardCompact ? "mt-1 grid grid-cols-10 gap-1.5" : "mt-3 grid grid-cols-5 gap-2"}>
            {Array.from({ length: maxSlots }).map((_, index) => {
              const isFilled = index < filled;

              if (!isCustomerStampUi) {
                return (
                  <div
                    key={index}
                    className="aspect-square rounded-md border border-white/20"
                    style={{
                      backgroundColor: isFilled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.10)",
                    }}
                    aria-hidden="true"
                  />
                );
              }

              const Icon = ActiveStampIcon;

              const shouldAnimate = isFilled && animateStampIndices.includes(index);

              return (
                <div
                  key={index}
                  className={[
                    "relative aspect-square rounded-md border",
                    isFilled ? "border-white/30" : "border-white/20",
                    shouldAnimate ? "scale-[1.08] opacity-100" : "scale-100",
                    shouldAnimate ? "shadow-[0_0_22px_rgba(255,255,255,0.55)]" : "shadow-none",
                    "transition-transform duration-300",
                  ].join(" ")}
                  style={{
                    backgroundColor: isFilled ? "rgba(255,255,255,0.18)" : "transparent",
                    backgroundImage: isFilled
                      ? "radial-gradient(60% 60% at 50% 40%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.10) 55%, rgba(255,255,255,0.06) 100%)"
                      : "none",
                    boxShadow: isFilled
                      ? "0 0 0 1px rgba(255,255,255,0.22), 0 0 14px rgba(255,255,255,0.18), inset 0 0 10px rgba(255,255,255,0.20)"
                      : "none",
                  }}
                  aria-hidden="true"
                >
                  {isFilled && Icon ? (
                    <div className="absolute inset-0 flex items-center justify-center text-white/95">
                      <Icon className="h-6 w-6" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div
            className={[
              dashboardCompact ? "hidden" : "mt-3 text-xs opacity-90 transition-all",
              celebrate && remaining === 0 ? "drop-shadow-[0_0_10px_rgba(245,158,11,0.65)]" : "",
            ].join(" ")}
          >
            {stampEmptyText}
          </div>
        </div>
      </div>

      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={businessName}
        description={`Member: ${memberText}`}
        allowOverlayClose={true}
        className="border-white/10"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-center rounded-lg bg-white p-4 -mt-4">
            {qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={qrSize}
                fgColor="#000000"
                bgColor="#ffffff"
                includeMargin={false}
                level="M"
              />
            ) : (
              <div className="text-sm text-muted-foreground">QR unavailable</div>
            )}
          </div>

          {/*
            No raw QR payload text in fullscreen modal.
          */}
        </div>
      </Modal>
    </div>
  );
}
