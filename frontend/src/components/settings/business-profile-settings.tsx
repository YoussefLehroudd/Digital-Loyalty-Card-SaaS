"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeCheck,
  Building2,
  ImageUp,
  KeyRound,
  Trash2,
  Loader2,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
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
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  forgotPassword,
  getBusinessProfile,
  removeAccountAvatar,
  updateAccountPassword,
  updateAccountProfile,
  updateBusinessProfile,
  uploadAccountAvatar,
  uploadBusinessHeroImage,
  uploadBusinessLogo,
  type Business,
} from "@/lib/auth";
import { useAutoDismiss } from "@/lib/use-auto-dismiss";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Enter a business name.").max(255),
  email: z.string().email("Enter a valid business email."),
  phone: z.string().max(40).optional(),
  address: z.string().max(1000).optional(),
  google_wallet_show_background: z.boolean(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a valid hex color."),
});

const accountSchema = z.object({
  name: z.string().min(2, "Enter your name.").max(255),
  email: z.string().email("Enter a valid login email."),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    password: z.string().min(10, "Use at least 10 characters."),
    password_confirmation: z.string().min(1, "Confirm the new password."),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: "Password confirmation does not match.",
    path: ["password_confirmation"],
  });

type ProfileValues = z.infer<typeof schema>;
type AccountValues = z.infer<typeof accountSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

type BrandingImageState = {
  dataUrl: string;
  zoom: number; // 1..3
  offsetXPercent: number; // -50..50
  offsetYPercent: number; // -50..50
  publicId: string | null;
};

