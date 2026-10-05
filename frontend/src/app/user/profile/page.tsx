"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, LockKeyhole, Mail, Save, ShieldCheck, UserRound } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import {
  customerChangePassword,
  customerUpdateProfile,
  customerUploadAvatar,
  defaultCustomerPreferences,
  type CustomerPreferences,
} from "@/lib/customerAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function UserProfilePage() {
  const { user, token, refresh } = useCustomerAuth();

  const defaults = useMemo(() => {
    const profile = user?.customer_profile;
    return {
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      email: profile?.email ?? user?.email ?? "",
      phone: profile?.phone ?? "",
      avatar_url: profile?.avatar_url ?? "",
      preferences: defaultCustomerPreferences((profile?.preferences as CustomerPreferences | null) ?? null),
    };
  }, [user]);

  const [firstName, setFirstName] = useState(defaults.first_name);
  const [lastName, setLastName] = useState(defaults.last_name);
  const [email, setEmail] = useState(defaults.email);
  const [phone, setPhone] = useState(defaults.phone);
  const [avatarUrl, setAvatarUrl] = useState(defaults.avatar_url);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(defaults.first_name);
    setLastName(defaults.last_name);
    setEmail(defaults.email);
    setPhone(defaults.phone);
    setAvatarUrl(defaults.avatar_url);
  }, [defaults]);

  async function onAvatarChange(file: File | undefined) {
    if (!file || !token) return;
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!allowed.has(file.type)) {
      setProfileError("Please choose a JPG, PNG, WEBP or GIF image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProfileError("Profile photo must be 10 MB or smaller.");
      return;
    }
    setUploadingAvatar(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const result = await customerUploadAvatar(token, file);
      setAvatarUrl(result.secure_url);
      await refresh();
      setProfileMessage("Profile photo updated successfully.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to upload profile photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setSavingProfile(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      await customerUpdateProfile(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        preferences: defaults.preferences,
      });
      await refresh();
      setProfileMessage("Profile updated successfully.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setSavingPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);

    try {
      await customerChangePassword(token, {
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation,
      });
      setOldPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      setPasswordMessage("Password changed successfully.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  const inputStyle = "h-11 rounded-xl border-white/10 bg-black/25 text-white placeholder:text-white/30 focus-visible:border-[#f3bd55]/50 focus-visible:ring-[#f3bd55]/20";
  const savedName = `${defaults.first_name} ${defaults.last_name}`.trim() || "Your profile";

  return (
    <CustomerLayout title="Profile" subtitle="Manage your personal information and password">
      <div className="space-y-5">
        <section aria-label="Your profile photo" className="relative overflow-hidden rounded-2xl border border-[#f3bd55]/20 bg-[linear-gradient(120deg,#1b1a11,#0e0f0b)] p-5 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 size-52 rounded-full bg-[#f3bd55]/[.06] blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4 sm:gap-5">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#f3bd55]/25 bg-[#f3bd55]/10 shadow-[0_8px_30px_rgba(0,0,0,.2)]">
              {avatarUrl ? <img src={avatarUrl} alt="Your profile photo" className="h-full w-full object-cover" /> : <UserRound className="size-8 text-[#f3bd55]/75" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#f3bd55]/70">Loyalty member</p>
              <h2 className="break-words text-lg font-semibold text-white sm:text-xl">{savedName}</h2>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-white/45"><Mail className="mt-0.5 size-3 shrink-0" /><span className="break-all">{defaults.email}</span></p>
            </div>
            <div className="w-full border-t border-white/10 pt-4 sm:w-auto sm:border-0 sm:pt-0">
              <label htmlFor="avatarUpload" className="relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#f3bd55]/25 bg-[#f3bd55]/10 px-4 py-2.5 text-xs font-semibold text-[#f3bd55] transition hover:bg-[#f3bd55]/15 focus-within:ring-2 focus-within:ring-[#f3bd55]">
                <Camera className="size-4" /> {uploadingAvatar ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
                <input id="avatarUpload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploadingAvatar} onChange={(event) => void onAvatarChange(event.target.files?.[0])} />
              </label>
              <p className="mt-2 text-[10px] text-white/35">JPG, PNG, WEBP or GIF · max 10 MB</p>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)]">
          <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#10110e]/95">
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f3bd55]/10 text-[#f3bd55]"><UserRound className="size-4" /></div>
              <div><h2 className="text-sm font-semibold text-white">Personal information</h2><p className="mt-1 text-xs text-white/40">Keep your contact details up to date.</p></div>
            </div>
            <form className="space-y-5 p-5 sm:p-6" onSubmit={onSaveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-xs text-white/60">First name</Label>
                  <Input id="firstName" autoComplete="given-name" className={inputStyle} value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-xs text-white/60">Last name</Label>
                  <Input id="lastName" autoComplete="family-name" className={inputStyle} value={lastName} onChange={(event) => setLastName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs text-white/60">Email address</Label>
                  <Input id="email" type="email" autoComplete="email" className={inputStyle} value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs text-white/60">Phone number <span className="text-white/30">(optional)</span></Label>
                  <Input id="phone" type="tel" autoComplete="tel" className={inputStyle} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+212..." />
                </div>
              </div>
              {profileError ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-2.5 text-xs leading-5 text-rose-300">{profileError}</p> : null}
              {profileMessage ? <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5 text-xs leading-5 text-emerald-300">{profileMessage}</p> : null}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/35">Your details stay connected to your loyalty cards.</p>
                <Button type="submit" disabled={savingProfile || uploadingAvatar} className="h-11 w-full shrink-0 gap-2 rounded-xl bg-[#f3bd55] px-5 text-xs font-semibold text-black hover:bg-[#ffd078] sm:w-auto"><Save className="size-4" />{savingProfile ? "Saving..." : "Save changes"}</Button>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#10110e]/95">
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f3bd55]/10 text-[#f3bd55]"><ShieldCheck className="size-4" /></div>
              <div><h2 className="text-sm font-semibold text-white">Account security</h2><p className="mt-1 text-xs text-white/40">Update your password.</p></div>
            </div>
            <form className="space-y-4 p-5 sm:p-6" onSubmit={onChangePassword}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <Label htmlFor="oldPassword" className="text-xs text-white/60">Current password</Label>
                  <Link href="/forgot-password" className="rounded text-xs font-medium text-[#f3bd55] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]">Forgot password?</Link>
                </div>
                <PasswordInput id="oldPassword" autoComplete="current-password" inputClassName={inputStyle} value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-xs text-white/60">New password</Label>
                <PasswordInput id="newPassword" autoComplete="new-password" inputClassName={inputStyle} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPasswordConfirmation" className="text-xs text-white/60">Confirm new password</Label>
                <PasswordInput id="newPasswordConfirmation" autoComplete="new-password" inputClassName={inputStyle} value={newPasswordConfirmation} onChange={(event) => setNewPasswordConfirmation(event.target.value)} required />
              </div>
              {passwordError ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-2.5 text-xs leading-5 text-rose-300">{passwordError}</p> : null}
              {passwordMessage ? <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5 text-xs leading-5 text-emerald-300">{passwordMessage}</p> : null}
              <div className="border-t border-white/10 pt-4">
                <Button type="submit" disabled={savingPassword} variant="outline" className="h-11 w-full gap-2 rounded-xl border-[#f3bd55]/25 bg-[#f3bd55]/5 text-xs font-semibold text-[#f3bd55] hover:bg-[#f3bd55]/10 hover:text-[#ffd078]"><LockKeyhole className="size-4" />{savingPassword ? "Updating..." : "Update password"}</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}
