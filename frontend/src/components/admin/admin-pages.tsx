"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { AdminBusinessFeatures } from "@/components/admin/admin-business-features";
import { AdminAccountManager } from "@/components/admin/admin-account-manager";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Building2, Check, Plus, ChevronLeft, ChevronRight, CreditCard, Gift, Globe2, Eye, EyeOff, LockKeyhole, LogOut, Mail, Search, ShieldCheck, Sparkles, Stamp, Users, Wallet, X } from "lucide-react";
import { AdminRenewals } from "./admin-renewals";
import { money } from "@/lib/subscription";
import { AdminSubscription } from "@/components/admin/admin-subscription";
import { SubscriptionBadge } from "@/components/subscriptions/subscription-details";
import { AdminStatusSelect } from "@/components/admin/admin-select";
import { AdminSkeleton, useAdmin, useAdminLive } from "@/components/admin/admin-shell";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { adminRequest, type AdminActivity, type AdminCustomerDetail, type AdminDetail, type AdminEvent, type AdminList, type AdminOverview, type AdminRow, type AdminSettings } from "@/lib/admin";
const panel = "admin-panel rounded-2xl border border-white/[.08] bg-[#101319] sm:rounded-3xl";
const input = "admin-field h-11 rounded-xl border border-white/10 bg-[#0b0e12] px-4 text-sm text-white outline-none transition focus:border-[#edbc62]/50";
const number = (n: number) => new Intl.NumberFormat("en").format(n);
const date = (value: string) => new Date(value).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
function Heading({ eyebrow, title, description, action }: {
    eyebrow: string;
    title: string;
    description: string;
    action?: ReactNode;
}) { const { t: tr } = useI18n(); return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[#edbc62]">{eyebrow}</p><h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-3xl">{tr(title)}</h1><p className="mt-2 max-w-xl text-xs leading-6 text-white/45 sm:text-sm">{tr(description)}</p></div>{action}</div>; }
function ErrorBanner({ error }: {
    error: string;
}) { const { t: tr } = useI18n(); return error ? <p role="alert" className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">{tr(error)}</p> : null; }
function Status({ status }: {
    status: string;
}) { const { t: tr } = useI18n(); return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status === 'active' ? "border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300" : "border-rose-400/20 bg-rose-400/5 text-rose-300"}`}><span className={`size-1 rounded-full ${status === 'active' ? "bg-emerald-400" : "bg-rose-400"}`}/>{status === 'active' ? tr("Active") : tr("Suspended")}</span>; }
function Avatar({ name, image }: {
    name: string;
    image?: string | null;
}) { const { t: tr } = useI18n(); return <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[#edbc62]/[.07] text-xs font-bold text-[#edbc62]">{image ? <img src={image} alt="" className="size-full object-cover"/> : name.trim().slice(0, 2).toUpperCase()}</span>; }
function Metric({ label, value, note, icon: Icon }: {
    label: string;
    value: number;
    note: string;
    icon: typeof Building2;
}) { const { t: tr } = useI18n(); return <div className={`${panel} p-4 sm:p-5`}><div className="flex items-center justify-between gap-2"><span className="text-xs text-white/45">{tr(label)}</span><span className="grid size-9 place-items-center rounded-xl border border-[#edbc62]/10 bg-[#edbc62]/[.06]"><Icon className="size-[18px] text-[#edbc62]"/></span></div><p className="mt-3 break-all text-3xl font-semibold tracking-tight sm:text-[34px]">{number(value)}</p><p className="mt-2 text-[10px] leading-5 text-white/35">{note}</p></div>; }
function Pagination({ page, total, onPage }: {
    page: number;
    total: number;
    onPage: (page: number) => void;
}) { const { t: tr } = useI18n(); const pages = Math.max(1, Math.ceil(total / 25)); return <div className="flex items-center justify-between gap-3 border-t border-white/[.07] px-4 py-4 sm:px-6"><p className="text-[11px] text-white/40">{number(total)}{tr(" results \u00B7 Page ")}{page}{tr(" of ")}{pages}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={tr("Previous page")} className="grid size-8 place-items-center rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-25"><ChevronLeft className="size-4"/></button><button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={tr("Next page")} className="grid size-8 place-items-center rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-25"><ChevronRight className="size-4"/></button></div></div>; }
function Empty({ title, description }: {
    title: string;
    description: string;
}) { const { t: tr } = useI18n(); return <div className="px-5 py-16 text-center"><Search className="mx-auto mb-4 size-7 text-white/20"/><p className="text-sm font-semibold">{tr(title)}</p><p className="mt-2 text-xs text-white/40">{tr(description)}</p></div>; }
export function AdminOverviewPage() {
    const { t: tr } = useI18n();
    const { user } = useAdmin();
    const { data, error } = useAdminLive<AdminOverview>("overview");
    if (!data)
        return <><ErrorBanner error={error}/><AdminSkeleton /></>;
    const { stats, trend, businesses } = data.data, max = Math.max(1, ...trend.map(d => d.stamps));
    return <><Heading eyebrow="Platform overview" title={tr("Welcome back, {0}.", { "0": user.name.split(' ')[0] })} description={tr("A clear view of your businesses, customers, and loyalty activity.")} action={<Link href="/admin/businesses" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold hover:bg-white/5">{tr("Manage businesses")}<ArrowUpRight className="size-4"/></Link>}/><ErrorBanner error={error}/>
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4"><Metric label={tr("Businesses")} value={stats.businesses} note={`${number(stats.active_businesses)} active loyalty programs`} icon={Building2}/><Metric label={tr("Customers")} value={stats.customers} note={`${number(stats.cards)} connected loyalty cards`} icon={Users}/><Metric label={tr("Stamps collected")} value={stats.stamps} note={`${number(stats.stamps_today)} collected today`} icon={Stamp}/><Metric label={tr("Rewards redeemed")} value={stats.redeemed} note={`${number(stats.ready_rewards)} rewards ready to redeem`} icon={Gift}/></div>
    {data.data.subscriptions ? <section className="mb-6"><div className="mb-3"><h2 className="text-sm font-semibold">{tr("Subscriptions & recorded payments")}</h2><p className="mt-1 text-xs text-white/40">{tr("Receipts confirmed by administrators; plan prices and free activations are excluded.")}</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[{ label: "Received this month", value: money(Number(data.data.subscriptions.payments_month_centimes)), note: "Morocco calendar month" }, { label: "Subscribed businesses", value: String(data.data.subscriptions.subscribed), note: "Activated access periods" }, { label: "Ending within 3 days", value: String(data.data.subscriptions.ending_soon), note: "Trials and paid periods" }, { label: "Pending renewals", value: String(data.data.subscriptions.pending_requests), note: "Awaiting payment review" }].map(m => <div key={m.label} className={`${panel} p-4`}><p className="text-xs text-white/45">{tr(m.label)}</p><p className="mt-3 break-words text-2xl font-semibold text-[#edbc62]">{m.value}</p><p className="mt-2 text-[10px] text-white/35">{m.note}</p></div>)}</div></section> : null}
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]"><section className={`${panel} p-5 sm:p-6`}><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{tr("Loyalty activity")}</h2><p className="mt-1 text-xs text-white/40">{tr("Stamps collected over the last 14 days")}</p></div><span className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/55">{tr("14 days")}</span></div><div role="img" aria-label={trend.map(d => `${d.date}: ${d.stamps} stamps, ${d.rewards} rewards`).join('; ')} className="mt-7 flex h-48 items-end gap-1.5 border-b border-white/10 sm:gap-3">{trend.map(d => <div key={d.date} className="group relative flex h-full flex-1 items-end"><div title={tr("{0}: {1} stamps", { "0": date(d.date), "1": d.stamps })} style={{ height: `${Math.max(2, (d.stamps / max) * 100)}%` }} className="w-full rounded-t-md bg-gradient-to-t from-[#ab792b] to-[#edbc62] transition-[height] duration-500 motion-reduce:transition-none group-hover:brightness-125"/><span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#171b21] px-2 py-1 text-[10px] group-hover:block">{number(d.stamps)}{tr(" stamps")}</span></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-white/30"><span>{date(trend[0].date)}</span><span>{date(trend[trend.length - 1].date)}</span></div><div className="mt-6 flex items-center gap-2 text-xs text-white/45"><span className="size-2 rounded-full bg-[#edbc62]"/>{tr("Actual platform activity")}</div></section>
      <section className={`${panel} p-5 sm:p-6`}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold">{tr("Leading businesses")}</h2><p className="mt-1 text-xs text-white/40">{tr("By connected loyalty cards")}</p></div><Building2 className="size-5 text-white/20"/></div><div className="space-y-4">{businesses.length ? businesses.map((b, i) => <div key={b.id} className="flex items-center gap-3"><span className="w-3 text-[10px] text-white/25">{i + 1}</span><Avatar name={b.name} image={b.logo_url}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{b.name}</p><p className="mt-1 text-[10px] text-white/35">{number(b.cards)}{tr(" loyalty cards")}</p></div><Status status={b.status}/></div>) : <Empty title={tr("Your first business starts here")} description={tr("Registered businesses will appear automatically.")}/>}</div><Link href="/admin/businesses" className="mt-6 flex items-center justify-between border-t border-white/[.07] pt-4 text-xs font-semibold text-[#edbc62]">{tr("View all businesses")}<ArrowRight className="size-4"/></Link></section></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">{[{ title: "Business directory", description: "Manage loyalty programs and account access.", href: "/admin/businesses", icon: Building2 }, { title: "Customer directory", description: "Find customers and their connected cards.", href: "/admin/customers", icon: Users }, { title: "Platform activity", description: "Follow stamps, rewards, and administrator actions.", href: "/admin/activity", icon: Activity }].map(item => <Link key={item.href} href={item.href} className={`${panel} group flex gap-4 p-5 transition hover:border-[#edbc62]/25`}><item.icon className="mt-0.5 size-5 shrink-0 text-[#edbc62]"/><div><p className="text-xs font-semibold">{tr(item.title)}</p><p className="mt-2 text-[11px] leading-5 text-white/40">{tr(item.description)}</p></div><ArrowUpRight className="ms-auto size-4 shrink-0 text-white/25 group-hover:text-[#edbc62]"/></Link>)}</div>
  </>;
}
export function AdminDirectoryPage({ kind }: {
    kind: "businesses" | "customers";
}) {
    const { t: tr } = useI18n();
    const { token } = useAdmin();
    const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [subscriptionFilter, setSubscriptionFilter] = useState("");
    const [featureBusiness, setFeatureBusiness] = useState<AdminRow | null>(null);
    const [subscriptionBusiness, setSubscriptionBusiness] = useState<AdminRow | null>(null);
    const [accountMode, setAccountMode] = useState<"create"|"edit"|"delete"|null>(null);
    const [accountTarget, setAccountTarget] = useState<AdminRow|AdminDetail|AdminCustomerDetail|null>(null);
    const [selected, setSelected] = useState<AdminRow | null>(null), [target, setTarget] = useState<AdminRow | null>(null), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [actionError, setActionError] = useState("");
    useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
    const endpoint = `${kind}?q=${encodeURIComponent(query)}&status=${status}&subscription=${kind === 'businesses' ? subscriptionFilter : ''}&page=${page}`;
    const { data, error, refresh } = useAdminLive<AdminList>(endpoint);
    const { data: detail, error: detailError } = useAdminLive<{
        data: AdminDetail | AdminCustomerDetail;
    }>(selected ? `${kind}/${selected.id}` : null);
    const isBusiness = kind === 'businesses';
    async function save(event: FormEvent) {
        event.preventDefault();
        if (!target)
            return;
        setBusy(true);
        setActionError("");
        try {
            const result = await adminRequest<{
                message: string;
            }>(`${kind}/${target.id}`, token, { method: "PATCH", body: JSON.stringify({ status: target.status === 'active' ? 'suspended' : 'active', reason }) });
            setMessage(result.message);
            setTarget(null);
            setSelected(null);
            refresh();
        }
        catch (cause) {
            setActionError(cause instanceof Error ? cause.message : "Unable to update account.");
        }
        finally {
            setBusy(false);
        }
    }
    function manage(row: AdminRow) { setTarget(row); setReason(""); setActionError(""); }
    async function openEdit(row:AdminRow){
      try { const result=await adminRequest<{data:AdminDetail|AdminCustomerDetail}>(`${kind}/${row.id}`,token);setAccountTarget(result.data);setSelected(null);setAccountMode("edit");setActionError(""); }
      catch(e){setActionError(e instanceof Error?e.message:"Unable to load account details.");}
    }
    function openDelete(row:AdminRow){setAccountTarget(row);setSelected(null);setAccountMode("delete");}
    function accountSaved(result:string){setMessage(result);setSelected(null);refresh();}
    const rowActions = (row: AdminRow, mobile = false) => {
        const actionClass = mobile ? "flex min-h-10 min-w-0 w-full items-center justify-center rounded-xl px-2 py-2.5 text-center text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62]/50" : "rounded-lg px-3 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62]/50";
        return <div className={mobile ? "grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-4" : "flex shrink-0 flex-wrap items-center gap-2"}>
            {isBusiness ? <button type="button" aria-label={tr("Options for {0}", { "0": row.name })} onClick={() => setFeatureBusiness(row)} className={`${actionClass} border border-[#edbc62]/20 bg-[#edbc62]/5 text-[#edbc62] hover:bg-[#edbc62]/10`}>{tr("Options")}</button> : null}
            {isBusiness ? <button type="button" aria-label={tr("Subscription for {0}", { "0": row.name })} onClick={() => setSubscriptionBusiness(row)} className={`${actionClass} border border-[#edbc62]/20 bg-[#edbc62]/5 text-[#edbc62] hover:bg-[#edbc62]/10`}>{tr("Subscription")}</button> : null}
            <button type="button" aria-label={tr("View {0}", { "0": row.name })} onClick={() => setSelected(row)} className={`${actionClass} border border-white/10 text-white hover:bg-white/5`}>{tr("Details")}</button>
            <button type="button" onClick={()=>void openEdit(row)} aria-label={tr("Edit {0}",{"0":row.name})} className={`${actionClass} border border-[#edbc62]/20 bg-[#edbc62]/5 text-[#edbc62] hover:bg-[#edbc62]/10`}>{tr("Edit")}</button>
            <button type="button" aria-label={tr("{0} {1}", { "0": row.status === 'active' ? 'Suspend' : 'Activate', "1": row.name })} onClick={() => manage(row)} className={`${actionClass} ${row.status === 'active' ? 'bg-rose-400/[.07] text-rose-300 hover:bg-rose-400/15' : 'bg-emerald-400/[.07] text-emerald-300 hover:bg-emerald-400/15'}`}>{row.status === 'active' ? tr('Suspend') : tr('Activate')}</button>
            <button type="button" aria-label={tr("Delete {0}",{"0":row.name})} onClick={()=>openDelete(row)} className={`${actionClass} border border-rose-500/20 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15`}>{tr("Delete")}</button>
        </div>;
    };
    return <><AdminBusinessFeatures business={featureBusiness} token={token} onClose={() => setFeatureBusiness(null)}/><Heading eyebrow="Platform directory" title={isBusiness ? tr("Every business, connected.") : tr("Your customer community.")} description={isBusiness ? tr("Manage business accounts, loyalty programs, and platform access.") : tr("Find customers, explore their loyalty cards, and manage account access.")} action={<div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>{setAccountTarget(null);setAccountMode("create");}} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#edbc62]/35 bg-[#edbc62]/10 px-4 text-xs font-bold text-[#edbc62] hover:bg-[#edbc62]/20"><Plus className="size-4"/> {isBusiness?tr("Create business"):tr("Create customer")}</button>{data?<span className="rounded-full border border-white/10 bg-white/[.025] px-3 py-2 text-xs text-white/60">{number(data.total)} {kind}</span>:null}</div>}/><ErrorBanner error={error}/><ErrorBanner error={actionError}/>{message ? <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300"><Check className="size-4"/>{tr(message)}<button onClick={() => setMessage("")} className="ms-auto" aria-label={tr("Dismiss message")}><X className="size-4"/></button></div> : null}
    {isBusiness ? <AdminRenewals /> : null}
    <section className={panel}><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:p-5"><div className="relative min-w-0 flex-1"><Search className="absolute start-3.5 top-3.5 size-4 text-white/30"/><input value={search} onChange={e => setSearch(e.target.value)} aria-label={tr("Search {0}", { "0": kind })} placeholder={tr("Search {0} by name or email\u2026", { "0": isBusiness ? 'businesses' : 'customers' })} className={`${input} w-full ps-10`}/></div><AdminStatusSelect value={status} onChange={value => { setStatus(value); setPage(1); }}/>{isBusiness ? <AdminStatusSelect variant="subscription" value={subscriptionFilter} onChange={value => { setSubscriptionFilter(value); setPage(1); }}/> : null}</div>
      {!data ? <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl"/>)}</div> : data.data.length ? <><div className="hidden overflow-x-auto lg:block"><table className="w-full text-start text-xs"><thead className="border-b border-white/[.05] text-[10px] uppercase tracking-wider text-white/35"><tr><th className="px-6 py-4 font-medium">{isBusiness ? tr('Business') : tr('Customer')}</th><th className="px-4 py-4 font-medium">{tr("Status")}</th><th className="px-4 py-4 font-medium">{tr("Cards")}</th>{isBusiness ? <th className="px-4 py-4 font-medium">{tr("Stamps")}</th> : null}<th className="px-4 py-4 font-medium">{tr("Joined")}</th><th className="px-6 py-4 text-end font-medium">{tr("Actions")}</th></tr></thead><tbody>{data.data.map(row => <tr key={row.id} className="border-b border-white/[.035] last:border-0 hover:bg-white/[.015]"><td className="px-6 py-4"><div className="flex items-center gap-3"><Avatar name={row.name} image={row.logo_url || row.avatar_url}/><div className="min-w-0"><p className="max-w-64 truncate font-semibold">{row.name}</p><p className="mt-1 max-w-64 truncate text-[11px] text-white/40">{row.email || tr('Contact details private')}</p></div></div></td><td className="px-4 py-4"><Status status={row.status}/>{row.subscription ? <div className="mt-2"><SubscriptionBadge subscription={row.subscription}/></div> : null}</td><td className="px-4 py-4 font-medium">{number(row.cards)}</td>{isBusiness ? <td className="px-4 py-4 text-white/60">{number(row.stamps || 0)}</td> : null}<td className="whitespace-nowrap px-4 py-4 text-white/40">{date(row.created_at)}</td><td className="px-6 py-4"><div className="flex justify-end">{rowActions(row)}</div></td></tr>)}</tbody></table></div><div className="min-w-0 divide-y divide-white/[.06] lg:hidden">{data.data.map(row => <article key={row.id} className="min-w-0 overflow-hidden p-4">
                <div className="flex min-w-0 items-start gap-3"><Avatar name={row.name} image={row.logo_url || row.avatar_url}/>
                  <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold">{row.name}</p><p className="mt-1 break-all text-[11px] text-white/40">{row.email || tr('Contact details private')}</p></div>
                  <div className="flex shrink-0 flex-col items-end gap-2"><Status status={row.status}/>{row.subscription ? <SubscriptionBadge subscription={row.subscription}/> : null}</div>
                </div>
                <p className="mt-3 text-[10px] text-white/40">{number(row.cards)}{tr(" cards")}{isBusiness ? tr(" \u00B7 {0} stamps", { "0": number(row.stamps || 0) }) : ''}</p>
                <div className="mt-3 min-w-0">{rowActions(row,true)}</div>
              </article>)}</div></> : <Empty title={tr("No {0} found", { "0": kind })} description={tr("Try another name, email address, or status.")}/>}
      {data ? <Pagination page={page} total={data.total} onPage={setPage}/> : null}
    </section>
    {subscriptionBusiness ? <AdminSubscription business={subscriptionBusiness} onClose={() => setSubscriptionBusiness(null)} onSaved={refresh}/> : null}
    <AdminAccountManager kind={kind} mode={accountMode} target={accountTarget} onClose={()=>{setAccountMode(null);setAccountTarget(null);}} onSaved={accountSaved}/>
    <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name} description={detail?.data.email || undefined} icon={isBusiness ? <Building2 className="size-6"/> : <Users className="size-6"/>}><ErrorBanner error={detailError}/>{detail ? <div className="space-y-5"><div className="flex items-center justify-between"><Status status={detail.data.status}/><span className="text-xs text-white/40">{tr("Joined ")}{date(detail.data.created_at)}</span></div><dl className="grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/[.025] p-4">{[['Email', detail.data.email || 'Contact details private'], ['Phone', detail.data.contact_details_visible === false ? 'Contact details private' : detail.data.phone || 'Not provided'], ...(isBusiness ? [['Owner login', ('owner_email' in detail.data ? detail.data.owner_email : null) || 'Not available'],['Owner name', ('owner_name' in detail.data ? detail.data.owner_name : null) || 'Not available'],['Address',detail.data.address||'Not provided'],['Reward', detail.data.reward_name || 'Not configured'], ['Required stamps', String(detail.data.required_stamps || 0)], ['Stamps collected', number(detail.data.stamps || 0)], ['Rewards redeemed', number(detail.data.redeemed || 0)]] : [])].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] text-white/40">{tr(label)}</dt><dd className="mt-1 break-words text-xs font-medium">{value}</dd></div>)}</dl>{!isBusiness && Array.isArray(detail.data.cards) ? <div><h3 className="mb-3 text-xs font-semibold">{tr("Connected loyalty cards")}</h3>{detail.data.cards.length ? detail.data.cards.map(card => <div key={card.id} className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><p className="text-xs font-semibold">{card.business_name}</p><p className="mt-1 text-[10px] text-white/40">{card.reward_name}</p></div><span className="text-xs font-semibold text-[#edbc62]">{card.current_stamps || 0}/{card.required_stamps || 0}</span></div>) : <p className="text-xs text-white/40">{tr("No cards connected yet.")}</p>}</div> : null}{isBusiness && detail.data.slug ? <Link href={`/business/${detail.data.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-[#edbc62]">{tr("Open public loyalty page")}<ArrowUpRight className="size-4"/></Link> : null}<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>{tr("Close")}</Button><Button variant="outline" onClick={()=>selected&&void openEdit(selected)}>{tr("Edit")}</Button><Button variant="outline" onClick={()=>selected&&openDelete(selected)} className="border-rose-500/20 text-rose-300">{tr("Delete")}</Button><Button onClick={() => selected && manage(selected)}>{tr("Manage access")}</Button></div></div> : <Skeleton className="h-56 rounded-xl"/>}</Modal>
    <Modal isOpen={!!target} onClose={() => setTarget(null)} closeDisabled={busy} title={target?.status === 'active' ? tr('Suspend account') : tr('Activate account')} description={target?.name} icon={<ShieldCheck className="size-6"/>}><form onSubmit={save} className="space-y-5"><p className="text-sm leading-6 text-white/55">{target?.status === 'active' ? (isBusiness ? 'This business will lose access to its dashboard, scanning, and new customer registrations. Existing loyalty data will be preserved.' : 'This customer will be signed out and unable to sign in. Their loyalty cards and history will be preserved.') : tr('Restore access to this account. The account owner can sign in again.')}</p><div><label htmlFor="admin-reason" className="mb-2 block text-xs font-semibold">{tr("Reason ")}{target?.status === 'active' ? tr('(required)') : tr('(optional)')}</label><textarea id="admin-reason" required={target?.status === 'active'} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={`${input} h-24 w-full py-3`} placeholder={tr("Add context for the administrator audit log")}/></div>{actionError ? <p role="alert" className="text-xs text-rose-300">{tr(actionError)}</p> : null}<div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => setTarget(null)}>{tr("Cancel")}</Button><Button type="submit" disabled={busy}>{busy ? tr('Saving…') : target?.status === 'active' ? tr('Confirm suspension') : tr('Activate account')}</Button></div></form></Modal>
  </>;
}
function EventIcon({ type }: {
    type: AdminEvent['type'];
}) { const { t: tr } = useI18n(); const Icon = type === 'stamp' ? Stamp : type === 'reward' ? Gift : ShieldCheck; return <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${type === 'stamp' ? 'border-sky-400/15 bg-sky-400/[.06] text-sky-300' : type === 'reward' ? 'border-[#edbc62]/20 bg-[#edbc62]/[.07] text-[#edbc62]' : 'border-violet-400/15 bg-violet-400/[.06] text-violet-300'}`}><Icon className="size-[18px]"/></span>; }
export function AdminActivityPage() {
    const { t: tr } = useI18n();
    const [kind, setKind] = useState(""), [page, setPage] = useState(1);
    const { data, error } = useAdminLive<AdminActivity>(`activity?kind=${kind}&page=${page}`);
    return <><Heading eyebrow="Live platform feed" title={tr("Everything happening, in view.")} description={tr("Follow loyalty activity and administrator actions across the platform.")}/><ErrorBanner error={error}/><section className={panel}><div className="flex gap-2 overflow-x-auto border-b border-white/[.07] p-4 sm:p-5">{[['', 'All activity'], ['stamp', 'Stamps'], ['reward', 'Rewards'], ['admin', 'Admin actions']].map(([value, label]) => <button key={value} onClick={() => { setKind(value); setPage(1); }} aria-pressed={kind === value} className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold ${kind === value ? 'bg-[#edbc62] text-black' : 'border border-white/10 text-white/50 hover:bg-white/5'}`}>{tr(label)}</button>)}</div>{!data ? <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl"/>)}</div> : data.data.length ? <div className="divide-y divide-white/[.05]">{data.data.map(event => <article key={event.id} className="flex items-start gap-3 p-4 sm:gap-4 sm:px-6"><EventIcon type={event.type}/><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-1"><p className="text-xs font-semibold">{tr(event.title)}</p><time dateTime={event.date} className="text-[10px] text-white/30">{new Date(event.date).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div><p className="mt-1.5 break-words text-[11px] text-white/45">{event.name || tr('Customer')} <span className="mx-1 text-white/20">/</span> {event.business_name}</p>{event.reason ? <p className="mt-2 rounded-lg bg-white/[.025] p-2 text-[11px] leading-5 text-white/50">{event.reason}</p> : null}</div></article>)}</div> : <Empty title={tr("No activity here yet")} description={tr("New stamps, rewards, and account changes will appear automatically.")}/>}{data ? <Pagination page={page} total={data.total} onPage={setPage}/> : null}</section></>;
}

