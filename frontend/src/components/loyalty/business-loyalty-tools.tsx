"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, SlidersHorizontal, LockKeyhole } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { RewardLevelSettings, type MainReward } from "@/components/loyalty/reward-level-settings";
import type { BusinessFeatures, FeatureState } from "@/lib/server/business-features";
const options = [
    { key: "reward_levels_enabled", title: "Customer reward choice", description: "Let customers choose a stamp goal and change it from their card.", icon: Gift },
] as const;
export function BusinessLoyaltyTools({ token, baseCard, onCardSaved }: {
    token: string;
    baseCard?: MainReward;
    onCardSaved?: () => Promise<void>;
}) {
    const { t: tr } = useI18n();
    const [features, setFeatures] = useState<FeatureState | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const saving = useRef(false);
    const refresh = useCallback(async () => { const response = await apiFetch<{
        features: FeatureState;
    }>("/business/features", { token }); setFeatures(response.features); }, [token]);
    useEffect(() => { let active = true; const load = async () => { try {
        const response = await apiFetch<{
            features: FeatureState;
        }>("/business/features", { token });
        if (active)
            setFeatures(response.features);
    }
    catch (cause) {
        if (active)
            setError(cause instanceof Error ? cause.message : "Unable to load business tools.");
    } }; void load(); const timer = setInterval(() => { if (document.visibilityState === "visible" && !saving.current)
        void load(); }, 3000); return () => { active = false; clearInterval(timer); }; }, [token]);
    async function toggle(key: keyof BusinessFeatures) { if (!features || saving.current)
        return; saving.current = true; setBusy(true); setError(""); try {
        const next = { custom_stamp_quantity: features.custom_stamp_quantity, stamp_messages: features.stamp_messages, reward_levels_enabled: features.reward_levels_enabled, [key]: !features[key] };
        const result = await apiFetch<{
            features: FeatureState;
        }>("/business/features", { token, method: "PATCH", body: JSON.stringify(next) });
        setFeatures(result.features);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to change this option.");
    }
    finally {
        saving.current = false;
        setBusy(false);
    } }
    if (!features && !error)
        return <Skeleton className="h-40 rounded-2xl"/>;
    return <div className="business-loyalty-tools space-y-5"><section className="rounded-[20px] border border-[#d6a33d]/25 bg-black/25 p-5 sm:p-6"><div className="flex items-start gap-3"><SlidersHorizontal className="mt-1 size-5 shrink-0 text-[#ffc857]"/><div><h2 className="text-lg font-semibold">{tr("Business tools")}</h2><p className="mt-1 text-sm leading-6 text-white/50">{tr("Your administrator grants access. You decide which tools to use.")}</p></div></div><div className="mt-5 grid gap-3">{features ? options.map(option => { const allowed = features.access[option.key], enabled = features[option.key]; return <div key={option.key} className={`rounded-xl border p-4 ${enabled ? "border-[#ffc857]/35 bg-[#ffc857]/5" : "border-white/10 bg-white/[.025]"}`}><div className="flex items-center gap-3"><option.icon className="size-5 shrink-0 text-[#ffc857]"/><p id={`business-tool-${option.key}`} className="flex-1 text-sm font-semibold">{tr(option.title)}</p><button type="button" role="switch" aria-labelledby={`business-tool-${option.key}`} aria-checked={enabled} disabled={busy || !allowed} onClick={() => void toggle(option.key)} className={`relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc857] disabled:opacity-40 ${enabled ? "border-[#ffc857] bg-[#c79847]" : "border-white/20 bg-white/10"}`}><span className={`absolute start-0.5 top-0.5 size-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5 rtl:-translate-x-5" : ""}`}/></button></div><p className="mt-3 text-xs leading-5 text-white/50">{tr(option.description)}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-white/40">{!allowed ? <><LockKeyhole className="size-3"/>{tr("Administrator access required")}</> : option.key === "reward_levels_enabled" && !enabled ? tr("Switch on to offer your main reward and 9 additional milestones.") : option.key === "reward_levels_enabled" && !features.reward_levels_configured ? tr("Save rewards below so customers can choose.") : enabled ? tr("Active for your customers") : tr("Available · switched off")}</p></div>; }) : null}</div>{error ? <p role="alert" className="mt-4 text-sm text-rose-300">{tr(error)}</p> : null}</section>{features?.reward_levels_enabled ? <RewardLevelSettings token={token} onSaved={async () => { await refresh(); await onCardSaved?.(); }} baseCard={baseCard}/> : null}</div>;
}
