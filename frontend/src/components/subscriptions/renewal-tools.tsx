"use client";
import { getFormattingLocale } from "@/components/i18n/language-provider";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, CreditCard, Upload, FileCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { SUBSCRIPTION_PLANS, type RenewalRequest, type SubscriptionMonths } from "@/lib/subscription";
const field = "mt-2 w-full rounded-xl border border-white/10 bg-white/[.025] px-3 py-3 text-sm outline-none focus:border-[#edbc62]/50";
export function DurationChoices({ months, onChange, disabled }: {
    months: SubscriptionMonths;
    onChange: (v: SubscriptionMonths) => void;
    disabled?: boolean;
}) {
    const { t: tr } = useI18n();
    return <fieldset disabled={disabled}><legend className="mb-3 text-xs text-white/65">{tr("Duration and total plan price")}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{SUBSCRIPTION_PLANS.map(plan => <label key={plan.months} className={`relative cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-[#edbc62] ${months === plan.months ? "border-[#edbc62]/60 bg-[#edbc62]/10" : "border-white/10 bg-white/[.025] hover:border-[#edbc62]/30"}`}><input type="radio" name="subscription-duration" value={plan.months} checked={months === plan.months} onChange={() => onChange(plan.months)} className="sr-only"/><span className="block text-xs font-semibold text-white/75">{tr(plan.label)}</span><span className="mt-2 block text-lg font-bold text-[#edbc62]">{plan.price.toLocaleString(getFormattingLocale())} <span className="text-xs">{tr("DH")}</span></span><span className="mt-1 block text-[10px] text-white/45">{(plan.price / plan.months).toFixed(2)}{tr(" DH / month")}</span>{months === plan.months ? <Check className="absolute end-2 top-2 size-3 text-[#edbc62]"/> : null}</label>)}</div></fieldset>;
}
export function ProofPreview({ path, token, onClose }: {
    path: string;
    token: string;
    onClose: () => void;
}) {
    const { t: tr } = useI18n();
    const [url, setUrl] = useState(""), [error, setError] = useState("");
    useEffect(() => { const controller = new AbortController(); let objectUrl = ""; fetch(API_BASE_URL + path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal }).then(async (r) => { if (!r.ok)
        throw Error("Unable to read this payment proof."); return r.blob(); }).then(blob => { if (controller.signal.aborted)
        return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(e => { if (!controller.signal.aborted)
        setError(e.message); }); return () => { controller.abort(); if (objectUrl)
        URL.revokeObjectURL(objectUrl); }; }, [path, token]);
    return <Modal isOpen onClose={onClose} title={tr("Payment proof")} description={tr("Visible only to the business and platform administrators.")}><div className="min-h-40">{error ? <p role="alert" className="text-xs text-rose-300">{tr(error)}</p> : url ? <img alt={tr("Submitted payment proof")} src={url} className="max-h-[65dvh] w-full rounded-xl object-contain"/> : <p className="p-8 text-center text-xs text-white/50">{tr("Loading proof\u2026")}</p>}</div></Modal>;
}
export function BusinessRenewalRequest({ token, requests, onSaved }: {
    token: string;
    requests: RenewalRequest[];
    onSaved: () => void;
}) {
    const { t: tr } = useI18n();
    const [months, setMonths] = useState<SubscriptionMonths>(1), [note, setNote] = useState(""), [reference, setReference] = useState(""), [file, setFile] = useState<File | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [proof, setProof] = useState<string | null>(null);
    const request = useRef<{
        id: string;
        key: string;
    } | null>(null);
    const pending = requests.find(r => r.status === "pending");
    async function submit(e: FormEvent) {
        e.preventDefault();
        if (!file || busy)
            return;
        const key = JSON.stringify([months, note.trim(), reference.trim(), file.name, file.size, file.lastModified]);
        if (request.current?.key !== key)
            request.current = { id: crypto.randomUUID(), key };
        const form = new FormData();
        form.set("request_id", request.current.id);
        form.set("duration_months", String(months));
        form.set("note", note.trim());
        form.set("reference", reference.trim());
        form.set("proof", file);
        setBusy(true);
        setError("");
        try {
            const r = await apiFetch<{
                message: string;
            }>("/subscription/requests", { token, method: "POST", body: form });
            setMessage(r.message);
            setOpen(false);
            setFile(null);
            setNote("");
            setReference("");
            request.current = null;
            onSaved();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Unable to submit renewal request.");
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="mt-5 rounded-2xl border border-[#edbc62]/20 bg-[#edbc62]/[.035] p-4 sm:p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="size-4 text-[#edbc62]"/>{tr("Renew your subscription")}</h3><p className="mt-2 text-xs leading-5 text-white/50">{tr("Send your payment proof to renew your access.")}</p>{message ? <p role="status" className="mt-3 text-xs text-emerald-300">{tr(message)}</p> : null}
 {pending ? <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">{tr("Your ")}{pending.duration_months}{tr("-month request is awaiting review.")}</p> : !open ? <button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-xl bg-[#edbc62] px-4 py-3 text-xs font-bold text-black">{tr("Submit payment for renewal")}</button> : <form onSubmit={submit} className="mt-4 space-y-4"><DurationChoices months={months} onChange={setMonths} disabled={busy}/><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/65">{tr("Payment reference")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={200} disabled={busy} className={field}/></label><label className="text-xs text-white/65">{tr("Payment proof (required)")}<input type="file" accept="image/png,image/jpeg,image/webp" required disabled={busy} onChange={e => { const f = e.target.files?.[0] ?? null; if (f && f.size > 2 * 1024 * 1024) {
        setError("Proof must be 2 MB or smaller.");
        e.target.value = "";
        setFile(null);
    }
    else {
        setFile(f);
        setError("");
    } }} className={`${field} text-xs file:me-2 file:rounded-lg file:border-0 file:bg-[#edbc62]/15 file:p-1 file:text-[#edbc62]`}/><span className="mt-1 block text-[10px] text-white/40">{tr("Private JPG, PNG or WebP \u00B7 up to 2 MB")}</span></label></div><label className="block text-xs text-white/65">{tr("Note")}<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} disabled={busy} className={`${field} min-h-20`}/></label>{error ? <p role="alert" className="text-xs text-rose-300">{tr(error)}</p> : null}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs">{tr("Cancel")}</button><button disabled={busy || !file} className="inline-flex items-center gap-2 rounded-xl bg-[#edbc62] px-4 py-2.5 text-xs font-bold text-black disabled:opacity-40"><Upload className="size-4"/>{busy ? tr("Submitting…") : tr("Send for review")}</button></div></form>}
 {requests.length && !pending ? <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3"><p className="text-xs text-white/55">{tr("Last request ")}<span className={`ml-1 font-semibold ${requests[0].status === "approved" ? "text-emerald-300" : "text-rose-300"}`}>{requests[0].status === "approved" ? tr("approved") : tr("not approved")}</span></p><button type="button" onClick={() => setProof(requests[0].id)} className="inline-flex items-center gap-1 text-[11px] text-[#edbc62]"><FileCheck className="size-3"/>{tr("Payment proof")}</button></div> : null}
 {proof ? <ProofPreview token={token} path={`/subscription/requests/${proof}/proof`} onClose={() => setProof(null)}/> : null}</section>;
}
