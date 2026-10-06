"use client";

import { CheckCircle2, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

export type StampResultProps = {
  currentStamps: number;
  requiredStamps: number;
  rewardUnlocked: boolean;
  /**
   * When true, show "Reward redeemed ✅" + "New loyalty card started" state
   * (modal stays open; actions are Close + Scan another).
   */
  rewardRedeemed?: boolean;
  rewardAlreadyReady?: boolean;
  onRedeemReward?: () => void;
  redeeming?: boolean;
  onClose?: () => void;
  onScanAnother?: () => void;
};

export function StampResult({
  currentStamps,
  requiredStamps,
  rewardUnlocked,
  rewardRedeemed,
  rewardAlreadyReady,
  onRedeemReward,
  redeeming,
  onClose,
  onScanAnother,
}: StampResultProps) {
  const remaining = Math.max(0, requiredStamps - currentStamps);

  const progressPct =
    requiredStamps > 0 ? Math.min(100, (currentStamps / requiredStamps) * 100) : 0;

  return (
    <Modal
      isOpen={true}
      onClose={() => onClose?.()}
      closeDisabled={!!redeeming}
      title={rewardRedeemed ? "Reward redeemed" : rewardAlreadyReady ? "Reward is ready" : "Stamp added"}
      description={rewardRedeemed ? "A new loyalty cycle has started." : rewardUnlocked ? "This customer is ready to redeem their reward." : "The customer's loyalty card has been updated."}
      icon={<CheckCircle2 />}
    >
      <Badge className={rewardUnlocked || rewardRedeemed ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-[#e7b354]/20 bg-[#e7b354]/10 text-[#f3bd55]"}>
        {rewardRedeemed ? "New loyalty card started" : rewardUnlocked ? "Reward unlocked" : "In progress"}
      </Badge>
          {/* content */}
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">
                  {currentStamps}/{requiredStamps}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[#f3bd55] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {rewardRedeemed
                  ? "Reward redeemed. A new loyalty cycle has started."
                  : rewardAlreadyReady
                    ? "This card is already complete. Redeem the reward before adding another stamp."
                    : rewardUnlocked
                    ? "Reward unlocked 🎉 This customer is ready to redeem."
                    : remaining === 1
                      ? "1 more stamp to unlock your reward"
                      : `${remaining} more stamps to unlock your reward`}
              </p>
            </div>

            {!rewardRedeemed && rewardUnlocked ? (
              <div className="flex items-center gap-2 rounded-2xl border border-[#e7b354]/20 bg-[#e7b354]/5 p-3">
                <Gift className="size-4 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Reward is ready</p>
                  <p className="text-xs text-muted-foreground">
                    {rewardAlreadyReady ? "No extra stamp was added. Redeem this reward to start the next cycle." : "This customer can redeem the reward now."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* action buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {rewardRedeemed ? (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => onClose?.()}
                  >
                    Close
                  </Button>

                  <Button
                    type="button"
                    onClick={() => onScanAnother?.()}
                  >
                    Scan another
                  </Button>
                </>
              ) : rewardUnlocked ? (
                <>
                  <Button
                    type="button"
                    onClick={() => onRedeemReward?.()}
                    disabled={!!redeeming}
                  >
                    Redeem Reward
                  </Button>

                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => onClose?.()}
                  >
                    Not now
                  </Button>

                  <Button
                    type="button"
                    onClick={() => onScanAnother?.()}
                  >
                    Scan another
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => onClose?.()}
                  >
                    Close
                  </Button>

                  <Button
                    type="button"
                    onClick={() => onScanAnother?.()}
                  >
                    Scan another
                  </Button>
                </>
              )}
            </div>
          </div>

    </Modal>
  );
}
