"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  Building2,
  ImageUp,
  Loader2,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
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
import { ApiError } from "@/lib/api";
import {
  getBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
  type Business,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Enter a business name.").max(255),
  email: z.string().email("Enter a valid business email."),
  phone: z.string().max(40).optional(),
  address: z.string().max(1000).optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a valid hex color."),
});

type ProfileValues = z.infer<typeof schema>;

type BrandingImageState = {
  dataUrl: string;
  zoom: number; // 1..3
  offsetXPercent: number; // -50..50
};

const BRANDING_IMAGE_STORAGE_KEY =
  "digital_loyalty_branding_hero_image_v1";

export function BusinessProfileSettings() {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [brandingImage, setBrandingImage] = useState<BrandingImageState | null>(
    null,
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BRANDING_IMAGE_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as BrandingImageState;
      if (!parsed?.dataUrl) return;

      setBrandingImage({
        dataUrl: parsed.dataUrl,
        zoom: typeof parsed.zoom === "number" ? clamp(parsed.zoom, 1, 3) : 1,
        offsetXPercent:
          typeof parsed.offsetXPercent === "number"
            ? clamp(parsed.offsetXPercent, -50, 50)
            : 0,
      });
    } catch {
      // ignore
    }
  }, []);

  function persistBrandingImage(next: BrandingImageState | null) {
    setBrandingImage(next);
    try {
      if (!next) {
        window.localStorage.removeItem(BRANDING_IMAGE_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(
        BRANDING_IMAGE_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // ignore
    }
  }


  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      primary_color: "#171717",
    },
  });

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getBusinessProfile(token);
        if (!isMounted) return;

        setBusiness(response.business);
        reset({
          name: response.business.name,
          email: response.business.email,
          phone: response.business.phone ?? "",
          address: response.business.address ?? "",
          primary_color: response.business.primary_color,
        });
      } catch {
        setError("Business profile could not be loaded.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [reset, token]);

  const watchedValues = watch();
  const previewBusiness: Business | null = business
    ? {
        ...business,
        name: watchedValues.name || business.name,
        email: watchedValues.email || business.email,
        phone: watchedValues.phone || null,
        address: watchedValues.address || null,
        primary_color: watchedValues.primary_color || business.primary_color,
      }
    : null;

  async function onSubmit(values: ProfileValues) {
    setSuccess(null);
    setError(null);

    try {
      const response = await updateBusinessProfile(token, {
        ...values,
        phone: values.phone || null,
        address: values.address || null,
      });

      setBusiness(response.business);
      reset({
        name: response.business.name,
        email: response.business.email,
        phone: response.business.phone ?? "",
        address: response.business.address ?? "",
        primary_color: response.business.primary_color,
      });
      setSuccess(response.message);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.email?.[0] ??
            unknownError.errors?.primary_color?.[0] ??
            unknownError.message,
        );
        return;
      }
      setError("Business profile could not be updated.");
    }
  }

  async function onLogoSelected(file?: File) {
    if (!file) return;

    setSuccess(null);
    setError(null);
    setIsUploading(true);

    try {
      const response = await uploadBusinessLogo(token, file);
      setBusiness(response.business);
      setSuccess(response.message);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(unknownError.errors?.logo?.[0] ?? unknownError.message);
        return;
      }
      setError("Logo upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <DashboardShell activeItem="settings">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              Business profile
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage the business identity customers will see across public
              registration and future loyalty experiences.
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
          <SettingsSkeleton />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle>Business information</CardTitle>
                <CardDescription>
                  Keep contact details and brand color accurate for this tenant.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form
                  className="space-y-6"
                  onSubmit={handleSubmit(onSubmit)}
                >
                  <LogoUploader
                    business={business}
                    fileInputRef={fileInputRef}
                    isUploading={isUploading}
                    onLogoSelected={onLogoSelected}
                  />

                  <HeroImageUploader
                    heroImage={brandingImage}
                    onLiveUpdate={(next) => setBrandingImage(next)}
                    onSave={(next) => {
                      console.log("SAVING HERO:", next);
                      persistBrandingImage(next);
                    }}
                    onClear={() => {
                      console.log("CLEAR HERO");
                      persistBrandingImage(null);
                    }}
                    onSuccess={setSuccess}
                    onError={setError}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <ProfileField
                      error={errors.name?.message}
                      icon={Building2}
                      label="Business name"
                    >
                      <Input {...register("name")} />
                    </ProfileField>
                    <ProfileField
                      error={errors.email?.message}
                      icon={Mail}
                      label="Business email"
                    >
                      <Input type="email" {...register("email")} />
                    </ProfileField>
                    <ProfileField
                      error={errors.phone?.message}
                      icon={Phone}
                      label="Phone"
                    >
                      <Input placeholder="+1 555 0100" {...register("phone")} />
                    </ProfileField>
                    <ProfileField
                      error={errors.primary_color?.message}
                      icon={Palette}
                      label="Primary color"
                    >
                      <div className="grid grid-cols-[52px_1fr] gap-2">
                        <Input
                          aria-label="Primary color picker"
                          className="h-10 p-1"
                          type="color"
                          value={watchedValues.primary_color}
                          onChange={(event) =>
                            setValue("primary_color", event.target.value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                        <Input {...register("primary_color")} />
                      </div>
                    </ProfileField>
                  </div>

                  <ProfileField
                    error={errors.address?.message}
                    icon={MapPin}
                    label="Address"
                  >
                    <Input placeholder="Street, city, country" {...register("address")} />
                  </ProfileField>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button disabled={!isDirty || isSubmitting} type="submit">
                      {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {isSubmitting ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            
            <BrandingPreview business={previewBusiness} heroImage={brandingImage} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function LogoUploader({
  business,
  fileInputRef,
  isUploading,
  onLogoSelected,
}: {
  business: Business | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  onLogoSelected: (file?: File) => void;
}) {
  const initials = getInitials(business?.name ?? "Business");

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card">
          {business?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${business.name} logo`}
              className="size-full object-cover"
              src={business.logo_url}
            />
          ) : (
            <span className="text-lg font-semibold">{initials}</span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Business logo</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            PNG, JPG, or WEBP. Maximum upload size is 2 MB.
          </p>
        </div>
      </div>

      <div>
        <input
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          ref={fileInputRef}
          type="file"
          onChange={(event) => onLogoSelected(event.target.files?.[0])}
        />
        <Button
          disabled={isUploading}
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageUp className="size-4" />
          )}
          {isUploading ? "Uploading..." : "Upload logo"}
        </Button>
      </div>
    </div>
  );
}

function HeroImageUploader({
  heroImage,
  onLiveUpdate,
  onSave,
  onClear,
  onSuccess,
  onError,
}: {
  heroImage: BrandingImageState | null;
  onLiveUpdate: (next: BrandingImageState) => void;
  onSave: (next: BrandingImageState | null) => void;
  onClear: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<BrandingImageState | null>(heroImage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(heroImage);
  }, [heroImage]);

  const canSave =
    Boolean(draft) &&
    (
      !heroImage ||
      draft?.dataUrl !== heroImage?.dataUrl ||
      draft?.zoom !== heroImage?.zoom ||
      draft?.offsetXPercent !== heroImage?.offsetXPercent
    );

  async function handleHeroFile(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError("Please select an image file.");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      onError("Image is too large (max 5MB).");
      return;
    }

    try {
      onError("");
      const dataUrl = await readFileAsDataURL(file);
      const next: BrandingImageState = {
        dataUrl,
        zoom: 1.2,
        offsetXPercent: 0,
      };
      setDraft(next);
      onLiveUpdate(next);
    } catch {
      onError("Failed to read image file.");
    }
  }

  function applyDraft() {
    if (!draft) return;

    console.log("APPLY HERO:", draft);

    onSave(draft);
    onSuccess("Branding hero image updated.");
  }

  function clearDraft() {
    setDraft(null);
    onClear();
    onSuccess("Branding hero image cleared.");
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Card background image</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Upload an image, adjust zoom + horizontal position, then save to
            preview on the right.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => handleHeroFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageUp className="size-4" />
            Upload image
          </Button>

          {draft ? (
            <Button type="button" variant="outline" onClick={clearDraft}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      {draft ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button type="button" disabled={!canSave} onClick={applyDraft}>
              <Save className="size-4" />
              Save changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Upload an image to enable zoom + position controls.
        </div>
      )}
    </div>
  );
}

function ProfileField({
  children,
  error,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  icon: React.ElementType;
  label: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2" htmlFor={id}>
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function BrandingPreview({
  business,
  heroImage,
}: {
  business: Business | null;
  heroImage: BrandingImageState | null;
}) {
  const brandColor = business?.primary_color ?? "#171717";
  const businessName = business?.name ?? "Business";
  const showHero = Boolean(heroImage?.dataUrl);

  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader>
        <CardTitle>Branding preview</CardTitle>
        <CardDescription>
          A lightweight preview of the customer-facing brand style.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          className="relative min-h-[260px] overflow-hidden rounded-lg border p-4 text-white"
          style={{ backgroundColor: showHero ? "transparent" : brandColor }}
        >
          {showHero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage!.dataUrl}
              alt="Branding background preview"
              className="absolute inset-0 h-full w-full select-none"
              style={{
                objectFit: "cover",
                transform: `scale(${heroImage!.zoom})`,
                transformOrigin: "center",
                objectPosition: `${heroImage!.offsetXPercent + 50}% 50%`,
                zIndex: 0,
              }}
            />
          ) : null}

          {/* overlay above hero image */}
          <div
            className="absolute inset-0"
            style={{
              background: showHero
                ? "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))"
                : "transparent",
              zIndex: 1,
            }}
          />

          {/* card content above overlay */}
          <div className="relative" style={{ zIndex: 2 }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15">
                  {business?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`${business.name} logo`}
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
                  <p className="truncate text-sm font-semibold">
                    {businessName}
                  </p>
                  <p className="text-xs opacity-75">
                    Member experience
                  </p>
                </div>
              </div>

              <BadgeCheck className="size-5 shrink-0" />
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  className={cn(
                    "aspect-square rounded-md border border-white/20",
                    index < 4 ? "bg-white/90" : "bg-white/10",
                  )}
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-background p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Primary color</span>
            <span className="font-medium">
              {brandColor.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="size-8 rounded-lg border"
              style={{ backgroundColor: brandColor }}
            />

            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full w-2/3 rounded-full"
                style={{ backgroundColor: brandColor }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardContent className="space-y-5 p-5">
          <Skeleton className="h-20 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