function AdminSettingsPasswordInput({ id, label, value, onChange, autoComplete, minLength, disabled }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: "current-password" | "new-password";
    minLength?: number;
    disabled?: boolean;
}) {
    const [visible, setVisible] = useState(false);
    useEffect(() => { if (!value) setVisible(false); }, [value]);
    return <div className="relative">
        <input
            id={id}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            minLength={minLength}
            required
            disabled={disabled}
            value={value}
            onChange={event => onChange(event.target.value)}
            className={`${input} w-full pe-14`}
        />
        <button
            type="button"
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            title={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible(previous => !previous)}
            disabled={disabled}
            className="absolute inset-y-0 end-1.5 grid w-11 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-[#edbc62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edbc62] disabled:opacity-40"
        >
            {visible ? <EyeOff className="size-4" aria-hidden="true"/> : <Eye className="size-4" aria-hidden="true"/>}
        </button>
    </div>;
}

export function AdminSettingsPage() {
    const { t: tr } = useI18n();
    const { token, logout } = useAdmin();
    const { data, error } = useAdminLive<AdminSettings>("settings");
    const [current, setCurrent] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saveError, setSaveError] = useState("");
    async function save(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setSaveError("");
        try {
            await adminRequest("password", token, { method: "PUT", body: JSON.stringify({ current_password: current, password, password_confirmation: confirm }) });
            setCurrent("");
            setPassword("");
            setConfirm("");
            setMessage("Password updated successfully.");
        }
        catch (cause) {
            setSaveError(cause instanceof Error ? cause.message : "Unable to update password.");
        }
        finally {
            setBusy(false);
        }
    }
    if (!data)
        return <><ErrorBanner error={error}/><AdminSkeleton /></>;
    const integrations = [{ key: 'google_wallet', label: 'Google Wallet', description: 'Digital loyalty passes', icon: Wallet }, { key: 'apple_wallet', label: 'Apple Wallet', description: 'Pass signing and device updates', icon: CreditCard }, { key: 'email', label: 'Transactional email', description: 'Verification and account recovery', icon: Mail }, { key: 'images', label: 'Image storage', description: 'Business branding and profile photos', icon: Globe2 }] as const;
    return <><Heading eyebrow="Workspace settings" title={tr("Your account. Your platform.")} description={tr("Manage administrator security and see which platform integrations are configured.")}/><ErrorBanner error={error}/><div className="grid gap-5 xl:grid-cols-2"><section className={`${panel} p-5 sm:p-6`}><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#edbc62]/10 text-lg font-semibold text-[#edbc62]">{data.data.account.name.slice(0, 2).toUpperCase()}</span><div><h2 className="text-sm font-semibold">{data.data.account.name}</h2><p className="mt-1 break-all text-xs text-white/40">{data.data.account.email}</p></div></div><div className="mt-6 flex items-center gap-2 rounded-xl border border-[#edbc62]/20 bg-[#edbc62]/5 p-3 text-xs text-[#edbc62]"><ShieldCheck className="size-4"/>{tr("Super administrator")}</div><div className="mt-5 space-y-3 text-xs text-white/45"><p>{tr("Access is verified by the server on every request.")}</p><p>{tr("Account status changes are recorded in the administrator audit log.")}</p><p>{tr("Live data refreshes every ")}{data.data.refresh_seconds}{tr(" seconds while this workspace is visible.")}</p></div><button onClick={() => void logout()} className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-white/60 hover:bg-white/5"><LogOut className="size-4"/>{tr("Sign out of administration")}</button></section>
    <section className={`${panel} p-5 sm:p-6`}><h2 className="text-sm font-semibold">{tr("Platform integrations")}</h2><p className="mt-1 text-xs text-white/40">{tr("Configuration status from the server")}</p><div className="mt-6 divide-y divide-white/[.06]">{integrations.map(item => <div key={item.key} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"><item.icon className="size-5 shrink-0 text-[#edbc62]"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{tr(item.label)}</p><p className="mt-1 text-[10px] text-white/40">{tr(item.description)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] ${data.data.integrations[item.key] ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-white/40'}`}>{data.data.integrations[item.key] ? tr('Configured') : tr('Not configured')}</span></div>)}</div></section>
    <section className={`${panel} p-5 sm:p-6 xl:col-span-2`}><div className="mb-6 flex items-center gap-3"><LockKeyhole className="size-5 text-[#edbc62]"/><div><h2 className="text-sm font-semibold">{tr("Password & security")}</h2><p className="mt-1 text-xs text-white/40">{tr("Keep your administrator account secure.")}</p></div></div><form onSubmit={save}><div className="grid gap-4 md:grid-cols-3"><div><div className="mb-2 flex flex-wrap justify-between gap-2"><label htmlFor="admin-current-password" className="text-xs text-white/60">{tr("Current password")}</label><Link href="/forgot-password" className="text-[11px] text-[#edbc62]">{tr("Forgot password?")}</Link></div><AdminSettingsPasswordInput id="admin-current-password" label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} disabled={busy}/></div><div><label htmlFor="admin-new-password" className="mb-2 block text-xs text-white/60">{tr("New password")}</label><AdminSettingsPasswordInput id="admin-new-password" label="New password" autoComplete="new-password" minLength={10} value={password} onChange={setPassword} disabled={busy}/></div><div><label htmlFor="admin-confirm-password" className="mb-2 block text-xs text-white/60">{tr("Confirm new password")}</label><AdminSettingsPasswordInput id="admin-confirm-password" label="Confirm new password" autoComplete="new-password" minLength={10} value={confirm} onChange={setConfirm} disabled={busy}/></div></div><p className="mt-3 text-[10px] text-white/35">{tr("Use at least 10 characters. This updates the password for your account across LOYVANCE.")}</p>{message ? <p role="status" className="mt-3 text-xs text-emerald-300">{tr(message)}</p> : null}{saveError ? <p role="alert" className="mt-3 text-xs text-rose-300">{tr(saveError)}</p> : null}<div className="mt-5 flex justify-end"><button disabled={busy} className="rounded-xl bg-[#edbc62] px-5 py-3 text-xs font-bold text-black disabled:opacity-50">{busy ? tr('Updating…') : tr('Update password')}</button></div></form></section></div></>;
}
