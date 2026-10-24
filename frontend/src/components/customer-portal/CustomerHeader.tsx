"use client";
import { useI18n } from "@/components/i18n/language-provider";
type Props = {
    name: string;
    tier: string;
    pointsBalance: number;
    avatarUrl?: string | null;
};
export default function CustomerHeader({ name, tier, pointsBalance, avatarUrl, }: Props) {
    const { t: tr } = useI18n();
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("");
    return (<div className="flex items-center gap-3">
      {avatarUrl ? (
        // If backend later provides real avatar URL, this shows it.
        // For now Phase 1 keeps placeholder as requested.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={tr("{0} avatar", { "0": name })} className="h-12 w-12 rounded-full object-cover bg-slate-100"/>) : (<div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold">
          {initials || tr("C")}
        </div>)}

      <div className="min-w-0">
        <div className="text-lg font-semibold text-slate-900 truncate">{name}</div>
        <div className="text-sm text-slate-600">{tr(" Tier: ")}<span className="font-medium text-slate-800">{tier}</span>
        </div>
        <div className="text-sm text-slate-600">{tr(" Points: ")}<span className="font-medium text-slate-800">{pointsBalance}</span>
        </div>
      </div>
    </div>);
}
