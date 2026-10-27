"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpRight, Building2, Check, ChevronLeft, ChevronRight, Copy, Handshake, Link2, MousePointer2, Pencil, Plus, ReceiptText, Search, Wallet, XCircle } from "lucide-react";
import { useAdmin, useAdminLive } from "./admin-shell";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n/language-provider";
import { adminRequest } from "@/lib/admin";
import { API_BASE_URL } from "@/lib/api";
import { affiliateMonth, commissionRate, type Affiliate, type AffiliateCommission, type AffiliateDetail, type AffiliateList } from "@/lib/affiliate";
import { money, subscriptionDate, SUBSCRIPTION_PLANS } from "@/lib/subscription";
import { siteUrl } from "@/lib/marketing-seo";

const field = "mt-2 w-full rounded-xl border border-white/10 bg-[#101319] px-3 py-3 text-sm text-white outline-none focus:border-[#edbc62]/60";
const action = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-[#edbc62]/40 hover:text-[#edbc62] disabled:opacity-40";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#dba545] to-[#f4ce87] px-4 py-3 text-xs font-bold text-black disabled:opacity-40";
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const referralUrl = (code: string) => `${siteUrl}/r/${code}`;

function Metric({ title, value, icon, gold = false }: { title: string; value: string; icon: ReactNode; gold?: boolean }) {
  return <div className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${gold ? "border-[#edbc62]/25 bg-[#edbc62]/[.06]" : "border-white/[.07] bg-[#101319]"}`}>
    <div className="flex items-center justify-between gap-3"><p className="text-xs leading-5 text-white/50">{title}</p><span className="shrink-0 text-[#edbc62]">{icon}</span></div>
    <p className={`mt-3 break-words text-xl font-bold tabular-nums sm:text-2xl ${gold ? "text-[#f4cb80]" : "text-white"}`}>{value}</p>
  </div>;
}
function Pagination({ page, total, change }: { page: number; total: number; change: (n: number) => void }) {
  const { t } = useI18n();
  return total > 25 ? <div className="mt-5 flex items-center justify-end gap-3 text-xs text-white/50">
    <button className={action} disabled={page <= 1} aria-label={t("Previous page")} onClick={() => change(page - 1)}><ChevronLeft className="size-4 rtl:rotate-180"/></button>
    <span>{page} / {Math.ceil(total / 25)}</span><button className={action} disabled={page * 25 >= total} aria-label={t("Next page")} onClick={() => change(page + 1)}><ChevronRight className="size-4 rtl:rotate-180"/></button>
  </div> : null;
}
function CopyLink({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false), [error, setError] = useState(false);
  return <div className="mt-4 rounded-xl border border-white/[.07] bg-black/25 p-3">
    <div className="flex items-center gap-2"><Link2 className="size-4 shrink-0 text-[#edbc62]/65"/><input dir="ltr" readOnly aria-label={t("Referral link")} className="min-w-0 flex-1 bg-transparent text-xs text-white/60 outline-none" value={referralUrl(code)} onFocus={e => e.target.select()}/>
    <button type="button" className="p-1 text-[#edbc62]" aria-label={t("Copy referral link")} onClick={async () => { try { await navigator.clipboard.writeText(referralUrl(code)); setCopied(true); setError(false); } catch { setError(true); } }}>{copied ? <Check className="size-4"/> : <Copy className="size-4"/>}</button></div>
    {copied || error ? <p role="status" className="mt-2 text-[11px] text-[#edbc62]">{t(error ? "Select and copy the link manually." : "Link copied.")}</p> : null}
  </div>;
}

export function AdminAffiliates() {
  const { t } = useI18n();
  const [month, setMonth] = useState(affiliateMonth), [query, setQuery] = useState(""), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Affiliate | "new" | null>(null), [selected, setSelected] = useState<string | null>(null);
  const { data, error, refresh } = useAdminLive<AffiliateList>(`affiliates?month=${month}&page=${page}&q=${encodeURIComponent(search)}`);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#edbc62]"><Handshake className="size-4"/>{t("Referral program")}</div><h1 className="text-2xl font-bold sm:text-3xl">{t("Affiliates")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">{t("Create referral links, track confirmed payments and settle your partners every month.")}</p></div><button className={primary} onClick={() => setEditor("new")}><Plus className="size-4"/>{t("Add affiliate")}</button></div>
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="text-xs text-white/50">{t("Statement month")}<input aria-label={t("Statement month")} type="month" min="2000-01" max="2099-12" value={month} onChange={e => { if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) { setMonth(e.target.value); setPage(1); } }} className={`${field} [color-scheme:dark]`}/></label>
    <form className="flex w-full items-center gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); setSearch(query); setPage(1); }}><input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} placeholder={t("Search name or referral code")} aria-label={t("Search affiliates")} className={`${field} !mt-0 sm:w-64`}/><button className={action} aria-label={t("Search")}><Search className="size-4"/></button></form></div>
    {error ? <p role="alert" className="rounded-xl border border-rose-400/20 p-3 text-xs text-rose-300">{t(error)}</p> : null}
    {data ? <><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric title={t("Referred payments this month")} value={money(data.summary.month_sales)} icon={<ReceiptText className="size-5"/>}/>
      <Metric title={t("Commission earned this month")} value={money(data.summary.month_earned)} icon={<ArrowUpRight className="size-5"/>}/>
      <Metric title={t("Payouts made this month")} value={money(data.summary.month_paid)} icon={<Check className="size-5"/>}/>
      <Metric title={t("Unpaid through selected month")} value={money(data.summary.due)} icon={<Wallet className="size-5"/>} gold/>
    </div><p className="text-xs leading-5 text-white/40">{t("Months use Casablanca time. Unpaid totals include previous months. Commissions apply to confirmed amounts, including renewals.")}</p>
    <div className="flex items-center gap-3 text-xs text-white/45"><span>{data.summary.partners} {t("partners")}</span><span className="size-1 rounded-full bg-white/20"/><span>{data.summary.referrals} {t("referred businesses")}</span></div>
    {data.data.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.data.map(a => <article key={a.id} className="min-w-0 rounded-2xl border border-white/[.08] bg-gradient-to-b from-[#14181e] to-[#0f1217] p-5">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#edbc62]/20 bg-[#edbc62]/10 font-bold text-[#edbc62]">{a.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{a.name}</h2><p className="mt-1 text-xs text-white/40">{a.commission_bps / 100}% {t("commission")}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${a.active ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-white/40"}`}>{t(a.active ? "Active" : "Paused")}</span></div>
      <CopyLink code={a.code}/><div className="my-4 flex flex-wrap gap-4 text-xs text-white/50"><span className="flex items-center gap-1.5"><MousePointer2 className="size-3.5"/>{a.visits} {t("tracked visits")}</span><span className="flex items-center gap-1.5"><Building2 className="size-3.5"/>{a.referrals} {t("businesses")}</span></div>
      <div className="grid grid-cols-2 gap-3 border-y border-white/[.06] py-4"><div><p className="text-[10px] text-white/40">{t("Earned this month")}</p><p className="mt-1 font-bold tabular-nums">{money(a.month_earned ?? 0)}</p></div><div className="text-end"><p className="text-[10px] text-white/40">{t("Amount due")}</p><p className="mt-1 font-bold tabular-nums text-[#edbc62]">{money(a.due ?? 0)}</p></div></div>
      <div className="mt-4 flex gap-2"><button className={`${action} flex-1`} onClick={() => setSelected(a.id)}><ReceiptText className="size-4"/>{t("View statement")}</button><button className={action} onClick={() => setEditor(a)} aria-label={t("Edit affiliate")}><Pencil className="size-4"/></button></div>
    </article>)}</div> : <div className="rounded-3xl border border-dashed border-[#edbc62]/20 bg-[#edbc62]/[.025] px-6 py-14 text-center"><Handshake className="mx-auto mb-4 size-9 text-[#edbc62]/70"/><h2 className="font-semibold">{t(search ? "No matching affiliates." : "Your first partner starts here.")}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{t("Add a person and set their commission rate. Their referral link will be ready to share.")}</p></div>}
    <Pagination page={page} total={data.total} change={setPage}/></> : <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-32 rounded-2xl"/><Skeleton className="h-32 rounded-2xl"/><Skeleton className="h-72 rounded-2xl"/><Skeleton className="h-72 rounded-2xl"/></div>}
    {editor ? <AffiliateEditor key={editor === "new" ? "new" : editor.id} affiliate={editor === "new" ? undefined : editor} close={() => setEditor(null)} saved={() => { setEditor(null); refresh(); }}/> : null}
    {selected ? <AffiliateStatement id={selected} month={month} close={() => setSelected(null)} saved={refresh}/> : null}
  </div>;
}

