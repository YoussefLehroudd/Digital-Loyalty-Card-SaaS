"use client";

import { useState } from "react";
import { Mail, Trash2, UsersRound, X } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import { adminRequest } from "@/lib/admin";

export type VisitorDemoRequest = {
  id: string;
  created_at: string;
  contact_name: string;
  business_name: string;
  email: string;
  message: string;
  campaign_code: string | null;
  emailed: boolean;
};

export function VisitorDemoRequests({ requests, token, onDeleted }: {
  requests: VisitorDemoRequest[];
  token: string;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const visibleRequests = requests.filter(r => !hiddenIds.includes(r.id));

  async function remove(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setError("");
    setNotice("");
    try {
      await adminRequest("visitors/demo-requests/" + encodeURIComponent(id), token, { method: "DELETE" });
      setHiddenIds(previous => [...previous, id]);
      setConfirmId(null);
      setNotice(t("Demo request deleted."));
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not delete demo request."));
    } finally {
      setDeletingId(null);
    }
  }

  return <section id="demo-requests" className="admin-panel min-w-0 scroll-mt-24 rounded-2xl border border-[#edbc62]/20 bg-[#101318] p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#edbc62]"><UsersRound className="size-4"/>{t("Demo requests from interested businesses")}</p>
        <h2 className="mt-2 text-lg font-semibold">{t("Contact these businesses")}</h2>
        <p className="mt-1 text-xs leading-5 text-white/50">{t("These businesses explicitly asked for a demo. Use their email to reply; campaign references show where they arrived from.")}</p>
      </div>
      <span className="rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/10 px-4 py-2 text-xl font-bold tabular-nums text-[#edbc62]" aria-label={t("Total demo requests")}>{visibleRequests.length}</span>
    </div>

    {error?<p role="alert" className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>:null}
    {notice?<p role="status" className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-3 text-xs text-emerald-300">{notice}</p>:null}

    {visibleRequests.length===0?
      <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50">{t("No demo requests received yet.")}</p>:
      <div className="admin-visitors-ranking-scroll mt-4 max-h-[290px] min-h-0 space-y-2 overflow-x-hidden overflow-y-auto overscroll-y-contain pe-2 sm:max-h-[320px]"
        role="region" aria-label={t("Demo requests from interested businesses")} tabIndex={0}>
        {visibleRequests.map(r=><article key={r.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold text-white">{r.business_name}</h3>
              <p className="mt-1 text-xs text-white/70">{r.contact_name}</p>
              <p className="mt-1 break-all text-xs text-[#edbc62]">{r.email}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <a href={"mailto:"+r.email+"?subject="+encodeURIComponent("LOYVANCE - Your demo request")}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#edbc62]/40 px-3 text-xs font-semibold text-[#edbc62] hover:bg-[#edbc62]/10">
                <Mail className="size-4"/>{t("Reply by email")}
              </a>
              <button type="button" disabled={deletingId!==null}
                onClick={()=>{setConfirmId(r.id);setError("");setNotice("");}}
                aria-label={t("Delete demo request")+" "+r.business_name}
                title={t("Delete demo request")}
                className="grid size-9 place-items-center rounded-lg border border-white/15 text-white/60 transition hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-40">
                <Trash2 className="size-4"/>
              </button>
            </div>
          </div>
          {r.message?<p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white/[.035] p-3 text-xs leading-5 text-white/65">{r.message}</p>:null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
            <span>{new Date(r.created_at).toLocaleString()}</span>
            <span>{t("Campaign")}: {r.campaign_code||t("Direct / unknown")}</span>
          </div>
          {confirmId===r.id?<div role="group" aria-label={t("Confirm deletion")} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/25 bg-rose-400/5 p-3">
            <p className="min-w-0 flex-1 text-xs leading-5 text-rose-200">{t("Permanently delete this demo request? This action cannot be undone.")}</p>
            <button type="button" disabled={deletingId!==null} onClick={()=>setConfirmId(null)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/80"><X className="size-3.5"/>{t("Cancel")}</button>
            <button type="button" disabled={deletingId!==null} onClick={()=>void remove(r.id)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white disabled:opacity-40"><Trash2 className="size-3.5"/>{deletingId===r.id?t("Deleting…"):t("Confirm delete")}</button>
          </div>:null}
        </article>)}
      </div>}
  </section>;
}
