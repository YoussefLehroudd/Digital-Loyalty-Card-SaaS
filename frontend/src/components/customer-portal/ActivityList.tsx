"use client";
import { getFormattingLocale } from "@/components/i18n/language-provider";
import { useI18n } from "@/components/i18n/language-provider";
type ActivityItem = {
    id: string;
    type: string;
    date: string | null;
    points?: number;
};
type Props = {
    items: ActivityItem[];
};
function formatDate(date: string | null) {
    if (!date)
        return "—";
    try {
        const d = new Date(date);
        return d.toLocaleString(getFormattingLocale(), {
            month: "short",
            day: "2-digit",
            year: "numeric",
        });
    }
    catch {
        return date;
    }
}
function labelForType(type: string) {
    switch (type) {
        case "visit":
            return "Visit";
        case "reward_claimed":
            return "Reward claimed";
        case "reward_redeemed":
            return "Reward redeemed";
        default:
            return "Activity";
    }
}
export default function ActivityList({ items }: Props) {
    const { t: tr } = useI18n();
    return (<div className="space-y-4">
      <div className="px-1">
        <div className="text-base font-semibold text-slate-900">{tr("Activity")}</div>
        <div className="text-sm text-slate-600 mt-1">{tr("Visits and reward events")}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {items.length === 0 ? (<div className="text-sm text-slate-600">{tr("No activity yet.")}</div>) : (<div className="space-y-3">
            {items.slice(0, 12).map((it) => (<div key={it.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {labelForType(it.type)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {formatDate(it.date)}
                    </div>
                  </div>

                  <div className="text-end">
                    {typeof it.points === "number" ? (<>
                        <div className="text-xs text-slate-500">{tr("Points")}</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {it.points}
                        </div>
                      </>) : (<div className="text-xs text-slate-500">&nbsp;</div>)}
                  </div>
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
}
