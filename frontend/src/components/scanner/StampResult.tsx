"use client";

import { BadgeCheck, Gift } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type StampResultProps = {
  currentStamps: number;
  requiredStamps: number;
  rewardUnlocked: boolean;
};

export function StampResult({
  currentStamps,
  requiredStamps,
  rewardUnlocked,
}: StampResultProps) {
  const remaining = Math.max(0, requiredStamps - currentStamps);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="size-4 text-success" />
          Stamp added
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="font-medium text-sm">
              {currentStamps}/{requiredStamps}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success"
              style={{
                width: `${Math.min(
                  100,
                  requiredStamps > 0 ? (currentStamps / requiredStamps) * 100 : 0,
                )}%`,
              }}
            />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {rewardUnlocked
              ? "Reward unlocked 🎉"
              : remaining === 1
                ? "1 more stamp to unlock your reward"
                : `${remaining} more stamps to unlock your reward`}
          </p>
        </div>

        {rewardUnlocked ? (
          <div className="flex items-center gap-2 rounded-lg border bg-secondary p-3">
            <Gift className="size-4 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Reward is ready</p>
              <p className="truncate text-xs text-muted-foreground">
                This customer can now redeem the reward.
              </p>
            </div>
            <div className="ml-auto">
              <Badge className="bg-success/10 text-success hover:bg-success/10">
                Unlocked
              </Badge>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
