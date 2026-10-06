"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, CreditCard, Download, Gift, Loader2, QrCode, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api";
import {
  createLoyaltyCard,
  getBusinessProfile,
  getLoyaltyCard,
  updateLoyaltyCard,
  type Business,
  type LoyaltyCard,
} from "@/lib/auth";
import { useAutoDismiss } from "@/lib/use-auto-dismiss";
import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";

const schema = z.object({
  reward_name: z.string().min(2, "Enter a reward name.").max(255),
  required_stamps: z
    .number()
    .int("Required stamps must be an integer.")
    .min(1, "Minimum is 1.")
    .max(10, "Maximum is 10."),
  reward_description: z
    .string()
    .max(80, "Maximum 80 characters.")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

function normalizeDescription(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function LoyaltyCardSettings() {
  const { token, user } = useAuth();

  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  useAutoDismiss(success, clearSuccess);

  const defaultValues: FormValues = useMemo(
    () => ({
      reward_name: "",
      required_stamps: 1,
      reward_description: "",
    }),
    [],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const [loyaltyResponse, businessResponse] = await Promise.all([
          getLoyaltyCard(token),
          getBusinessProfile(token),
        ]);
        if (!isMounted) return;

        setLoyaltyCard(loyaltyResponse.loyalty_card);
        setBusinessProfile(businessResponse.business);
        reset({
          reward_name: loyaltyResponse.loyalty_card.reward_name ?? "",
          required_stamps: loyaltyResponse.loyalty_card.required_stamps,
          reward_description: loyaltyResponse.loyalty_card.reward_description ?? "",
        });
      } catch (unknownError) {
        if (!isMounted) return;

        if (unknownError instanceof ApiError && unknownError.status === 404) {
          // Empty state: not configured yet
          setLoyaltyCard(null);
          reset(defaultValues);
          return;
        }

        setError("Loyalty card could not be loaded.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [defaultValues, reset, token]);

  const watched = watch();

  useEffect(() => {
    const current = watched.required_stamps;
    if (typeof current !== "number" || Number.isNaN(current)) return;
    if (current > 10) {
      reset(
        {
          ...watched,
          required_stamps: 10,
        },
        {
          keepDirty: true,
          keepTouched: true,
          keepErrors: true,
        },
      );
    }
  }, [reset, watched]);

  const preview = useMemo(() => {
    const requiredStamps = watched.required_stamps || 1;

    return {
      reward_name: watched.reward_name || "Reward",
      required_stamps: requiredStamps,
      reward_description: watched.reward_description ?? "",
    };
  }, [watched]);

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const payload = {
        reward_name: values.reward_name,
        required_stamps: values.required_stamps,
        reward_description: normalizeDescription(values.reward_description),
      };

      if (loyaltyCard) {
        const response = await updateLoyaltyCard(token, payload);
        setLoyaltyCard(response.loyalty_card);
        setSuccess(response.message);
      } else {
        const response = await createLoyaltyCard(token, payload);
        setLoyaltyCard(response.loyalty_card);
        setSuccess(response.message);
      }

      reset({
        reward_name: payload.reward_name,
        required_stamps: payload.required_stamps,
        reward_description: payload.reward_description ?? "",
      });
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.reward_name?.[0] ??
            unknownError.errors?.required_stamps?.[0] ??
            unknownError.errors?.reward_description?.[0] ??
            unknownError.message,
        );
        return;
      }
      setError("Loyalty card could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const business = businessProfile ?? user.business;
  const joinUrl = useMemo(() => {
    const slug = business?.slug?.trim();
    if (slug) {
      return `${window.location.origin}/user/login?join=${encodeURIComponent(slug)}`;
    }

    const businessId = business?.id?.trim();
    if (businessId) {
      return `${window.location.origin}/user/login?join_business_id=${encodeURIComponent(businessId)}`;
    }

    return "";
  }, [business?.id, business?.slug]);

  const [joinQrDataUrl, setJoinQrDataUrl] = useState<string>("");
  const [isJoinQrOpen, setIsJoinQrOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function generateQr() {
      if (!joinUrl) {
        if (active) setJoinQrDataUrl("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(joinUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 280,
        });
        if (active) setJoinQrDataUrl(dataUrl);
      } catch {
        if (active) setJoinQrDataUrl("");
      }
    }

    generateQr();

    return () => {
      active = false;
    };
  }, [joinUrl]);


  const downloadJoinQr = useCallback(() => {
    if (!joinQrDataUrl) return;
    const a = document.createElement("a");
    a.href = joinQrDataUrl;
    a.download = `${business?.slug ?? "business"}-join-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [business?.slug, joinQrDataUrl]);

  return (
    <DashboardShell activeItem="loyalty">
      <div className="mx-auto max-w-[1450px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[20px] border border-[#d6a33d]/25 bg-[linear-gradient(145deg,rgba(16,17,14,.94),rgba(8,9,7,.88))] p-5 shadow-[0_18px_55px_rgba(0,0,0,.25)] sm:p-6 flex items-start gap-3 lg:items-center lg:gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#d6a33d]/25 bg-[#8b5d12]/20 text-[#ffc857]">
            <CreditCard className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">
              Loyalty card settings
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
              Configure the reward users see on your premium digital loyalty
              card experience.
            </p>
          </div>
        </div>

        {success ? (
          <Alert className="border-success/30 text-foreground">{success}</Alert>
        ) : null}
        {error ? (
          <Alert className="border-red-500/30 text-red-600">{error}</Alert>
        ) : null}

        {isLoading ? (
          <LoyaltyCardSettingsSkeleton />
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <Card className="rounded-[20px] border-[#d6a33d]/25 bg-[linear-gradient(145deg,rgba(15,16,13,.96),rgba(8,9,7,.93))] shadow-[0_18px_55px_rgba(0,0,0,.3)]">
              <CardHeader>
                <CardTitle>{loyaltyCard ? "Edit loyalty card" : "Create loyalty card"}</CardTitle>
                <CardDescription>
                  One loyalty card per business. Updates are scoped to your tenant.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                  {!loyaltyCard ? (
                    <EmptyCreateHint />
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-[#d6a33d]/20 bg-[#d6a33d]/[.06] p-3 text-sm text-white/80">
                      <BadgeCheck className="size-4 text-success" />
                      <span>Current loyalty card is configured.</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Field
                      label="Reward name"
                      error={errors.reward_name?.message}
                    >
                      <Input {...register("reward_name")} placeholder="e.g. Free Coffee" />
                    </Field>

                    <Field
                      label="Required stamps"
                      error={errors.required_stamps?.message}
                    >
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        {...register("required_stamps", {
                          valueAsNumber: true,
                        })}
                      />
                    </Field>

                    <Field
                      label="Reward description"
                      error={errors.reward_description?.message}
                    >
                      <div className="space-y-1.5">
                        <Input
                          {...register("reward_description")}
                          maxLength={80}
                          placeholder="What does the reward unlock? (shown under reward name)"
                        />
                        <div className="flex justify-end text-[11px] text-muted-foreground">
                          {(watched.reward_description ?? "").length}/80
                        </div>
                      </div>
                    </Field>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button disabled={!isDirty || isSubmitting} type="submit" className="min-w-28 border-0 bg-[#efbd5d] font-semibold text-black hover:bg-[#f4c86f] disabled:bg-white/15 disabled:text-white/35">
                      {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <PremiumLoyaltyCardPreview
              business={business}
              preview={preview}
              onOpenJoinQr={() => setIsJoinQrOpen(true)}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={isJoinQrOpen}
        onClose={() => setIsJoinQrOpen(false)}
        title="Customer Join QR"
        description="Display this in store so customers can scan and join instantly."
      >
        <div className="space-y-3">
          {joinQrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={joinQrDataUrl}
              alt="Customer join QR code"
              className="mx-auto aspect-square h-auto w-full max-w-56 rounded-md border bg-white p-2"
            />
          ) : (
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              QR could not be generated because business identity is missing.
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={downloadJoinQr}
                disabled={!joinQrDataUrl}
              >
                <Download className="size-4" />
                Download QR
              </Button>
            </div>


          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}

function EmptyCreateHint() {
  return (
    <div className="space-y-2 rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-sm">
        <Gift className="size-4 text-muted-foreground" />
        <p className="font-medium">Not configured yet</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Create your loyalty card settings to unlock the branded reward experience
        for this business workspace.
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-white/80">{label}</Label>
      <div className="[&_input]:h-11 [&_input]:rounded-xl [&_input]:border-[#d6a33d]/20 [&_input]:bg-black/35 [&_input]:text-white [&_input]:focus-visible:ring-[#e7b354]/30">{children}</div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function PremiumLoyaltyCardPreview({
  business,
  preview,
  onOpenJoinQr,
}: {
  business: {
    name: string;
    logo_url: string | null;
    primary_color: string;
    hero_image_url?: string | null;
    hero_image_zoom?: number | null;
    hero_image_position_x?: number | null;
    hero_image_position_y?: number | null;
  } | null;
  preview: { reward_name: string; required_stamps: number; reward_description: string };
  onOpenJoinQr: () => void;
}) {
  const requiredStamps = Math.max(1, Math.floor(preview.required_stamps || 1));

  return (
    <Card className="h-fit overflow-hidden rounded-[20px] border-[#d6a33d]/25 bg-[linear-gradient(145deg,rgba(15,16,13,.96),rgba(8,9,7,.93))] shadow-[0_18px_55px_rgba(0,0,0,.3)]">
      <CardHeader>
        <CardTitle>Customer card preview</CardTitle>
        <CardDescription>
          Same card layout your customers see. Member data and QR are customer-specific.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="mx-auto w-full">
          <LoyaltyCardVisual
            businessName={business?.name ?? "Business"}
            businessLogoUrl={business?.logo_url}
            heroImageUrl={business?.hero_image_url}
            heroImageZoom={business?.hero_image_zoom}
            heroImagePositionX={business?.hero_image_position_x}
            heroImagePositionY={business?.hero_image_position_y}
            brandPrimaryColor={business?.primary_color}
            memberName="Customer name"
            rewardName={preview.reward_name || "Reward"}
            rewardDescription={preview.reward_description || null}
            cardNumber="preview"
            qrToken={null}
            showQrPayloadText={false}
            stampUiVariant="customer"
            progressPercent={0}
            currentStamps={0}
            requiredStamps={requiredStamps}
          />
        </div>
        <p className="text-xs leading-5 text-white/35">
          Preview starts at 0 stamps. Each customer sees their real name, progress and personal QR code.
        </p>
        <Button type="button" variant="outline" onClick={onOpenJoinQr} className="border-[#d6a33d]/30 bg-[#d6a33d]/10 text-[#ffd067] hover:bg-[#d6a33d]/20 hover:text-[#ffe09a]">
          <QrCode className="size-4" />
          Customer Join QR
        </Button>
      </CardContent>
    </Card>
  );
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function LoyaltyCardSettingsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardContent className="space-y-6 p-5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
