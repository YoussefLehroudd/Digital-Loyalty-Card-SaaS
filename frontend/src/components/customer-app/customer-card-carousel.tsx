"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, QrCode, Trash2, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import type { CustomerCardItem } from "@/lib/customerAuth";
import { customerDeleteCard } from "@/lib/customerAuth";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

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

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [qrModalOpen, setQrModalOpen] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const showToast = (t: { type: "success" | "error"; message: string }) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 3500);
  };

  const current = cards[index] ?? cards[0];
  const businessColor = current.business.primary_color ?? "#111827";
  const progress = clampPercent(current.loyalty?.progress_percent ?? 0);
  const currentStamps = current.loyalty?.current_stamps ?? 0;
  const requiredStamps =
    current.loyalty?.required_stamps ?? current.loyalty_card?.required_stamps ?? 0;

  const qrValue = current.qr.qr_code ?? current.membership.qr_code ?? "QR unavailable";
  const displayName = `${current.membership.first_name ?? ""} ${current.membership.last_name ?? ""}`.trim();

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

      // Refresh cards (and let parent update selection).
      const refreshed = onRefresh ? await onRefresh() : [];
      setConfirmDeleteOpen(false);

      showToast({ type: "success", message: "Card deleted successfully." });

      // If last card, redirect to join.
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
            toast.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}

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
              Card {index + 1} of {cards.length}
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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/15 p-3">
              <p className="text-[10px] uppercase tracking-wide opacity-90">Member</p>
              <p className="mt-1 line-clamp-1 text-sm font-medium">
                {displayName || "Customer"}
              </p>
              <p className="mt-1 text-xs opacity-90">ID: {current.id}</p>
            </div>

            <div className="rounded-lg bg-white/15 p-3">
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide opacity-90">
                <div className="flex items-center gap-1">
                  <QrCode className="h-3 w-3" />
                  <span>QR Code</span>
                </div>
              </div>

              <button
                type="button"
                className="mt-2 w-full"
                onClick={() => setQrModalOpen(true)}
                aria-label="Tap to show QR fullscreen"
              >
                <div className="flex items-center justify-center rounded-lg bg-white p-3">
                  <div className="rounded-md bg-white">
                    <QRCodeSVG
                      value={qrValue}
                      size={96}
                      fgColor="#000000"
                      bgColor="#ffffff"
                      includeMargin={false}
                      level="M"
                      style={{ width: "100%", height: "auto", maxWidth: 112 }}
                    />
                  </div>
                </div>
              </button>

              <p className="mt-2 break-all font-mono text-[11px] opacity-85">
                {qrValue}
              </p>
            </div>
          </div>

          <div className="mt-3">
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
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Reward description</p>
            <p className="mt-1 text-sm">
              {current.loyalty_card?.reward_description ??
                "Collect all required stamps to unlock your reward."}
            </p>
          </div>

          <Button variant="outline" className="w-full" disabled>
            <WalletCards className="mr-2 h-4 w-4" />
            Add to Google Wallet (coming soon)
          </Button>
        </CardContent>
      </Card>

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

      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={current.business.name}
        description={`Member: ${displayName || "Customer"}`}
        allowOverlayClose={true}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-center rounded-lg bg-white p-4">
            <QRCodeSVG
              value={qrValue}
              size={220}
              fgColor="#000000"
              bgColor="#ffffff"
              includeMargin={false}
              level="M"
            />
          </div>

          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">QR token</div>
            <div className="mt-1 break-all font-mono text-[12px]">{qrValue}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
