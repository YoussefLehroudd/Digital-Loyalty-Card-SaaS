"use client";
import { useI18n } from "@/components/i18n/language-provider";
import Link from "next/link";
import { BusinessPrivacySettings } from "@/components/settings/business-privacy-settings";
import {PushTestPanel} from "@/components/push-test-panel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Building2, ExternalLink, ImageUp, KeyRound, Trash2, Loader2, Mail, MapPin, Star, Palette, Phone, Save, ShieldCheck, UserRound, ZoomIn, MoveHorizontal, MoveVertical, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getBusinessProfile, removeAccountAvatar, updateAccountPassword, updateAccountProfile, updateBusinessProfile, uploadAccountAvatar, uploadBusinessHeroImage, uploadBusinessLogo, type Business, } from "@/lib/auth";
import { useAutoDismiss } from "@/lib/use-auto-dismiss";
import { cn } from "@/lib/utils";
import { isGoogleBusinessLink } from "@/lib/google-business-links";
import LoyaltyCardVisual from "@/components/loyalty/LoyaltyCardVisual";
const schema = z.object({
    name: z.string().min(2, "Enter a business name.").max(255),
    email: z.string().email("Enter a valid business email."),
    phone: z.string().max(40).optional(),
    address: z.string().max(1000).optional(),
    google_maps_url: z.string().trim().max(1200).refine(value => !value || isGoogleBusinessLink(value, "maps"), "Paste a real HTTPS Google Maps location link.").optional(),
    google_reviews_url: z.string().trim().max(1200).refine(value => !value || isGoogleBusinessLink(value, "reviews"), "Use the direct Google 'Get more reviews' link.").optional(),
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
    const { t: tr } = useI18n();
    const { token, user, updateUser } = useAuth();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const [business, setBusiness] = useState<Business | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);
    const [isAvatarRemoving, setIsAvatarRemoving] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const clearSuccess = useCallback(() => {
        setSuccess(null);
    }, []);
    useAutoDismiss(success, clearSuccess);
    const [brandingImage, setBrandingImage] = useState<BrandingImageState | null>(null);
    const [savedBrandingImage, setSavedBrandingImage] = useState<BrandingImageState | null>(null);
    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty }, } = useForm<ProfileValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            address: "",
            google_maps_url: "",
            google_reviews_url: "",
            primary_color: "#171717",
            google_wallet_show_background: true,
        },
    });
    const { register: registerAccount, handleSubmit: handleAccountSubmit, reset: resetAccount, formState: { errors: accountErrors, isSubmitting: isAccountSubmitting, isDirty: isAccountDirty, }, } = useForm<AccountValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            name: user.name,
            email: user.email,
        },
    });
    const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting, isDirty: isPasswordDirty, }, } = useForm<PasswordValues>({
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
                if (!isMounted)
                    return;
                setBusiness(response.business);
                reset({
                    name: response.business.name,
                    email: response.business.email,
                    phone: response.business.phone ?? "",
                    address: response.business.address ?? "",
                    google_maps_url: response.business.google_maps_url ?? "",
                    google_reviews_url: response.business.google_reviews_url ?? "",
                    primary_color: response.business.primary_color,
                    google_wallet_show_background: response.business.google_wallet_show_background ?? true,
                });
                const persistedHero = toBrandingState(response.business);
                setBrandingImage(persistedHero);
                setSavedBrandingImage(persistedHero);
            }
            catch {
                setError("Business profile could not be loaded.");
            }
            finally {
                if (isMounted)
                    setIsLoading(false);
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
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.email?.[0] ??
                    unknownError.errors?.name?.[0] ??
                    unknownError.message);
                return;
            }
            setError("Account profile could not be updated.");
        }
    }
    async function onAvatarSelected(file?: File) {
        if (!file)
            return;
        setSuccess(null);
        setError(null);
        setIsAvatarUploading(true);
        try {
            const response = await uploadAccountAvatar(token, file);
            updateUser(response.user);
            setSuccess(response.message);
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.avatar?.[0] ?? unknownError.message);
            }
            else {
                setError("Profile photo upload failed.");
            }
        }
        finally {
            setIsAvatarUploading(false);
            if (avatarInputRef.current)
                avatarInputRef.current.value = "";
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
        }
        catch (unknownError) {
            setError(unknownError instanceof ApiError ? unknownError.message : "Profile photo could not be removed.");
        }
        finally {
            setIsAvatarRemoving(false);
        }
    }
    async function onPasswordSubmit(values: PasswordValues) {
        setSuccess(null);
        setError(null);
        try {
            const response = await updateAccountPassword(token, values);
            resetPassword();
            setSuccess(response.message);
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.current_password?.[0] ??
                    unknownError.errors?.password?.[0] ??
                    unknownError.errors?.password_confirmation?.[0] ??
                    unknownError.message);
                return;
            }
            setError("Password could not be updated.");
        }
    }
    async function onSubmit(values: ProfileValues) {
        setSuccess(null);
        setError(null);
        if (!business)
            return;
        try {
            const response = await updateBusinessProfile(token, {
                ...values,
                phone: values.phone || null,
                address: values.address || null,
                google_maps_url: values.google_maps_url || null,
                google_reviews_url: values.google_reviews_url || null,
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
                google_maps_url: response.business.google_maps_url ?? "",
                google_reviews_url: response.business.google_reviews_url ?? "",
                primary_color: response.business.primary_color,
                google_wallet_show_background: response.business.google_wallet_show_background ?? true,
            });
            const persistedHero = toBrandingState(response.business);
            setBrandingImage(persistedHero);
            setSavedBrandingImage(persistedHero);
            setSuccess(response.message);
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.email?.[0] ??
                    unknownError.errors?.primary_color?.[0] ??
                    unknownError.message);
                return;
            }
            setError("Business profile could not be updated.");
        }
    }
    async function onLogoSelected(file?: File) {
        if (!file)
            return;
        setSuccess(null);
        setError(null);
        setIsUploading(true);
        try {
            const response = await uploadBusinessLogo(token, file);
            setBusiness(response.business);
            setSuccess(response.message);
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.logo?.[0] ?? unknownError.message);
                return;
            }
            setError("Logo upload failed.");
        }
        finally {
            setIsUploading(false);
            if (fileInputRef.current)
                fileInputRef.current.value = "";
        }
    }
    return (<DashboardShell activeItem="settings">
      <div className="mx-auto w-full max-w-[1600px] space-y-4 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 rounded-2xl sm:items-center sm:gap-4 border border-[#d8a63f]/10 bg-black/10 px-4 py-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e7b354]/25 bg-[#8b5d12]/25 text-[#ffc857] shadow-[0_8px_24px_rgba(231,179,84,.08)] sm:mt-0 sm:size-11">
            <Building2 className="size-4 sm:size-5"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">{tr(" Business profile ")}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{tr(" Manage the business identity customers will see across public registration and future loyalty experiences. ")}</p>
          </div>
        </div>

        <BusinessPrivacySettings token={token}/>
        <PushTestPanel token={token}/>

        {success ? (<Alert className="border-success/30 text-foreground">{tr(success)}</Alert>) : null}
        {error ? (<Alert className="border-red-500/30 text-red-600">{tr(error)}</Alert>) : null}

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <Card className="border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(12,13,10,.96),rgba(7,8,6,.91))] shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-muted-foreground"/>{tr(" Owner profile ")}</CardTitle>
              <CardDescription>{tr(" Login identity for the person managing this business dashboard. ")}</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 pt-0">
              <form className="space-y-4" onSubmit={handleAccountSubmit(onAccountSubmit)}>
                <div className="flex flex-col gap-4 rounded-2xl border border-[#d8a63f]/15 bg-[linear-gradient(135deg,rgba(20,19,14,.78),rgba(9,10,8,.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground ring-1 ring-border">
                      {user.avatar_url ? (<img alt={tr("{0} profile", { "0": user.name })} className="h-full w-full object-cover" src={user.avatar_url}/>) : (getInitials(user.name))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{tr(" Business owner account ")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{tr(" JPG, PNG, WEBP or GIF \u00B7 max 10 MB ")}</p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:shrink-0">
                    <input ref={avatarInputRef} accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" type="file" onChange={(event) => void onAvatarSelected(event.target.files?.[0])}/>
                    <Button disabled={isAvatarUploading || isAvatarRemoving} onClick={() => avatarInputRef.current?.click()} type="button" variant="outline" className="w-full sm:w-auto">
                      {isAvatarUploading ? (<Loader2 className="size-4 animate-spin"/>) : (<ImageUp className="size-4"/>)}
                      {user.avatar_url ? tr("Change photo") : tr("Add photo")}
                    </Button>
                    {user.avatar_url ? (<Button disabled={isAvatarUploading || isAvatarRemoving} onClick={() => void onAvatarRemove()} type="button" variant="ghost" className="w-full sm:w-auto">
                        {isAvatarRemoving ? (<Loader2 className="size-4 animate-spin"/>) : (<Trash2 className="size-4"/>)}{tr(" Remove ")}</Button>) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileField error={accountErrors.name?.message} icon={UserRound} label={tr("Owner name")}>
                    <Input {...registerAccount("name")}/>
                  </ProfileField>
                  <ProfileField error={accountErrors.email?.message} icon={Mail} label={tr("Login email")}>
                    <Input type="email" {...registerAccount("email")}/>
                  </ProfileField>
                </div>

                <div className="flex justify-end">
                  <Button className="border-0 bg-[#efbd5d] font-semibold text-black hover:bg-[#f4c86f]" disabled={!isAccountDirty || isAccountSubmitting} type="submit">
                    {isAccountSubmitting ? (<Loader2 className="size-4 animate-spin"/>) : (<Save className="size-4"/>)}
                    {isAccountSubmitting ? tr("Saving...") : tr("Save profile")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(12,13,10,.96),rgba(7,8,6,.91))] shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-muted-foreground"/>{tr(" Security ")}</CardTitle>
              <CardDescription>{tr(" Change the password used to access this business workspace. ")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form className="space-y-4" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                <ProfileField error={passwordErrors.current_password?.message} icon={KeyRound} label={tr("Current password")} action={<Link href="/forgot-password" className="rounded text-xs font-medium text-[#efbd5d] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efbd5d]">{tr("Forgot password?")}</Link>}>
                  <PasswordInput id="current-password" autoComplete="current-password" {...registerPassword("current_password")}/>
                </ProfileField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileField error={passwordErrors.password?.message} icon={KeyRound} label={tr("New password")}>
                    <PasswordInput autoComplete="new-password" {...registerPassword("password")}/>
                  </ProfileField>
                  <ProfileField error={passwordErrors.password_confirmation?.message} icon={KeyRound} label={tr("Confirm password")}>
                    <PasswordInput autoComplete="new-password" {...registerPassword("password_confirmation")}/>
                  </ProfileField>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Button className="border-0 bg-[#efbd5d] font-semibold text-black hover:bg-[#f4c86f]" disabled={!isPasswordDirty || isPasswordSubmitting} type="submit">
                    {isPasswordSubmitting ? (<Loader2 className="size-4 animate-spin"/>) : (<ShieldCheck className="size-4"/>)}
                    {isPasswordSubmitting ? tr("Updating...") : tr("Update password")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (<SettingsSkeleton />) : (<div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,.72fr)]">
            <Card className="min-w-0 border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(12,13,10,.96),rgba(7,8,6,.91))] shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle>{tr("Business information")}</CardTitle>
                <CardDescription>{tr(" Keep contact details and brand color accurate for this tenant. ")}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <form className="min-w-0 space-y-4" onSubmit={handleSubmit(onSubmit)}>
                  <LogoUploader business={business} fileInputRef={fileInputRef} isUploading={isUploading} onLogoSelected={onLogoSelected}/>

                  <HeroImageUploader heroImage={brandingImage} token={token} onLiveUpdate={(next) => {
                setBrandingImage(next);
            }} onClear={() => {
                setBrandingImage(null);
            }} onError={setError}/>

                  <div className="flex flex-col gap-3 rounded-2xl border border-[#d8a63f]/15 bg-[linear-gradient(135deg,rgba(20,19,14,.78),rgba(9,10,8,.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{tr("Google Wallet background")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{tr(" Choose whether the card background image is shown on Google Wallet. ")}</p>
                    </div>
                    <div className="inline-flex w-full rounded-xl border border-[#e7b354]/20 bg-black/30 p-1 sm:w-auto">
                      <Button className="h-8 flex-1 px-4 sm:flex-none" type="button" variant={watchedValues.google_wallet_show_background ? "default" : "ghost"} onClick={() => setValue("google_wallet_show_background", true, { shouldDirty: true })}>{tr(" Show ")}</Button>
                      <Button className="h-8 flex-1 px-4 sm:flex-none" type="button" variant={!watchedValues.google_wallet_show_background ? "default" : "ghost"} onClick={() => setValue("google_wallet_show_background", false, { shouldDirty: true })}>{tr(" Hide ")}</Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileField error={errors.name?.message} icon={Building2} label={tr("Business name")}>
                      <Input {...register("name")}/>
                    </ProfileField>
                    <ProfileField error={errors.email?.message} icon={Mail} label={tr("Business email")}>
                      <Input type="email" {...register("email")}/>
                    </ProfileField>
                    <ProfileField error={errors.phone?.message} icon={Phone} label={tr("Phone")}>
                      <Input placeholder={"+1 555 0100"} {...register("phone")}/>
                    </ProfileField>
                    <ProfileField error={errors.primary_color?.message} icon={Palette} label={tr("Primary color")}>
                      <div className="grid grid-cols-[52px_1fr] gap-2">
                        <Input aria-label={tr("Primary color picker")} className="h-10 p-1" type="color" value={watchedValues.primary_color} onChange={(event) => setValue("primary_color", event.target.value, {
                shouldDirty: true,
                shouldValidate: true,
            })}/>
                        <Input {...register("primary_color")}/>
                      </div>
                    </ProfileField>
                  </div>

                  <ProfileField error={errors.address?.message} icon={MapPin} label={tr("Address")}>
                    <Input placeholder={tr("Street, city, country")} {...register("address")}/>
                  </ProfileField>

                  <div className="min-w-0 space-y-4 rounded-2xl border border-[#e7b354]/20 bg-[#e7b354]/[.035] p-4">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><MapPin className="size-4 text-[#efbd5d]"/>{tr("Google Maps & customer reviews")}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{tr("Add your exact Google Maps business location and your direct Google review-request link. These buttons will appear on your business card in Explore Businesses.")}</p>
                    </div>
                    <ProfileField error={errors.google_maps_url?.message} icon={MapPin} label={tr("Google Maps location link")}>
                      <Input type="url" inputMode="url" autoComplete="url" placeholder="https://maps.app.goo.gl/..." {...register("google_maps_url")}/>
                    </ProfileField>
                    {watchedValues.google_maps_url && isGoogleBusinessLink(watchedValues.google_maps_url,"maps") ?
                      <a href={watchedValues.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-xs font-semibold text-[#efbd5d] hover:underline"><ExternalLink className="size-3.5 shrink-0"/>{tr("Preview location on Google Maps")}</a> : null}
                    <ProfileField error={errors.google_reviews_url?.message} icon={Star} label={tr("Direct Google Reviews link")}>
                      <Input type="url" inputMode="url" autoComplete="url" placeholder="https://g.page/r/.../review" {...register("google_reviews_url")}/>
                    </ProfileField>
                    {watchedValues.google_reviews_url && isGoogleBusinessLink(watchedValues.google_reviews_url,"reviews") ?
                      <a href={watchedValues.google_reviews_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-xs font-semibold text-[#efbd5d] hover:underline"><ExternalLink className="size-3.5 shrink-0"/>{tr("Preview direct review link")}</a> : null}
                    <p className="text-[11px] leading-5 text-white/45">{tr("To get the exact review link: open your Google Business Profile on desktop, select Read reviews → Get more reviews → Copy link. Leave either field blank to hide that button.")}</p>
                    <a href="https://support.google.com/business/answer/16816815" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-[#efbd5d] hover:underline"><ExternalLink className="size-3"/>{tr("Google instructions for getting a review link")}</a>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button className="border-0 bg-[#efbd5d] font-semibold text-black hover:bg-[#f4c86f]" disabled={(!isDirty && !hasHeroChanges) || isSubmitting} type="submit">
                      {isSubmitting ? (<Loader2 className="size-4 animate-spin"/>) : (<Save className="size-4"/>)}
                      {isSubmitting ? tr("Saving...") : tr("Save changes")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <BrandingPreview business={previewBusiness} heroImage={brandingImage}/>
          </div>)}
      </div>
    </DashboardShell>);
}
function LogoUploader({ business, fileInputRef, isUploading, onLogoSelected, }: {
    business: Business | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    isUploading: boolean;
    onLogoSelected: (file?: File) => void;
}) {
    const { t: tr } = useI18n();
    const initials = getInitials(business?.name ?? "Business");
    return (<div className="flex flex-col gap-4 rounded-2xl border border-[#d8a63f]/15 bg-[linear-gradient(135deg,rgba(20,19,14,.78),rgba(9,10,8,.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card">
          {business?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={tr("{0} logo", { "0": business.name })} className="size-full object-cover" src={business.logo_url}/>) : (<span className="text-lg font-semibold">{initials}</span>)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{tr("Business logo")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:whitespace-normal">{tr(" PNG, JPG, or WEBP. Maximum upload size is 2 MB. ")}</p>
        </div>
      </div>

      <div className="w-full sm:w-auto">
        <input accept="image/png,image/jpeg,image/webp" className="hidden" ref={fileInputRef} type="file" onChange={(event) => onLogoSelected(event.target.files?.[0])}/>
        <Button className="w-full sm:w-auto" disabled={isUploading} type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          {isUploading ? (<Loader2 className="size-4 animate-spin"/>) : (<ImageUp className="size-4"/>)}
          {isUploading ? tr("Uploading...") : tr("Upload logo")}
        </Button>
      </div>
    </div>);
}
function HeroImageUploader({ heroImage, token, onLiveUpdate, onClear, onError, }: {
    heroImage: BrandingImageState | null;
    token: string;
    onLiveUpdate: (next: BrandingImageState) => void;
    onClear: () => void;
    onError: (msg: string | null) => void;
}) {
    const { t: tr } = useI18n();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    async function handleHeroFile(file?: File) {
        if (!file)
            return;
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
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                onError(unknownError.message);
                return;
            }
            onError("Failed to upload image.");
        }
        finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }
    return (<div className="rounded-xl border border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(12,13,10,.94),rgba(7,8,6,.9))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {heroImage ? (<div className="h-11 w-16 shrink-0 overflow-hidden rounded-md border border-[#d8a63f]/20 bg-black/30">
              <img alt={tr("Card background preview")} className="h-full w-full object-cover" src={heroImage.dataUrl} style={{
                transform: `scale(${heroImage.zoom}) translate(${heroImage.offsetXPercent / heroImage.zoom}%, ${heroImage.offsetYPercent / heroImage.zoom}%)`,
            }}/>
            </div>) : (<div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md border border-[#d8a63f]/20 bg-black/30 text-[#f5bf3d]">
              <ImageUp className="size-4"/>
            </div>)}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{tr("Card background image")}</p>
            <p className="truncate text-[11px] text-muted-foreground">{tr(" Upload an image, adjust zoom + horizontal position, then save from the main button below. ")}</p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleHeroFile(event.target.files?.[0])}/>
          <Button className="h-9 w-full border-[#d8a63f]/25 bg-black/20 px-4 text-xs font-semibold hover:border-[#f5bf3d]/60 hover:bg-[#d79b16]/10 sm:w-auto" type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <ImageUp className="size-3.5 text-[#f5bf3d]"/>{tr(" Upload image ")}</Button>
          {heroImage ? (<Button className="h-9 w-full border-[#d8a63f]/20 bg-black/20 px-4 text-xs hover:border-[#f5bf3d]/50 sm:w-auto" type="button" variant="outline" onClick={onClear}>{tr(" Clear ")}</Button>) : null}
        </div>
      </div>

      {heroImage ? (<div className="mt-3 grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3">
          <div className="rounded-lg border border-[#d8a63f]/20 bg-black/25 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <Label className="flex items-center gap-2 text-[11px] font-semibold text-white" htmlFor="hero-zoom">
                <ZoomIn className="size-3.5 text-[#f5bf3d]"/>{tr(" Zoom ")}</Label>
              <span className="text-[11px] font-semibold text-white">{Math.round(heroImage.zoom * 100)}%</span>
            </div>
            <Input className="loyvance-gold-range h-2 p-0" id="hero-zoom" type="range" min={1} max={3} step={0.1} value={heroImage.zoom} onChange={(event) => onLiveUpdate({ ...heroImage, zoom: clamp(Number(event.target.value), 1, 3) })}/>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>100%</span><span>300%</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#d8a63f]/20 bg-black/25 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <Label className="flex items-center gap-2 text-[11px] font-semibold text-white" htmlFor="hero-position-x">
                <MoveHorizontal className="size-3.5 text-[#f5bf3d]"/>{tr(" Horizontal position ")}</Label>
              <span className="text-[11px] font-semibold text-white">
                {heroImage.offsetXPercent >= 0 ? tr("+{0}px", { "0": heroImage.offsetXPercent }) : tr("{0}px", { "0": heroImage.offsetXPercent })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowLeft className="size-3 text-[#f5bf3d]"/>
              <Input className="loyvance-gold-range h-2 flex-1 p-0" id="hero-position-x" type="range" min={-50} max={50} step={1} value={heroImage.offsetXPercent} onChange={(event) => onLiveUpdate({ ...heroImage, offsetXPercent: clamp(Number(event.target.value), -50, 50) })}/>
              <ArrowRight className="size-3 text-[#f5bf3d]"/>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{tr("Left")}</span><span>{tr("Right")}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#d8a63f]/20 bg-black/25 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <Label className="flex items-center gap-2 text-[11px] font-semibold text-white" htmlFor="hero-position-y">
                <MoveVertical className="size-3.5 text-[#f5bf3d]"/>{tr(" Vertical position ")}</Label>
              <span className="text-[11px] font-semibold text-white">
                {heroImage.offsetYPercent >= 0 ? tr("+{0}px", { "0": heroImage.offsetYPercent }) : tr("{0}px", { "0": heroImage.offsetYPercent })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUp className="size-3 text-[#f5bf3d]"/>
              <Input className="loyvance-gold-range h-2 flex-1 p-0" id="hero-position-y" type="range" min={-50} max={50} step={1} value={heroImage.offsetYPercent} onChange={(event) => onLiveUpdate({ ...heroImage, offsetYPercent: clamp(Number(event.target.value), -50, 50) })}/>
              <ArrowDown className="size-3 text-[#f5bf3d]"/>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{tr("Top")}</span><span>{tr("Bottom")}</span>
            </div>
          </div>
        </div>) : (<div className="mt-3 rounded-lg border border-dashed border-[#d8a63f]/20 bg-black/20 px-3 py-2 text-[11px] text-muted-foreground">{tr(" Upload an image to enable zoom + position controls. ")}</div>)}
    </div>);
}
function ProfileField({ children, error, icon: Icon, label, action, }: {
    children: React.ReactNode;
    action?: React.ReactNode;
    error?: string;
    icon: React.ElementType;
    label: string;
}) {
    const { t: tr } = useI18n();
    const id = label.toLowerCase().replaceAll(" ", "-");
    return (<div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Label className="flex items-center gap-2" htmlFor={id}>
          <Icon className="size-4 text-muted-foreground"/>
          {tr(label)}
        </Label>
        {action}
      </div>
      {children}
      {error ? <p className="text-xs text-red-600">{tr(error)}</p> : null}
    </div>);
}
function BrandingPreview({ business, heroImage, }: {
    business: Business | null;
    heroImage: BrandingImageState | null;
}) {
    const { t: tr } = useI18n();
    const businessName = business?.name ?? "Business";
    return (<Card className="h-fit min-w-0 overflow-hidden border-[#d8a63f]/20 lg:sticky lg:top-24 bg-[linear-gradient(145deg,rgba(12,13,10,.96),rgba(7,8,6,.91))] shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle>{tr("Branding preview")}</CardTitle>
        <CardDescription>{tr(" Exact preview of the loyalty card customers will see. ")}</CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="mx-auto w-full min-w-0 max-w-[400px]">
          <LoyaltyCardVisual businessName={businessName} businessLogoUrl={business?.logo_url} heroImageUrl={heroImage?.dataUrl ?? null} heroImageZoom={heroImage?.zoom ?? business?.hero_image_zoom} heroImagePositionX={heroImage?.offsetXPercent ?? business?.hero_image_position_x} heroImagePositionY={heroImage?.offsetYPercent ?? business?.hero_image_position_y} brandPrimaryColor={business?.primary_color} memberName="Preview member" rewardName="Loyalty reward" rewardDescription="Collect stamps to unlock your reward." cardNumber="preview" qrToken={null} showQrPayloadText={false} stampUiVariant="customer" progressPercent={0} currentStamps={0} requiredStamps={10}/>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{tr(" Preview only. Member name, stamp progress, reward and QR code are personalized for each customer. ")}</p>
      </CardContent>
    </Card>);
}
function SettingsSkeleton() {
    const { t: tr } = useI18n();
    return (<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(12,13,10,.96),rgba(7,8,6,.91))] shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
        <CardContent className="space-y-5 p-5">
          <Skeleton className="h-20 w-full"/>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-16"/>
            <Skeleton className="h-16"/>
            <Skeleton className="h-16"/>
            <Skeleton className="h-16"/>
          </div>
          <Skeleton className="h-16"/>
        </CardContent>
      </Card>
      <Card className="border-[#d8a63f]/20 bg-[linear-gradient(145deg,rgba(12,13,10,.96),rgba(7,8,6,.91))] shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-md">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-40"/>
          <Skeleton className="h-52 w-full"/>
          <Skeleton className="h-16 w-full"/>
        </CardContent>
      </Card>
    </div>);
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
    if (!business.hero_image_url)
        return null;
    return {
        dataUrl: business.hero_image_url,
        zoom: clamp(Number(business.hero_image_zoom ?? 1.2), 1, 3),
        offsetXPercent: clamp(Number(business.hero_image_position_x ?? 0), -50, 50),
        offsetYPercent: clamp(Number(business.hero_image_position_y ?? 0), -50, 50),
        publicId: business.hero_image_public_id ?? null,
    };
}
function isSameBrandingImage(a: BrandingImageState | null, b: BrandingImageState | null) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    return (a.dataUrl === b.dataUrl &&
        a.zoom === b.zoom &&
        a.offsetXPercent === b.offsetXPercent &&
        a.offsetYPercent === b.offsetYPercent &&
        a.publicId === b.publicId);
}
