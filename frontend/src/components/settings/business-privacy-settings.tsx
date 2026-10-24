"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
type Preference = {
    admin_contact_access: boolean;
};
export function BusinessPrivacySettings({ token }: {
    token: string;
}) {
    const { t: tr } = useI18n();
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const saving = useRef(false);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoaded(false);
        apiFetch<Preference>("/business/privacy", { token }).then(data => {
            if (active) {
                setAllowed(data.admin_contact_access);
                setLoaded(true);
                setError("");
            }
        }).catch(cause => { if (active)
            setError(cause instanceof Error ? cause.message : "Unable to load privacy settings."); })
            .finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [token]);
    async function toggle() {
        if (saving.current || loading || !loaded)
            return;
        saving.current = true;
        setBusy(true);
        setError("");
        setSaved(false);
        try {
            const data = await apiFetch<Preference>("/business/privacy", { token, method: "PATCH", body: JSON.stringify({ admin_contact_access: !allowed }) });
            setAllowed(data.admin_contact_access);
            setSaved(true);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save privacy settings.");
        }
        finally {
            saving.current = false;
            setBusy(false);
        }
    }
    return <section className="rounded-2xl border border-[#d8a63f]/20 bg-[linear-gradient(135deg,rgba(20,19,14,.9),rgba(9,10,8,.95))] p-4 sm:p-5" aria-labelledby="business-privacy-title">
    <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d8a63f]/20 bg-[#d8a63f]/10 text-[#ffc857]"><ShieldCheck className="size-5"/></div><div className="min-w-0 flex-1"><h2 id="business-privacy-title" className="text-base font-semibold">{tr("Customer privacy")}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{tr("You decide whether the platform administrator can view your customers\u2019 email addresses and phone numbers.")}</p></div></div>
    <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-4"><div className="min-w-0 flex-1"><p id="admin-contact-label" className="text-sm font-medium">{tr("Allow platform admin to view customer contact details")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{tr("Off by default. Your business keeps access to its customers. If another connected business keeps contacts private, they remain hidden in the admin directory.")}</p></div><button type="button" role="switch" aria-checked={allowed} aria-labelledby="admin-contact-label" disabled={loading || busy || !loaded} onClick={toggle} className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc857] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 ${allowed ? "border-[#ffc857] bg-[#d8a63f]" : "border-white/20 bg-white/10"}`}><span className={`absolute start-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform ${allowed ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"}`}>{loading || busy ? <Loader2 className="size-3 animate-spin text-black"/> : null}</span></button></div>
    <p role={error ? "alert" : "status"} className={`mt-3 text-xs ${error ? "text-rose-300" : "text-muted-foreground"}`}>{error || (loading ? "Loading privacy preference…" : busy ? "Saving preference…" : saved ? "Privacy preference saved." : allowed ? "Administrator contact access is enabled." : "Customer contacts are private in the admin panel.")}</p>
  </section>;
}
