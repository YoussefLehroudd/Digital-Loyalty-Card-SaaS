"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useMemo, useState } from "react";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { customerUpdateProfile, defaultCustomerPreferences, type CustomerPreferences, } from "@/lib/customerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {CustomerPasskeySettings} from "@/components/customer-app/customer-passkey-settings";
import { BellRing, Smartphone, ShieldCheck } from "lucide-react";
import {apiFetch} from "@/lib/api";
import {supportsWebPush,isIosPwaRequired,enablePushOnDevice,disablePushOnDevice,registeredSubscription,type PushConfig} from "@/lib/web-push-client";
type ToggleRowProps = {
    title: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
};
function ToggleRow({ title, description, checked, onToggle }: ToggleRowProps) {
    const { t: tr } = useI18n();
    return (<button type="button" role="switch" aria-checked={checked} aria-label={tr(title)}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border/80 p-3 text-start transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7b354]">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="break-words text-sm font-semibold leading-5">{tr(title)}</span>
        <span className="break-words text-xs leading-[1.4] text-muted-foreground">{tr(description)}</span>
      </span>
      <span className={`relative inline-block h-6 w-11 min-w-11 shrink-0 rounded-full transition-colors duration-150 ${checked ? "bg-[#e7b354]" : "bg-muted border border-border"}`} aria-hidden="true">
        <span className={`absolute start-1 top-1 block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? "translate-x-5 rtl:-translate-x-5" : ""}`}/>
      </span>
    </button>);
}
export default function UserSettingsPage() {
    const { t: tr } = useI18n();
    const { user, token, refresh } = useCustomerAuth();
    const preferences = useMemo(() => defaultCustomerPreferences((user?.customer_profile?.preferences as CustomerPreferences | null) ?? null), [user]);
    const [emailUpdates, setEmailUpdates] = useState(preferences.notifications.email_updates);
    const [rewardAlerts, setRewardAlerts] = useState(preferences.notifications.reward_alerts);
    const [promotions, setPromotions] = useState(preferences.notifications.promotions);
    const [pushEnabled, setPushEnabled] = useState(preferences.notifications.push_enabled);
    const [saving, setSaving] = useState(false);
    const [pushBusy,setPushBusy]=useState(false);
    const [pushConfig,setPushConfig]=useState<PushConfig|null>(null);
    const [deviceSubscribed,setDeviceSubscribed]=useState(false);
    const [permission,setPermission]=useState<NotificationPermission|null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        setEmailUpdates(preferences.notifications.email_updates);
        setRewardAlerts(preferences.notifications.reward_alerts);
        setPromotions(preferences.notifications.promotions);
        setPushEnabled(preferences.notifications.push_enabled);
    }, [preferences]);
    useEffect(()=>{
      if(!token)return;
      let active=true;
      void Promise.all([apiFetch<PushConfig>("/user/push/config",{token,cache:"no-store"}),registeredSubscription()])
       .then(async([config,subscription])=>{
         const status=subscription?await apiFetch<{current_device_subscribed:boolean}>("/user/push/subscriptions?endpoint="+encodeURIComponent(subscription.endpoint),{token,cache:"no-store"}):null;
         if(active){setPushConfig(config);setDeviceSubscribed(!!subscription&&!!status?.current_device_subscribed);setPermission(supportsWebPush()?Notification.permission:null);}
       })
       .catch(()=>{if(active)setPushConfig({configured:false,public_key:null});});
      return ()=>{active=false;};
    },[token]);
    async function enableDevice(){
      if(!token||!pushConfig?.public_key)return;
      setPushBusy(true);setMessage(null);setError(null);
      try{
        await enablePushOnDevice(token,pushConfig.public_key);
        if(user?.customer_profile){
          await customerUpdateProfile(token,{
            first_name:user.customer_profile.first_name,last_name:user.customer_profile.last_name,email:user.customer_profile.email,
            phone:user.customer_profile.phone,avatar_url:user.customer_profile.avatar_url,
            preferences:{notifications:{email_updates:emailUpdates,reward_alerts:rewardAlerts,promotions,push_enabled:true},ui:{dark_mode:true}}
          });
          await refresh();
        }
        setPushEnabled(true);setDeviceSubscribed(true);setPermission("granted");
        setMessage("Phone notifications enabled on this device.");
      }catch(e){setError(e instanceof Error?e.message:"Could not enable device notifications.");}
      finally{setPushBusy(false);}
    }
    async function disableDevice(){
      if(!token)return;
      setPushBusy(true);setMessage(null);setError(null);
      try{await disablePushOnDevice(token);setDeviceSubscribed(false);setMessage("This device was removed from push notifications.");}
      catch(e){setError(e instanceof Error?e.message:"Could not remove this device.");}
      finally{setPushBusy(false);}
    }
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
    return (<CustomerLayout title={tr("Settings")} subtitle={tr("Manage notification preferences")}>
      <div className="space-y-4">
        <CustomerPasskeySettings/>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Notification preferences")}</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-2">
            <p className="text-xs leading-5 text-muted-foreground">Account and reward alerts are enabled by default. Promotional offers are optional. Phone notifications require permission on each device.</p>
            <ToggleRow title={tr("Email updates")} description={tr("Receive account and loyalty updates by email.")} checked={emailUpdates} onToggle={() => setEmailUpdates((v) => !v)}/>
            <ToggleRow title={tr("Reward alerts")} description={tr("Get notified when rewards are ready.")} checked={rewardAlerts} onToggle={() => setRewardAlerts((v) => !v)}/>
            <ToggleRow title={tr("Promotions")} description={tr("Receive occasional promotional offers.")} checked={promotions} onToggle={() => setPromotions((v) => !v)}/>
            <ToggleRow title={tr("Push notifications")} description={tr("Allow Web Push alerts for your loyalty account. Each device also needs permission below.")} checked={pushEnabled} onToggle={() => setPushEnabled((v) => !v)}/>
          </CardContent>
        </Card>
        <Card className="lg:hidden">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="size-4 text-[#e7b354]"/>Real phone notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Receive loyalty stamp updates, unlocked rewards, promotions (only if opted in), and birthday surprises even when Loyvance is closed.</p>
            {pushConfig?.configured===false?<p className="text-amber-300">Push delivery is not configured on the server yet (VAPID keys required).</p>:null}
            {typeof window!=="undefined"&&!supportsWebPush()?<p className="text-amber-300">This browser does not support Web Push or this page is not on HTTPS.</p>:null}
            {typeof window!=="undefined"&&supportsWebPush()&&isIosPwaRequired()?<p className="text-amber-300">On iPhone: install Loyvance using Safari → Share → Add to Home Screen, then open the installed app to enable notifications.</p>:null}
            {permission==="denied"?<p className="text-amber-300">Notifications are blocked in this device&apos;s browser settings. You must allow them there first.</p>:null}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-3"><Smartphone className="size-5 text-[#e7b354]"/><span className="flex-1">{deviceSubscribed?"This device is subscribed":"This device is not subscribed"}</span><ShieldCheck className="size-4 text-white/40"/></div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pushBusy||!token||!pushConfig?.configured||!pushConfig?.public_key||deviceSubscribed||!supportsWebPush()||isIosPwaRequired()} onClick={()=>void enableDevice()}>
                {pushBusy?"Updating…":"Enable on this device"}
              </Button>
              <Button type="button" variant="outline" disabled={pushBusy||!token||!deviceSubscribed} onClick={()=>void disableDevice()}>Remove this device</Button>
            </div>
            <p className="text-xs text-muted-foreground">Permission is requested only after tapping Enable. You can disable alerts globally with the switch above and Save settings. Browser-level permission can also be revoked from device settings.</p>
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{tr(error)}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{tr(message)}</p> : null}

        <Button className="w-full" onClick={savePreferences} disabled={saving}>
          {saving ? tr("Saving...") : tr("Save settings")}
        </Button>

      </div>
    </CustomerLayout>);
}
