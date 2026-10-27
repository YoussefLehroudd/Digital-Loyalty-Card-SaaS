"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerUpdateProfile, defaultCustomerPreferences, type CustomerPreferences, } from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
type ToggleRowProps = {
    title: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
};
function ToggleRow({ title, description, checked, onToggle }: ToggleRowProps) {
    const { t: tr } = useI18n();
    return (<button type="button" onClick={onToggle} className="flex w-full items-center justify-between rounded-md border p-3 text-start transition hover:bg-muted/50" aria-pressed={checked}>
      <div>
        <p className="text-sm font-medium">{tr(title)}</p>
        <p className="text-xs text-muted-foreground">{tr(description)}</p>
      </div>
      <span className={`h-6 w-11 rounded-full p-1 transition ${checked ? "bg-primary" : "bg-muted"}`} aria-hidden>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5 rtl:-translate-x-5" : ""}`}/>
      </span>
    </button>);
}
export default function UserSettingsPage() {
    const { t: tr } = useI18n();
    const { user, token, logout, refresh } = useCustomerAuth();
    const preferences = useMemo(() => defaultCustomerPreferences((user?.customer_profile?.preferences as CustomerPreferences | null) ?? null), [user]);
    const [emailUpdates, setEmailUpdates] = useState(preferences.notifications.email_updates);
    const [rewardAlerts, setRewardAlerts] = useState(preferences.notifications.reward_alerts);
    const [promotions, setPromotions] = useState(preferences.notifications.promotions);
    const [pushEnabled, setPushEnabled] = useState(preferences.notifications.push_enabled);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmLogout, setConfirmLogout] = useState(false);
    useEffect(() => {
        setEmailUpdates(preferences.notifications.email_updates);
        setRewardAlerts(preferences.notifications.reward_alerts);
        setPromotions(preferences.notifications.promotions);
        setPushEnabled(preferences.notifications.push_enabled);
    }, [preferences]);
    async function savePreferences() {
        if (!token || !user?.customer_profile)
            return;
        setSaving(true);
        setMessage(null);
        setError(null);
        try {
            await customerUpdateProfile(token, {
                first_name: user.customer_profile.first_name,
                last_name: user.customer_profile.last_name,
                email: user.customer_profile.email,
                phone: user.customer_profile.phone,
                avatar_url: user.customer_profile.avatar_url,
                preferences: {
                    notifications: {
                        email_updates: emailUpdates,
                        reward_alerts: rewardAlerts,
                        promotions,
                        push_enabled: pushEnabled,
                    },
                    ui: {
                        dark_mode: true,
                    },
                },
            });
            await refresh();
            setMessage("Preferences saved.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save preferences");
        }
        finally {
            setSaving(false);
        }
    }
    return (<CustomerLayout title={tr("Settings")} subtitle={tr("Notification and account settings")}>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Notification preferences")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ToggleRow title={tr("Email updates")} description={tr("Receive account and loyalty updates by email.")} checked={emailUpdates} onToggle={() => setEmailUpdates((v) => !v)}/>
            <ToggleRow title={tr("Reward alerts")} description={tr("Get notified when rewards are ready.")} checked={rewardAlerts} onToggle={() => setRewardAlerts((v) => !v)}/>
            <ToggleRow title={tr("Promotions")} description={tr("Receive occasional promotional offers.")} checked={promotions} onToggle={() => setPromotions((v) => !v)}/>
            <ToggleRow title={tr("Push notifications")} description={tr("Enable mobile/browser push alerts.")} checked={pushEnabled} onToggle={() => setPushEnabled((v) => !v)}/>
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{tr(error)}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{tr(message)}</p> : null}

        <Button className="w-full" onClick={savePreferences} disabled={saving}>
          {saving ? tr("Saving...") : tr("Save settings")}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Account")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {confirmLogout ? (<div className="rounded-md border border-destructive/30 p-3">
                <p className="text-sm">{tr("Are you sure you want to logout?")}</p>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={logout}>{tr(" Confirm logout ")}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmLogout(false)}>{tr(" Cancel ")}</Button>
                </div>
              </div>) : (<Button variant="outline" className="w-full" onClick={() => setConfirmLogout(true)}>
                <LogOut className="me-2 h-4 w-4"/>{tr(" Logout ")}</Button>)}
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>);
}
