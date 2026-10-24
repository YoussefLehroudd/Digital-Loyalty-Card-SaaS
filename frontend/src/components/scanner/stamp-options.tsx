"use client";
import { useI18n } from "@/components/i18n/language-provider";
export type StampFeatures = {
    custom_stamp_quantity: boolean;
    stamp_messages: boolean;
    reward_levels_enabled?: boolean;
};
export type ScanPreview = {
    customer_name: string;
    current_stamps: number;
    required_stamps: number;
    reward_name: string;
    reward_ready: boolean;
    features?: StampFeatures;
};
export type StampSelection = {
    stamp_count: number;
    stamp_message: string;
};
export const defaultStampSelection = (): StampSelection => ({ stamp_count: 1, stamp_message: "" });
export function StampOptions({ features, value, onChange, remaining, disabled, prefix }: {
    features?: StampFeatures;
    value: StampSelection;
    onChange: (value: StampSelection) => void;
    remaining: number;
    disabled?: boolean;
    prefix: string;
}) {
    const { t: tr } = useI18n();
    if (!features?.custom_stamp_quantity && !features?.stamp_messages)
        return null;
    const input = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-[#ffc857]/60 disabled:opacity-50";
    return <div className="space-y-4 rounded-xl border border-[#e7b354]/20 bg-[#e7b354]/5 p-4">
    {features.custom_stamp_quantity ? <div><label htmlFor={`${prefix}-count`} className="mb-2 block text-sm font-medium">{tr("Stamps for this purchase")}</label><div className="flex items-center gap-3"><button type="button" aria-label={tr("Remove one stamp")} disabled={disabled || value.stamp_count <= 1} onClick={() => onChange({ ...value, stamp_count: value.stamp_count - 1 })} className="size-11 shrink-0 rounded-xl border border-white/15 text-xl disabled:opacity-30">−</button><input id={`${prefix}-count`} type="number" min={1} max={Math.min(100, remaining)} step={1} value={value.stamp_count || ""} disabled={disabled} onChange={event => onChange({ ...value, stamp_count: Number(event.target.value) })} className={`${input} text-center`}/><button type="button" aria-label={tr("Add one stamp")} disabled={disabled || value.stamp_count >= Math.min(100, remaining)} onClick={() => onChange({ ...value, stamp_count: value.stamp_count + 1 })} className="size-11 shrink-0 rounded-xl border border-white/15 text-xl disabled:opacity-30">+</button></div><p className="mt-2 text-xs text-muted-foreground">{remaining}{tr(" stamps remain in this cycle. Choose the quantity for this confirmed purchase.")}</p></div> : null}
    {features.stamp_messages ? <div><label htmlFor={`${prefix}-message`} className="mb-2 block text-sm font-medium">{tr("Message for the customer ")}<span className="text-xs text-muted-foreground">{tr("(optional)")}</span></label><textarea id={`${prefix}-message`} rows={2} maxLength={500} value={value.stamp_message} disabled={disabled} onChange={event => onChange({ ...value, stamp_message: event.target.value })} placeholder={tr("e.g. Watch purchase — order HP-1042")} className={input}/><p className="mt-1 text-xs text-muted-foreground">{tr("Shown in the customer notification and activity. Applies to all stamps in this purchase.")}</p></div> : null}
  </div>;
}
