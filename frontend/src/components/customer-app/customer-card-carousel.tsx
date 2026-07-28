"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";

import type { CustomerCardItem } from "@/lib/customerAuth";
import { customerDeleteCard } from "@/lib/customerAuth";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";

import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CustomerCardCarousel({
  cards,
  selectedId,
  onChange,
  onRefresh,
}: {
  cards: CustomerCardItem[];
  selectedId?: string | null;
  onChange?: (card: CustomerCardItem) => void;
  onRefresh?: () => Promise<CustomerCardItem[]>;
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
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const showToast = (t: { type: "success" | "error"; message: string }) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 3500);
  };

  const current = cards[index] ?? cards[0];

  const displayName = `${current.membership.first_name ?? ""} ${current.membership.last_name ?? ""}`.trim();
  const rewardName = current.loyalty_card?.reward_name ?? null;
  const rewardDescription = current.loyalty_card?.reward_description ?? null;
  const qrValue = current.qr.qr_code ?? current.membership.qr_code ?? null;

  const progressPercent = current.loyalty?.progress_percent ?? 0;
  const currentStamps = current.loyalty?.current_stamps ?? 0;
  const requiredStamps =
    current.loyalty?.required_stamps ?? current.loyalty_card?.required_stamps ?? 0;

  const setAndNotify = (nextIndex: number) => {
    const normalized = Math.min(cards.length - 1, Math.max(0, nextIndex));
    setIndex(normalized);
    onChange?.(cards[normalized]);
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

  if (!cards.length) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Visit a participating business and ask them to add you so your card appears here.
          </p>
        </CardContent>
      </Card>
    );
  }

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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="sr-only">Loyalty card preview</div>
          <Badge className="bg-white/20 text-white border-white/30">
            Card {index + 1} of {cards.length}
          </Badge>
        </div>

        <LoyaltyCardVisual
          businessName={current.business.name}
          businessLogoUrl={current.business.logo_url}
          heroImageUrl={current.business.hero_image_url}
          heroImageZoom={current.business.hero_image_zoom}
          heroImagePositionX={current.business.hero_image_position_x}
          heroImagePositionY={current.business.hero_image_position_y}
          brandPrimaryColor={current.business.primary_color}
          memberName={displayName}
          rewardName={rewardName}
          rewardDescription={rewardDescription}
          cardNumber={current.id}
          qrToken={qrValue}
          showQrPayloadText={true}
          progressPercent={progressPercent}
          currentStamps={currentStamps}
          requiredStamps={requiredStamps}
        />

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

        <Button variant="outline" className="w-full" disabled>
          <WalletCards className="mr-2 h-4 w-4" />
          Add to Google Wallet (coming soon)
        </Button>
      </div>

      {showNav ? (
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
