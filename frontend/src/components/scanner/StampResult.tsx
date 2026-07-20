"use client";

import { CheckCircle2, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  onRedeemReward,
  redeeming,
  onClose,
  onScanAnother,
}: StampResultProps) {
  const remaining = Math.max(0, requiredStamps - currentStamps);

  const progressPct =
    requiredStamps > 0 ? Math.min(100, (currentStamps / requiredStamps) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: "bb-fade-in 220ms ease-out both",
        }}
      />

      <div
        className="relative w-full max-w-md"
        style={{
          animation: "bb-zoom-fade 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        }}
      >
        <Card className="relative overflow-hidden border-border/60 bg-card/95 p-5 shadow-2xl">
          {/* animated success icon */}
          <div className="flex items-start gap-3">
            <div className="relative grid place-items-center">
              <div className="absolute -inset-2 rounded-full bg-success/10 blur-sm" />
              <div
                className="grid place-items-center rounded-full bg-success/10 p-2.5"
                style={{
                  animation: "bb-check-pop 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
                }}
              >
                <CheckCircle2 className="size-10 text-success" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted-foreground">Success</div>

              {rewardRedeemed ? (
                <>
                  <div className="mt-0.5 text-lg font-semibold">
                    Reward redeemed ✅
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="bg-success/10 text-success hover:bg-success/10">
                      New loyalty card started
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-0.5 text-lg font-semibold">Stamp added 🎉</div>
                  <div className="mt-1 flex items-center gap-2">
                    {rewardUnlocked ? (
                      <Badge className="bg-success/10 text-success hover:bg-success/10">
                        Reward unlocked
                      </Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">
                        In progress
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* content */}
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">
                  {currentStamps}/{requiredStamps}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {rewardRedeemed
                  ? "Customer completed the loyalty card. Redeem is ready for the next cycle."
                  : rewardUnlocked
                    ? "Reward unlocked 🎉 This customer is ready to redeem."
                    : remaining === 1
                      ? "1 more stamp to unlock your reward"
                      : `${remaining} more stamps to unlock your reward`}
              </p>
            </div>

            {!rewardRedeemed && rewardUnlocked ? (
              <div className="flex items-center gap-2 rounded-lg border bg-secondary p-3">
                <Gift className="size-4 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Reward is ready</p>
                  <p className="truncate text-xs text-muted-foreground">
                    This customer can redeem the reward now.
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

          {/* inline keyframes (local to this page) */}
          <style jsx>{`
            @keyframes bb-fade-in {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes bb-zoom-fade {
              from {
                opacity: 0;
                transform: translateY(6px) scale(0.96);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            @keyframes bb-check-pop {
              0% {
                transform: scale(0.85);
                filter: blur(0.2px);
              }
              60% {
                transform: scale(1.07);
              }
              100% {
                transform: scale(1);
              }
            }
          `}</style>
        </Card>
      </div>
    </div>
  );
}
