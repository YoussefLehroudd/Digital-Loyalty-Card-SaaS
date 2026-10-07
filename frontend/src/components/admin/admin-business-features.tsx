"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Stamp, MessageSquare, Gift } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRequest, type AdminRow } from "@/lib/admin";
import type { StampFeatures } from "@/components/scanner/stamp-options";

export function AdminBusinessFeatures({ business, token, onClose }: { business: AdminRow | null; token: string; onClose: () => void }) {
  const [features, setFeatures] = useState<(StampFeatures & {reward_levels_enabled:boolean}) | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const saving = useRef(false);
  const businessId = business?.id;
  useEffect(() => {
    let active = true; setFeatures(null); setError("");
    if (!businessId) return;
    setLoading(true);
    adminRequest<{ features: StampFeatures & {reward_levels_enabled:boolean} }>(`businesses/${businessId}/features`, token).then(data => { if (active) setFeatures(data.features); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load options."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, token]);
  async function save() {
    if (!business || !features || saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try { await adminRequest(`businesses/${business.id}/features`, token, { method: "PATCH", body: JSON.stringify(features) }); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save options."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Modal isOpen={!!business} onClose={onClose} closeDisabled={busy} title="Business options" description={business?.name} icon={<SlidersHorizontal className="size-6" />}>
    <p className="mb-5 text-sm leading-6 text-white/55">Grant access to the tools this business needs. The owner can then switch each tool on or off in Loyalty card settings.</p>
    {loading ? <Skeleton className="h-40 rounded-xl" /> : features ? <div className="space-y-3">{[{ key: "custom_stamp_quantity" as const, title: "Custom stamp quantity", text: "Choose how many stamps to award for each confirmed purchase.", icon: Stamp }, { key: "stamp_messages" as const, title: "Stamp messages", text: "Include a personal message in the customer's notification and activity.", icon: MessageSquare }, { key: "reward_levels_enabled" as const, title: "Reward levels & customer goals", text: "Allow the owner to configure 10 reward milestones and let customers choose their goal.", icon: Gift }].map(option => <div key={option.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4"><option.icon className="size-5 shrink-0 text-[#edbc62]" /><div className="min-w-0 flex-1"><p id={`feature-${option.key}`} className="text-sm font-semibold">{option.title}</p><p className="mt-1 text-xs leading-5 text-white/45">{option.text}</p></div><button type="button" role="switch" aria-labelledby={`feature-${option.key}`} aria-checked={features[option.key]} disabled={busy} onClick={() => setFeatures({ ...features, [option.key]: !features[option.key] })} className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62] ${features[option.key] ? "border-[#edbc62] bg-[#c79847]" : "border-white/20 bg-white/10"}`}><span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform ${features[option.key] ? "translate-x-5" : "translate-x-0"}`} /></button></div>)}</div> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p> : null}
    <div className="mt-5 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={!features || loading || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save options"}</Button></div>
  </Modal>;
}