export function BusinessProfileSettings() {
  const { token, user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isAvatarRemoving, setIsAvatarRemoving] = useState(false);
  const [isResetSending, setIsResetSending] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  useAutoDismiss(success, clearSuccess);

  const [brandingImage, setBrandingImage] = useState<BrandingImageState | null>(null);
  const [savedBrandingImage, setSavedBrandingImage] = useState<BrandingImageState | null>(
    null,
  );

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
      google_wallet_show_background: true,
    },
  });

  const {
    register: registerAccount,
    handleSubmit: handleAccountSubmit,
    reset: resetAccount,
    formState: {
      errors: accountErrors,
      isSubmitting: isAccountSubmitting,
      isDirty: isAccountDirty,
    },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: {
      errors: passwordErrors,
      isSubmitting: isPasswordSubmitting,
      isDirty: isPasswordDirty,
    },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      password: "",
      password_confirmation: "",
    },
  });

  useEffect(() => {
    resetAccount({
      name: user.name,
      email: user.email,
    });
  }, [resetAccount, user.email, user.name]);

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
          google_wallet_show_background: response.business.google_wallet_show_background ?? true,
        });

        const persistedHero = toBrandingState(response.business);
        setBrandingImage(persistedHero);
        setSavedBrandingImage(persistedHero);
      } catch {
        setError("Business profile could not be loaded.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [reset, token]);

  const watchedValues = watch();

  const hasHeroChanges = useMemo(() => {
    return !isSameBrandingImage(brandingImage, savedBrandingImage);
  }, [brandingImage, savedBrandingImage]);

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

  async function onAccountSubmit(values: AccountValues) {
    setSuccess(null);
    setError(null);

    try {
      const response = await updateAccountProfile(token, values);
      resetAccount({
        name: response.user.name,
        email: response.user.email,
      });
      updateUser(response.user);
      setSuccess(response.message);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.email?.[0] ??
            unknownError.errors?.name?.[0] ??
            unknownError.message,
        );
        return;
      }
      setError("Account profile could not be updated.");
    }
  }

  async function onAvatarSelected(file?: File) {
    if (!file) return;

    setSuccess(null);
    setError(null);
    setIsAvatarUploading(true);

    try {
      const response = await uploadAccountAvatar(token, file);
      updateUser(response.user);
      setSuccess(response.message);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(unknownError.errors?.avatar?.[0] ?? unknownError.message);
      } else {
        setError("Profile photo upload failed.");
      }
    } finally {
      setIsAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function onAvatarRemove() {
    setSuccess(null);
    setError(null);
    setIsAvatarRemoving(true);

    try {
      const response = await removeAccountAvatar(token);
      updateUser(response.user);
      setSuccess(response.message);
    } catch (unknownError) {
      setError(unknownError instanceof ApiError ? unknownError.message : "Profile photo could not be removed.");
    } finally {
      setIsAvatarRemoving(false);
    }
  }

  async function onForgotPassword() {
    setSuccess(null);
    setError(null);
    setIsResetSending(true);
    try {
      const response = await forgotPassword({ email: user.email });
      setSuccess(response.message);
    } catch (unknownError) {
      setError(unknownError instanceof ApiError ? unknownError.message : "Password reset email could not be sent.");
    } finally {
      setIsResetSending(false);
    }
  }

  async function onPasswordSubmit(values: PasswordValues) {
    setSuccess(null);
    setError(null);

    try {
      const response = await updateAccountPassword(token, values);
      resetPassword();
      setSuccess(response.message);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.current_password?.[0] ??
            unknownError.errors?.password?.[0] ??
            unknownError.errors?.password_confirmation?.[0] ??
            unknownError.message,
        );
        return;
      }
      setError("Password could not be updated.");
    }
  }

  async function onSubmit(values: ProfileValues) {
    setSuccess(null);
    setError(null);

    if (!business) return;

    try {
      const response = await updateBusinessProfile(token, {
        ...values,
        phone: values.phone || null,
        address: values.address || null,
        hero_image_url: brandingImage?.dataUrl ?? null,
        hero_image_public_id: brandingImage?.publicId ?? null,
        hero_image_zoom: brandingImage?.zoom ?? null,
        hero_image_position_x: brandingImage?.offsetXPercent ?? null,
        hero_image_position_y: brandingImage?.offsetYPercent ?? null,
        google_wallet_show_background: values.google_wallet_show_background,
      });

      setBusiness(response.business);
      reset({
        name: response.business.name,
        email: response.business.email,
        phone: response.business.phone ?? "",
        address: response.business.address ?? "",
        primary_color: response.business.primary_color,
        google_wallet_show_background: response.business.google_wallet_show_background ?? true,
      });

      const persistedHero = toBrandingState(response.business);
      setBrandingImage(persistedHero);
      setSavedBrandingImage(persistedHero);

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
      <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-6 sm:px-7 lg:px-10">
        <div className="flex flex-col gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[#8b5d12]/25 text-[#ffc857] shadow-[0_8px_24px_rgba(231,179,84,.08)]">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight text-white">
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

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(13,14,11,.94),rgba(8,9,7,.88))] shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-muted-foreground" />
                Owner profile
              </CardTitle>
              <CardDescription>
                Login identity for the person managing this business dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleAccountSubmit(onAccountSubmit)}>
                <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground ring-1 ring-border">
                      {user.avatar_url ? (
                        <img
                          alt={`${user.name} profile`}
                          className="h-full w-full object-cover"
                          src={user.avatar_url}
                        />
                      ) : (
                        getInitials(user.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Business owner account
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        JPG, PNG, WEBP or GIF · max 10 MB
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <input
                      ref={avatarInputRef}
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      type="file"
                      onChange={(event) => void onAvatarSelected(event.target.files?.[0])}
                    />
                    <Button
                      disabled={isAvatarUploading || isAvatarRemoving}
                      onClick={() => avatarInputRef.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      {isAvatarUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ImageUp className="size-4" />
                      )}
                      {user.avatar_url ? "Change photo" : "Add photo"}
                    </Button>
                    {user.avatar_url ? (
                      <Button
                        disabled={isAvatarUploading || isAvatarRemoving}
                        onClick={() => void onAvatarRemove()}
                        type="button"
                        variant="ghost"
                      >
                        {isAvatarRemoving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ProfileField
                    error={accountErrors.name?.message}
                    icon={UserRound}
                    label="Owner name"
                  >
                    <Input {...registerAccount("name")} />
                  </ProfileField>
                  <ProfileField
                    error={accountErrors.email?.message}
                    icon={Mail}
                    label="Login email"
                  >
                    <Input type="email" {...registerAccount("email")} />
                  </ProfileField>
                </div>

                <div className="flex justify-end">
                  <Button
                    disabled={!isAccountDirty || isAccountSubmitting}
                    type="submit"
                  >
                    {isAccountSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {isAccountSubmitting ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(13,14,11,.94),rgba(8,9,7,.88))] shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-muted-foreground" />
                Security
              </CardTitle>
              <CardDescription>
                Change the password used to access this business workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                <ProfileField
                  error={passwordErrors.current_password?.message}
                  icon={KeyRound}
                  label="Current password"
                >
                  <PasswordInput autoComplete="current-password" {...registerPassword("current_password")} />
                </ProfileField>

                <div className="grid gap-4 md:grid-cols-2">
                  <ProfileField
                    error={passwordErrors.password?.message}
                    icon={KeyRound}
                    label="New password"
                  >
                    <PasswordInput autoComplete="new-password" {...registerPassword("password")} />
                  </ProfileField>
                  <ProfileField
                    error={passwordErrors.password_confirmation?.message}
                    icon={KeyRound}
                    label="Confirm password"
                  >
                    <PasswordInput autoComplete="new-password" {...registerPassword("password_confirmation")} />
                  </ProfileField>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    disabled={isResetSending}
                    type="button"
                    onClick={() => void onForgotPassword()}
                  >
                    {isResetSending ? "Sending reset email..." : "Forgot your password? Send a secure reset link"}
                  </button>
                  <Button
                    disabled={!isPasswordDirty || isPasswordSubmitting}
                    type="submit"
                  >
                    {isPasswordSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    {isPasswordSubmitting ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <SettingsSkeleton />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(13,14,11,.94),rgba(8,9,7,.88))] shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-md">
              <CardHeader>
                <CardTitle>Business information</CardTitle>
                <CardDescription>
                  Keep contact details and brand color accurate for this tenant.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <LogoUploader
                    business={business}
                    fileInputRef={fileInputRef}
                    isUploading={isUploading}
                    onLogoSelected={onLogoSelected}
                  />

                  <HeroImageUploader
                    heroImage={brandingImage}
                    token={token}
                    onLiveUpdate={(next) => {
                      setBrandingImage(next);
                    }}
                    onClear={() => {
                      setBrandingImage(null);
                    }}
                    onError={setError}
                  />

                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Google Wallet background</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Choose whether the card background image is shown on Google Wallet.
                      </p>
                    </div>
                    <div className="inline-flex rounded-xl border border-[#e7b354]/20 bg-black/30 p-1">
                      <Button
                        className="h-8 px-4"
                        type="button"
                        variant={watchedValues.google_wallet_show_background ? "default" : "ghost"}
                        onClick={() => setValue("google_wallet_show_background", true, { shouldDirty: true })}
                      >
                        Show
                      </Button>
                      <Button
                        className="h-8 px-4"
                        type="button"
                        variant={!watchedValues.google_wallet_show_background ? "default" : "ghost"}
                        onClick={() => setValue("google_wallet_show_background", false, { shouldDirty: true })}
                      >
                        Hide
                      </Button>
                    </div>
                  </div>

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
                    <Input
                      placeholder="Street, city, country"
                      {...register("address")}
                    />
                  </ProfileField>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      disabled={(!isDirty && !hasHeroChanges) || isSubmitting}
                      type="submit"
                    >
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
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
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
  token,
  onLiveUpdate,
  onClear,
  onError,
}: {
  heroImage: BrandingImageState | null;
  token: string;
  onLiveUpdate: (next: BrandingImageState) => void;
  onClear: () => void;
  onError: (msg: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      onError(null);
      const upload = await uploadBusinessHeroImage(token, file);

      onLiveUpdate({
        dataUrl: upload.secure_url,
        zoom: heroImage?.zoom ?? 1.2,
        offsetXPercent: heroImage?.offsetXPercent ?? 0,
        offsetYPercent: heroImage?.offsetYPercent ?? 0,
        publicId: upload.public_id,
      });
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        onError(unknownError.message);
        return;
      }
      onError("Failed to upload image.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Card background image</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Upload an image, adjust zoom + horizontal position, then save from
            the main button below.
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

          {heroImage ? (
            <Button type="button" variant="outline" onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {heroImage ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="rounded-2xl border bg-card/70 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="hero-zoom">Zoom</Label>
                <span className="rounded-full px-3 py-1 text-xs font-semibold">
                  {Math.round(heroImage.zoom * 100)}%
                </span>
              </div>

              <Input
                id="hero-zoom"
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={heroImage.zoom}
                onChange={(event) =>
                  onLiveUpdate({
                    ...heroImage,
                    zoom: clamp(Number(event.target.value), 1, 3),
                  })
                }
              />

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>100%</span>
                <span>300%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl border bg-card/70 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="hero-position-x">Horizontal position</Label>
                <span className="rounded-full px-3 py-1 text-xs font-semibold">
                  {heroImage.offsetXPercent >= 0
                    ? `+${heroImage.offsetXPercent}px`
                    : `${heroImage.offsetXPercent}px`}
                </span>
              </div>

              <Input
                id="hero-position-x"
                type="range"
                min={-50}
                max={50}
                step={1}
                value={heroImage.offsetXPercent}
                onChange={(event) =>
                  onLiveUpdate({
                    ...heroImage,
                    offsetXPercent: clamp(Number(event.target.value), -50, 50),
                  })
                }
              />

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Left</span>
                <span>Right</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl border bg-card/70 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="hero-position-y">Vertical position</Label>
                <span className="rounded-full px-3 py-1 text-xs font-semibold">
                  {heroImage.offsetYPercent >= 0
                    ? `+${heroImage.offsetYPercent}px`
                    : `${heroImage.offsetYPercent}px`}
                </span>
              </div>

              <Input
                id="hero-position-y"
                type="range"
                min={-50}
                max={50}
                step={1}
                value={heroImage.offsetYPercent}
                onChange={(event) =>
                  onLiveUpdate({
                    ...heroImage,
                    offsetYPercent: clamp(Number(event.target.value), -50, 50),
                  })
                }
              />

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Top</span>
                <span>Bottom</span>
              </div>
            </div>
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
    <Card className="h-fit overflow-hidden border-white/15 bg-[linear-gradient(135deg,rgba(13,14,11,.94),rgba(8,9,7,.88))] shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-md">
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
                objectPosition: `${heroImage!.offsetXPercent + 50}% ${heroImage!.offsetYPercent + 50}%`,
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
                  <p className="text-xs opacity-75">Member experience</p>
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

      </CardContent>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(13,14,11,.94),rgba(8,9,7,.88))] shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-md">
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
      <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(13,14,11,.94),rgba(8,9,7,.88))] shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-md">
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

function toBrandingState(business: Business): BrandingImageState | null {
  if (!business.hero_image_url) return null;

  return {
    dataUrl: business.hero_image_url,
    zoom: clamp(Number(business.hero_image_zoom ?? 1.2), 1, 3),
    offsetXPercent: clamp(Number(business.hero_image_position_x ?? 0), -50, 50),
    offsetYPercent: clamp(Number(business.hero_image_position_y ?? 0), -50, 50),
    publicId: business.hero_image_public_id ?? null,
  };
}

function isSameBrandingImage(
  a: BrandingImageState | null,
  b: BrandingImageState | null,
) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.dataUrl === b.dataUrl &&
    a.zoom === b.zoom &&
    a.offsetXPercent === b.offsetXPercent &&
    a.offsetYPercent === b.offsetYPercent &&
    a.publicId === b.publicId
  );
}
