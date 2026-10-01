"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, Save, UserRound } from "lucide-react";

import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import {
  customerChangePassword,
  customerUpdateProfile,
  customerUploadAvatar,
  defaultCustomerPreferences,
  type CustomerPreferences,
} from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <CustomerLayout title="Profile" subtitle="Manage your personal information and password">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSaveProfile}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+212..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUpload">Profile photo</Label>
                <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="avatarUpload" className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-sm hover:bg-muted">
                      <Camera className="mr-2 h-4 w-4" />
                      {uploadingAvatar ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
                    </label>
                    <input
                      id="avatarUpload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={(e) => void onAvatarChange(e.target.files?.[0])}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, WEBP or GIF · max 10 MB</p>
                  </div>
                </div>
              </div>

              {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
              {profileMessage ? <p className="text-sm text-emerald-600">{profileMessage}</p> : null}

              <Button type="submit" disabled={savingProfile} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onChangePassword}>
              <div className="space-y-1">
                <Label htmlFor="oldPassword">Current password</Label>
                <PasswordInput
                  id="oldPassword"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="newPasswordConfirmation">Confirm new password</Label>
                <PasswordInput
                  id="newPasswordConfirmation"
                  value={newPasswordConfirmation}
                  onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                  required
                />
              </div>


              {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
              {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}

              <Button type="submit" disabled={savingPassword} className="w-full">
                {savingPassword ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
