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

const schema = z.object({
  reward_name: z.string().min(2, "Enter a reward name.").max(255),
  required_stamps: z
    .number()
    .int("Required stamps must be an integer.")
    .min(1, "Minimum is 1.")
    .max(10, "Maximum is 10."),
  reward_description: z
    .string()
    .max(5000, "Description is too long.")
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <CreditCard className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              Loyalty card settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle>{loyaltyCard ? "Edit loyalty card" : "Create loyalty card"}</CardTitle>
                <CardDescription>
                  One loyalty card per business. Updates are scoped to your tenant.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  {!loyaltyCard ? (
                    <EmptyCreateHint />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm">
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
                      <Input
                        {...register("reward_description")}
                        placeholder="What does the reward unlock? (shown under reward name)"
                      />
                    </Field>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button disabled={!isDirty || isSubmitting} type="submit">
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
              className="mx-auto h-56 w-56 rounded-md border bg-white p-2"
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
      <Label htmlFor={id}>{label}</Label>
      {children}
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
  const brandColor = business?.primary_color ?? "#171717";
  const businessName = business?.name ?? "Business";
  const heroImageUrl = business?.hero_image_url ?? null;
  const heroZoom = clamp(Number(business?.hero_image_zoom ?? 1.2), 1, 3);
  const heroPositionX = clamp(Number(business?.hero_image_position_x ?? 0), -50, 50);
  const heroPositionY = clamp(Number(business?.hero_image_position_y ?? 0), -50, 50);
  const showHero = Boolean(heroImageUrl);

  const stampGoal = Math.max(1, Math.floor(preview.required_stamps || 1));
  const maxSlots = 10;
  const filled = Math.min(stampGoal, maxSlots);

  const remaining = Math.max(0, stampGoal - filled);

  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader>
        <CardTitle>Premium card preview</CardTitle>
        <CardDescription>Live preview based on your configuration.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          className="relative rounded-lg border p-4 text-white overflow-hidden"
          style={{ backgroundColor: showHero ? "transparent" : brandColor }}
        >
          {showHero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl!}
              alt="Loyalty card background preview"
              className="absolute inset-0 h-full w-full select-none"
              style={{
                objectFit: "cover",
                transform: `scale(${heroZoom})`,
                transformOrigin: "center",
                objectPosition: `${heroPositionX + 50}% ${heroPositionY + 50}%`,
                zIndex: 0,
              }}
            />
          ) : null}

          <div
            className="absolute inset-0"
            style={{
              background: showHero
                ? "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))"
                : "transparent",
              zIndex: 1,
            }}
          />
          <div className="relative" style={{ zIndex: 2 }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15">
                {business?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${businessName} logo`}
                    className="size-full object-cover"
                    src={business.logo_url}
                  />
                ) : (
                  <span className="text-sm font-semibold">
                    {getInitials(businessName)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{businessName}</p>
                <p className="text-xs opacity-75">Reward unlock card</p>
              </div>
            </div>
            <Badge className="bg-white/10 text-white">
              <BadgeCheck className="size-4" />
              {stampGoal} stamps
            </Badge>
          </div>

          <div className="mt-6 space-y-3">
            <div className="space-y-1">
              <p className="text-xs opacity-80">Reward</p>
              <p className="truncate text-lg font-semibold">
                {preview.reward_name || "Reward"}
              </p>
              {preview.reward_description ? (
                <p className="text-xs opacity-90">
                  {preview.reward_description}
                </p>
              ) : (
                <p className="text-xs opacity-70">Add a description to personalize the card.</p>
              )}
            </div>

            <div className="rounded-lg bg-black/10 p-3">
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

              <div className="mt-3 text-xs opacity-90">
                {stampGoal <= maxSlots ? (
                  remaining === 0 ? (
                    "Reward ready to unlock"
                  ) : (
                    `${remaining} more stamp${remaining === 1 ? "" : "s"} to unlock`
                  )
                ) : (
                  `Goal: ${stampGoal} stamps`
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={onOpenJoinQr}>
            <QrCode className="size-4" />
            Customer Join QR
          </Button>
        </div>

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
