"use client";

import { useRef, useState, type FormEvent } from "react";
import { Crown } from "lucide-react";
import { useAdmin, useAdminLive } from "@/components/admin/admin-shell";
import { SubscriptionDetailsView } from "@/components/subscriptions/subscription-details";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRequest, type AdminRow } from "@/lib/admin";
import { subscriptionDate, type SubscriptionDetails } from "@/lib/subscription";

export function AdminSubscription({ business, onClose, onSaved }: { business: AdminRow; onClose: () => void; onSaved: () => void }) {
  const { token } = useAdmin();
  const { data, error, refresh } = useAdminLive<SubscriptionDetails>(`businesses/${business.id}/subscription`);
  const [confirm, setConfirm] = useState(false), [note, setNote] = useState(""), [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saveError, setSaveError] = useState("");
  const request = useRef<{ id: string; revision: number; note: string; reference: string } | null>(null);
  const field = "mt-2 w-full rounded-xl border border-white/10 bg-white/[.025] px-3 py-3 text-sm outline-none focus:border-[#edbc62]/50";
  async function activate(event: FormEvent) {
    event.preventDefault(); if (!data || busy) return;
    const cleanNote = note.trim(), cleanReference = reference.trim();
    if (!request.current || request.current.note !== cleanNote || request.current.reference !== cleanReference) request.current = { id: crypto.randomUUID(), revision: data.subscription.revision, note: cleanNote, reference: cleanReference };
    setBusy(true); setSaveError("");
    try {
      const r = request.current;
      const result = await adminRequest<{ message: string }>(`businesses/${business.id}/subscription`, token, { method: "POST", body: JSON.stringify({ request_id: r.id, revision: r.revision, note: r.note, reference: r.reference }) });
      setMessage(result.message); setConfirm(false); setNote(""); setReference(""); request.current = null; refresh(); onSaved();
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "Unable to activate subscription."); refresh(); }
    finally { setBusy(false); }
  }
  return <Modal className="sm:max-w-5xl" isOpen onClose={onClose} closeDisabled={busy} title="Business subscription" description={business.name} icon={<Crown className="size-6" />}>
    {error ? <p role="alert" className="mb-4 text-xs text-rose-300">{error}</p> : null}
    {message ? <p role="status" className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300">{message}</p> : null}
    {data ? <><SubscriptionDetailsView data={data} businessName={business.name} />
      {confirm ? <form onSubmit={activate} className="mt-6 space-y-4 rounded-2xl border border-[#edbc62]/25 bg-[#edbc62]/[.035] p-4"><h3 className="text-sm font-semibold">Activate one calendar month</h3><p className="text-xs leading-5 text-white/55">The new period starts when you confirm. It replaces any remaining trial or subscription time. Current expiry: <strong className="text-white/80">{subscriptionDate(data.subscription.period_ends_at)}</strong>. Account suspension stays separate.</p><label className="block text-xs text-white/65">Activation note (required)<textarea required maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} disabled={busy} className={`${field} min-h-24`} placeholder="Reason for activation or payment details" /></label><label className="block text-xs text-white/65">Payment / internal reference (optional)<input maxLength={200} value={reference} onChange={event=>setReference(event.target.value)} disabled={busy} className={field} placeholder="Bank transfer or receipt reference" /></label>{saveError ? <p role="alert" className="text-xs text-rose-300">{saveError}</p> : null}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={()=>{setConfirm(false); request.current=null;}} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs">Cancel</button><button disabled={busy || !note.trim()} className="rounded-xl bg-[#edbc62] px-4 py-2.5 text-xs font-bold text-black disabled:opacity-40">{busy ? "Activating…" : "Confirm activation"}</button>{saveError ? <button type="button" onClick={()=>{request.current=null;setSaveError("");refresh();}} className="text-xs text-[#edbc62]">Review latest period</button> : null}</div></form> : <button type="button" onClick={()=>{setConfirm(true);setMessage("");}} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#dba545] to-[#f4ce87] px-4 py-3.5 text-xs font-bold text-black"><Crown className="size-4" />Activate one month</button>}
    </> : <Skeleton className="h-64 rounded-2xl" />}
  </Modal>;
}
