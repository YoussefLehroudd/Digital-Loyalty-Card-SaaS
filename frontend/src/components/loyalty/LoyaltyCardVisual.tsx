"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";

type Props = {
  businessName: string;
  brandPrimaryColor?: string | null;
  memberName?: string | null;

  rewardName?: string | null;
  rewardDescription?: string | null;

  cardNumber?: string | null;

  qrToken?: string | null;

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
  brandPrimaryColor,
  memberName,
  rewardName,
  rewardDescription,
  cardNumber,
  qrToken,
  progressPercent,
  currentStamps,
  requiredStamps,
}: Props) {
  const primary = brandPrimaryColor ?? "#0f172a";
  const progress = clampPercent(progressPercent);

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
        background: `linear-gradient(135deg, ${primary} 0%, rgba(2,6,23,1) 100%)`,
      }}
    >
      {/* dark overlay (source of truth for pixel matching) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.25))",
          zIndex: 1,
        }}
      />

      <div className="relative z-[2] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-white/80">Loyalty card</div>
            <div className="text-xl font-semibold truncate">{businessName}</div>
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

            {/* reward description */}
            {showRewardDescription ? (
              <div className="mt-2 text-xs text-white/80 line-clamp-2">
                {rewardDescription}
              </div>
            ) : null}
          </div>

          {/* QR */}
          <div className="col-span-2 flex flex-col items-end">
            <div className="text-xs text-white/80">QR</div>

            <button
              type="button"
              className="mt-1 w-[56px] h-[56px] rounded-lg bg-white/10 flex items-center justify-center"
              onClick={() => setQrModalOpen(true)}
              aria-label="Tap to show QR fullscreen"
              disabled={!qrValue}
            >
              {qrValue ? (
                <div className="rounded-md bg-white p-1 flex items-center justify-center">
                  <QRCodeSVG
                    value={qrValue}
                    size={40}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    includeMargin={false}
                    level="M"
                  />
                </div>
              ) : (
                <div className="text-[10px] text-white/70 text-center px-1 leading-tight">
                  No QR
                </div>
              )}
            </button>

            {qrValue ? (
              <div className="mt-2 w-full text-right">
                <div className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] break-all">
                  {qrValue}
                </div>
              </div>
            ) : null}
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
          <div className="flex items-center justify-center rounded-lg bg-white p-4">
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

          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">QR token</div>
            <div className="mt-1 break-all font-mono text-[12px]">{qrValue ?? "—"}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
