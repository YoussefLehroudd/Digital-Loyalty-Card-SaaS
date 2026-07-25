"use client";

type Props = {
  businessName: string;
  brandPrimaryColor?: string | null;
  cardNumber?: string | null;
  qrCode?: string | null;
  rewardName?: string | null;
  progressPercent: number;
  currentStamps: number;
  requiredStamps: number;
};

export default function LoyaltyCard({
  businessName,
  brandPrimaryColor,
  cardNumber,
  qrCode,
  rewardName,
  progressPercent,
  currentStamps,
  requiredStamps,
}: Props) {
  const primary = brandPrimaryColor ?? "#0f172a"; // slate-900
  const progress = Math.max(0, Math.min(100, progressPercent));

  const progressLabel =
    requiredStamps > 0 ? `${currentStamps}/${requiredStamps} stamps` : `${currentStamps} stamps`;

  // For Phase 1: qrCode is a string payload or url provided by backend.
  // If it’s missing, show a placeholder.
  return (
    <div
      className="rounded-2xl text-white overflow-hidden shadow-sm border border-white/10"
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, rgba(2,6,23,1) 100%)`,
      }}
    >
      <div className="p-5">
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

        <div className="mt-4 grid grid-cols-5 gap-3 items-center">
          <div className="col-span-3">
            <div className="text-xs text-white/80">Card code</div>
            <div className="font-mono text-sm break-words">
              {cardNumber ? cardNumber : "—"}
            </div>
          </div>

          <div className="col-span-2 flex flex-col items-end">
            <div className="text-xs text-white/80">QR</div>
            <div className="mt-1 w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
              {qrCode ? (
                // Minimal placeholder: backend provides qr_code string; frontend QR generation can be added later.
                <div className="text-[10px] text-white/90 text-center px-1 leading-tight">
                  QR
                </div>
              ) : (
                <div className="text-[10px] text-white/70 text-center px-1 leading-tight">
                  No QR
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
