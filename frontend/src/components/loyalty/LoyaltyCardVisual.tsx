"use client";

import { useMemo, useState } from "react";
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

  const stampGoal = Math.max(1, Math.floor(requiredStamps || 1));
  const maxSlots = 10;
  const filled = Math.min(stampGoal, maxSlots);
  const remaining = Math.max(0, stampGoal - filled);

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

  return (
    <div
      className="relative rounded-2xl text-white overflow-hidden shadow-sm border border-white/10"
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

      <div className="relative z-[2] p-5">
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

              <div className="text-xl font-semibold truncate">{businessName}</div>
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

        <div className="mt-4">
          <div className="h-2 w-full bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: primary }}
            />
          </div>
          <div className="mt-2 text-xs text-white/80">{progressLabel}</div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-3 items-start">
          {/* Member */}
          <div className="col-span-3">
            <div className="text-xs text-white/80">{memberName ? "Member" : "Card code"}</div>
            <div className="mt-1 font-semibold text-sm break-words">
              {memberName ? memberText : cardNumber ? cardNumber : "—"}
            </div>

            {showRewardDescription ? (
              <div className="mt-2 text-xs text-white/80 line-clamp-2">
                {rewardDescription}
              </div>
            ) : null}
          </div>

          {/* QR */}
          <div className="col-span-2">
            <button
              type="button"
              className="w-full flex flex-col items-center -mt-9"
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

              {/* raw payload below QR, small monospace */}
              {/*
                Customers must never see the raw membership/QR payload.
              */}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-black/10 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="opacity-90">Stamp progress</span>
            <span className="opacity-90">
              {filled}/{stampGoal}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: maxSlots }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded-md border border-white/20"
                style={{
                  backgroundColor:
                    index < filled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.10)",
                }}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="mt-3 text-xs opacity-90">{stampEmptyText}</div>
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
