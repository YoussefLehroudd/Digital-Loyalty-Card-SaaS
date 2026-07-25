"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, QrCode, WalletCards } from "lucide-react";

import type { CustomerCardItem } from "@/lib/customerAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function CustomerCardCarousel({
  cards,
  selectedId,
  onChange,
}: {
  cards: CustomerCardItem[];
  selectedId?: string | null;
  onChange?: (card: CustomerCardItem) => void;
}) {
  const initialIndex = useMemo(() => {
    if (!cards.length) return 0;
    if (!selectedId) return 0;
    const idx = cards.findIndex((c) => c.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [cards, selectedId]);

  const [index, setIndex] = useState(initialIndex);

  if (!cards.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No loyalty cards yet</CardTitle>
          <CardDescription>
            Visit a participating business and ask them to add you so your card appears here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const current = cards[index] ?? cards[0];
  const businessColor = current.business.primary_color ?? "#111827";
  const progress = clampPercent(current.loyalty?.progress_percent ?? 0);
  const currentStamps = current.loyalty?.current_stamps ?? 0;
  const requiredStamps = current.loyalty?.required_stamps ?? current.loyalty_card?.required_stamps ?? 0;
  const qrValue = current.qr.qr_code ?? current.membership.qr_code ?? "QR unavailable";
  const displayName = `${current.membership.first_name ?? ""} ${current.membership.last_name ?? ""}`.trim();

  const setAndNotify = (nextIndex: number) => {
    const normalized = Math.min(cards.length - 1, Math.max(0, nextIndex));
    setIndex(normalized);
    onChange?.(cards[normalized]);
  };

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="p-4 text-white" style={{ backgroundColor: businessColor }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs/4 opacity-90">Loyalty Card</p>
              <h3 className="line-clamp-1 text-lg font-semibold">{current.business.name}</h3>
              <p className="mt-1 line-clamp-1 text-xs opacity-90">
                {current.loyalty_card?.reward_name ?? "No reward configured"}
              </p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30">
              {index + 1}/{cards.length}
            </Badge>
          </div>

          <div className="mt-4 rounded-lg bg-black/20 p-3">
            <div className="flex items-center justify-between text-xs opacity-90">
              <span>Progress</span>
              <span>
                {currentStamps}/{requiredStamps} stamps
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progress}%` }}
                aria-label={`Loyalty progress ${progress}%`}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/15 p-3">
              <p className="text-[10px] uppercase tracking-wide opacity-90">Member</p>
              <p className="mt-1 line-clamp-1 text-sm font-medium">{displayName || "Customer"}</p>
              <p className="mt-1 text-xs opacity-90">ID: {current.id}</p>
            </div>

            <div className="rounded-lg bg-white/15 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-90">
                <QrCode className="h-3 w-3" />
                <span>QR Code</span>
              </div>
              <p className="mt-2 break-all font-mono text-[11px]">{qrValue}</p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Reward description</p>
            <p className="mt-1 text-sm">
              {current.loyalty_card?.reward_description ?? "Collect all required stamps to unlock your reward."}
            </p>
          </div>

          <Button variant="outline" className="w-full" disabled>
            <WalletCards className="mr-2 h-4 w-4" />
            Add to Google Wallet (coming soon)
          </Button>
        </CardContent>
      </Card>

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
    </div>
  );
}
