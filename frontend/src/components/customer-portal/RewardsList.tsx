"use client";

type RewardItem = {
  reward_name: string | null;
  reward_description: string | null;
  points_required: number;
  ready: boolean;
};

type HistoryItem = {
  id: string;
  status: "collecting" | "ready" | "redeemed";
  earned_at: string | null;
  redeemed_at: string | null;
};

type Props = {
  availableRewards: RewardItem[];
  history: HistoryItem[];
};

function statusLabel(s: HistoryItem["status"]) {
  if (s === "collecting") return "Collecting";
  if (s === "ready") return "Ready";
  if (s === "redeemed") return "Redeemed";
  return s;
}

export default function RewardsList({ availableRewards, history }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold text-slate-900">Rewards</div>
        <div className="text-sm text-slate-600 mt-1">Available and history</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Available rewards</div>

        {availableRewards.length === 0 ? (
          <div className="text-sm text-slate-600 mt-2">No rewards available yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {availableRewards.map((r, idx) => (
              <div
                key={`${r.reward_name ?? "reward"}-${idx}`}
                className={`rounded-xl p-3 border ${
                  r.ready ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {r.reward_name ?? "Reward"}
                    </div>
                    {r.reward_description ? (
                      <div className="text-sm text-slate-600 mt-1">
                        {r.reward_description}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Requires</div>
                    <div className="font-semibold text-slate-900">{r.points_required} pts</div>
                    <div className="mt-1 text-xs font-medium text-slate-700">
                      {r.ready ? "Ready to claim" : "Keep collecting"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Redeemed history</div>

        {history.length === 0 ? (
          <div className="text-sm text-slate-600 mt-2">No reward activity yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {statusLabel(h.status)}
                  </div>
                  <div className="text-xs text-slate-600">
                    {h.redeemed_at ? "Redeemed" : h.earned_at ? "Earned" : ""}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {h.redeemed_at ?? h.earned_at ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