function AffiliateEditor({ affiliate, close, saved }: { affiliate?: Affiliate; close: () => void; saved: () => void }) {
  const { t } = useI18n(), { token } = useAdmin();
  const [name, setName] = useState(affiliate?.name ?? ""), [email, setEmail] = useState(affiliate?.email ?? ""), [code, setCode] = useState(affiliate?.code ?? ""), [rate, setRate] = useState(affiliate ? String(affiliate.commission_bps / 100) : ""), [active, setActive] = useState(affiliate?.active ?? true);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  const bps = commissionRate(rate);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    const body = { name: name.trim(), email: email.trim(), code, commission_percent: rate, active, revision: affiliate?.revision };
    const key = JSON.stringify(body);
    if (!request.current || request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try { await adminRequest(affiliate ? `affiliates/${affiliate.id}` : "affiliates", token, { method: affiliate ? "PATCH" : "POST", body: JSON.stringify({ ...body, request_id: request.current.id }) }); saved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save affiliate."); }
    finally { setBusy(false); }
  }
  return <Modal isOpen onClose={close} closeDisabled={busy} title={t(affiliate ? "Edit affiliate" : "Add affiliate")} icon={<Handshake/>} className="sm:max-w-xl">
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
      <label className="block text-xs text-white/60">{t("Affiliate name")}<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={field}/></label>
      <label className="block text-xs text-white/60">{t("Contact email (optional)")}<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={field}/></label>
      <label className="block text-xs text-white/60">{t("Referral code")}<div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#101319] px-3" dir="ltr"><span className="text-xs text-white/30">/r/</span><input disabled={!!affiliate} pattern="[a-z0-9][a-z0-9-]{2,47}" minLength={3} maxLength={48} value={code} onChange={e => setCode(e.target.value.toLowerCase())} placeholder={t("Leave empty to generate")} className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none disabled:text-white/40"/></div></label>
      <p className="text-[11px] leading-5 text-white/40">{t(affiliate ? "The referral code stays fixed so shared links keep working." : "Choose your own code or leave it empty for a unique generated link.")}</p>
      <label className="block text-xs text-white/60">{t("Commission rate (%)")}<input required type="number" min="0.01" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} className={field}/></label>
      {bps ? <div className="rounded-xl border border-[#edbc62]/15 bg-[#edbc62]/5 p-3"><p className="mb-3 text-xs text-[#edbc62]">{t("Examples at current subscription prices")}</p><div className="grid grid-cols-2 gap-3">{SUBSCRIPTION_PLANS.map(p => <div key={p.months} className="text-xs"><p className="text-white/45">{t(p.label)} · {money(p.price * 100)}</p><p className="mt-1 font-semibold text-white">{money(Math.round(p.price * bps / 100))}</p></div>)}</div></div> : null}
      <p className="text-xs leading-5 text-white/45">{t("Commission is earned once per confirmed payment on the actual amount received, including renewals. A yearly payment earns commission in full in its payment month.")}</p>
      {affiliate ? <><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#edbc62]" checked={active} onChange={e => setActive(e.target.checked)}/>{t("Accept new referrals")}</label><p className="text-[11px] leading-5 text-white/40">{t("Pausing stops new referrals. Existing referred businesses keep earning commissions. Rate changes apply to future recorded payments only.")}</p></> : null}
    </fieldset>{error ? <p role="alert" className="text-xs text-rose-300">{t(error)}</p> : null}<div className="flex justify-end gap-2"><button type="button" disabled={busy} className={action} onClick={close}>{t("Cancel")}</button><button className={primary} disabled={busy || !bps || !name.trim()}>{t(busy ? "Saving…" : affiliate ? "Save changes" : "Create referral link")}</button></div></form>
  </Modal>;
}

function AffiliateStatement({ id, month, close, saved }: { id: string; month: string; close: () => void; saved: () => void }) {
  const { t } = useI18n(), { token } = useAdmin();
  const [tab, setTab] = useState<"commissions" | "referrals" | "payouts">("commissions"), [page, setPage] = useState(1);
  const { data, error, refresh } = useAdminLive<AffiliateDetail>(`affiliates/${id}?month=${month}&page=${page}`);
  const [payout, setPayout] = useState<AffiliateDetail["settlement"] | null>(null), [voiding, setVoiding] = useState<AffiliateCommission | null>(null), [exportError, setExportError] = useState(""), [exporting, setExporting] = useState(false);
  const changed = () => { refresh(); saved(); };
  async function download() {
    setExportError(""); setExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/affiliates/${id}/export?month=${month}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("Unable to export statement.");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a"); link.href = url; link.download = `affiliate-${data?.affiliate.code}-${month}.csv`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError("Unable to export statement."); } finally { setExporting(false); }
  }
  return <Modal isOpen onClose={close} title={data?.affiliate.name || t("Affiliate statement")} description={`${t("Statement month")} · ${month}`} icon={<ReceiptText/>} className="sm:max-w-5xl">
    {error || exportError ? <p role="alert" className="mb-4 text-xs text-rose-300">{t(error || exportError)}</p> : null}
    {data ? <><CopyLink code={data.affiliate.code}/><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric title={t("Earned this month")} value={money(data.affiliate.month_earned ?? 0)} icon={<ArrowUpRight className="size-4"/>}/><Metric title={t("Payouts made this month")} value={money(data.affiliate.month_paid ?? 0)} icon={<Check className="size-4"/>}/><Metric title={t("Unpaid through selected month")} value={money(data.settlement.amount_centimes)} icon={<Wallet className="size-4"/>} gold/></div>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-md text-xs leading-5 text-white/45">{t("Unpaid includes earlier months. Recording a payout settles only the commissions shown in the confirmation.")}</p><div className="flex flex-wrap gap-2"><button className={action} disabled={exporting} onClick={() => void download()}><ArrowDownToLine className="size-4"/>{t("Export month CSV")}</button><button className={primary} disabled={data.settlement.amount_centimes <= 0 || month > affiliateMonth()} onClick={() => setPayout({ ids: [...data.settlement.ids], amount_centimes: data.settlement.amount_centimes })}><Wallet className="size-4"/>{t("Record payout")}</button></div></div>
    <div className="mb-4 flex flex-wrap gap-2">{([['commissions', 'Monthly commissions'], ['referrals', 'Referred businesses'], ['payouts', 'Payout history']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => { setTab(key); setPage(1); }} className={`${action} ${tab === key ? "!border-[#edbc62]/30 !bg-[#edbc62]/10 !text-[#edbc62]" : ""}`}>{t(label)}</button>)}</div>
    {tab === "commissions" ? <div className="space-y-3">{data.commissions.length ? data.commissions.map(c => <article key={c.id} className="rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-white">{c.business_name}</p><p className="mt-1 text-[11px] text-white/40">{subscriptionDate(c.earned_at)} · {t(`${c.duration_months} ${c.duration_months === 1 ? "month" : "months"}`)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${c.voided_at ? "bg-rose-400/10 text-rose-300" : c.payout_id ? "bg-emerald-400/10 text-emerald-300" : "bg-[#edbc62]/10 text-[#edbc62]"}`}>{t(c.voided_at ? "Voided" : c.payout_id ? "Paid" : "Unpaid")}</span></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-white/55">{money(c.payment_centimes)} × {c.rate_bps / 100}% = <strong className="text-[#edbc62]">{money(c.amount_centimes)}</strong></p>{!c.payout_id && !c.voided_at ? <button type="button" onClick={() => setVoiding(c)} className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-rose-300"><XCircle className="size-3.5"/>{t("Void commission")}</button> : null}</div><p className="mt-2 break-all font-mono text-[10px] text-white/30">{c.receipt_number}</p>{c.void_reason ? <p className="mt-2 break-words text-xs text-rose-300/75">{c.void_reason}</p> : null}</article>) : <p className="py-10 text-center text-xs text-white/40">{t("No commissions for this month.")}</p>}</div> : null}
    {tab === "referrals" ? <div className="space-y-2"><p className="mb-3 text-[11px] text-white/35">{t("All referred businesses, across all months.")}</p>{data.referrals.length ? data.referrals.map(r => <div key={r.business_id} className="flex items-center gap-3 rounded-xl border border-white/10 p-4"><Building2 className="size-5 shrink-0 text-[#edbc62]"/><div><p className="text-sm text-white">{r.business_name}</p><p className="mt-1 text-[11px] text-white/40">{subscriptionDate(r.created_at)}</p></div></div>) : <p className="py-8 text-center text-xs text-white/40">{t("No referred businesses yet.")}</p>}</div> : null}
    {tab === "payouts" ? <div className="space-y-3"><p className="mb-3 text-[11px] text-white/35">{t("All recorded payouts, across all months.")}</p>{data.payouts.length ? data.payouts.map(p => <article key={p.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-emerald-300">{money(p.amount_centimes)}</strong><span className="text-xs text-white/40">{subscriptionDate(p.paid_at)}</span></div><p className="mt-2 break-words text-xs text-white/65">{p.reference}</p><p className="mt-1 text-[11px] text-white/40">{t("Through month")}: {p.through_month} · {p.actor_name}</p></article>) : <p className="py-8 text-center text-xs text-white/40">{t("No payouts recorded yet.")}</p>}</div> : null}
    <Pagination page={page} total={tab === "commissions" ? data.commission_total : tab === "referrals" ? data.referral_total : data.payout_total} change={setPage}/>
    {payout ? <PayoutDialog id={id} name={data.affiliate.name} month={month} settlement={payout} close={() => setPayout(null)} saved={() => { setPayout(null); changed(); }}/> : null}
    {voiding ? <VoidDialog affiliateId={id} commission={voiding} close={() => setVoiding(null)} saved={() => { setVoiding(null); changed(); }}/> : null}
    </> : <Skeleton className="h-80 rounded-2xl"/>}
  </Modal>;
}

function PayoutDialog({ id, name, month, settlement, close, saved }: { id: string; name: string; month: string; settlement: AffiliateDetail["settlement"]; close: () => void; saved: () => void }) {
  const { t } = useI18n(), { token } = useAdmin();
  const [reference, setReference] = useState(""), [date, setDate] = useState(localNow), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    const body = { commission_ids: settlement.ids, amount_centimes: settlement.amount_centimes, reference, paid_at: new Date(date).toISOString(), confirmed };
    const key = JSON.stringify(body); if (!request.current || request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try { await adminRequest(`affiliates/${id}/payouts?month=${month}`, token, { method: "POST", body: JSON.stringify({ ...body, request_id: request.current.id }) }); saved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record payout."); }
    finally { setBusy(false); }
  }
  return <Modal isOpen onClose={close} closeDisabled={busy} title={t("Record payout")} description={name} icon={<Wallet/>}><form onSubmit={submit} className="space-y-4"><p className="text-3xl font-bold tabular-nums text-[#edbc62]">{money(settlement.amount_centimes)}</p><p className="text-xs text-white/45">{settlement.ids.length} {t("commissions")} · {t("Through month")}: {month}</p><p className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/70">{t("Pay the affiliate outside LOYVANCE, then record it here. This action records a payment; it does not transfer money.")}</p>
    <fieldset disabled={busy} className="space-y-4"><label className="block text-xs">{t("Payout reference")}<input required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} className={field}/></label><label className="block text-xs">{t("Payment date (your local time)")}<input type="datetime-local" required value={date} onChange={e => setDate(e.target.value)} className={field}/></label><label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 accent-[#edbc62]"/>{t("I have already paid this exact amount to the affiliate.")}</label></fieldset>{error ? <p role="alert" className="text-xs text-rose-300">{t(error)}</p> : null}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={close} className={action}>{t("Cancel")}</button><button className={primary} disabled={busy || !confirmed}>{t(busy ? "Saving…" : "Confirm payout record")}</button></div></form></Modal>;
}

function VoidDialog({ affiliateId, commission, close, saved }: { affiliateId: string; commission: AffiliateCommission; close: () => void; saved: () => void }) {
  const { t } = useI18n(), { token } = useAdmin();
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await adminRequest(`affiliates/${affiliateId}/commissions/${commission.id}/void`, token, { method: "POST", body: JSON.stringify({ reason }) }); saved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to void commission."); }
    finally { setBusy(false); }
  }
  return <Modal isOpen onClose={close} closeDisabled={busy} title={t("Void commission")} description={commission.business_name} icon={<XCircle/>}><form onSubmit={submit} className="space-y-4"><p className="text-xs leading-6 text-white/60">{t("Use this for a refunded or incorrectly recorded payment. The unpaid commission is removed from the balance and its history is retained. This does not refund the business.")}</p><p className="font-semibold text-[#edbc62]">{money(commission.amount_centimes)}</p><label className="block text-xs">{t("Reason")}<textarea required maxLength={500} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} className={field}/></label>{error ? <p role="alert" className="text-xs text-rose-300">{t(error)}</p> : null}<div className="flex justify-end gap-2"><button type="button" onClick={close} disabled={busy} className={action}>{t("Cancel")}</button><button disabled={busy || !reason.trim()} className={primary}>{t(busy ? "Saving…" : "Void commission")}</button></div></form></Modal>;
}
