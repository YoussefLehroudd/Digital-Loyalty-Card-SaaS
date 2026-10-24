"use client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { storeAdminToken, type AdminUser } from "@/lib/admin";
export default function AdminLogin() {
    const { t: tr } = useI18n();
    const router = useRouter();
    const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [show, setShow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try {
        const res = await apiFetch<{
            token: string;
            user: AdminUser;
        }>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
        storeAdminToken(res.token);
        router.replace("/admin");
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    }
    finally {
        setBusy(false);
    } }
    return <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#090b0e] px-5 py-12 text-white"><div className="relative z-40 mb-4 flex justify-end"><LanguageSwitcher /></div><div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-[#edbc62]/[.06] blur-[100px]"/><div className="relative grid w-full max-w-[1000px] gap-12 lg:grid-cols-2 lg:items-center">
    <div className="hidden lg:block"><Link href="/" className="inline-flex items-center gap-3"><img src="/brand/icon.png" alt="" className="size-14 object-contain"/><span className="text-xl font-black tracking-[.15em]">LOYVANCE</span></Link><div className="mt-16 inline-flex items-center gap-2 rounded-full border border-[#edbc62]/20 bg-[#edbc62]/5 px-3 py-2 text-xs text-[#edbc62]"><ShieldCheck className="size-4"/>{tr("Platform administration")}</div><h1 className="mt-6 text-5xl font-semibold leading-[1.15] tracking-tight">{tr("Every business.")}<br /><span className="text-[#edbc62]">{tr("One clear view.")}</span></h1><p className="mt-6 max-w-sm text-sm leading-7 text-white/45">{tr("Manage your loyalty platform, follow activity as it happens, and keep every customer experience running smoothly.")}</p><p className="mt-12 text-xs text-white/25">{tr("Private workspace \u00B7 Authorized administrators only")}</p></div>
    <section className="rounded-[28px] border border-white/10 bg-[#101319] p-6 shadow-2xl sm:p-9"><div className="mb-7 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl border border-[#edbc62]/25 bg-[#edbc62]/10"><ShieldCheck className="size-6 text-[#edbc62]"/></span><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#edbc62]">{tr("LOYVANCE ADMIN")}</p><h2 className="mt-1 text-xl font-semibold">{tr("Welcome back")}</h2></div></div><p className="mb-7 text-sm leading-6 text-white/45">{tr("Sign in to your administrator workspace.")}</p>
      <form onSubmit={submit} className="space-y-5"><div><label htmlFor="admin-email" className="mb-2 block text-xs font-semibold text-white/70">{tr("Email address")}</label><div className="relative"><Mail className="absolute start-4 top-3.5 size-4 text-white/30"/><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#090b0e] ps-11 pe-4 text-sm outline-none focus:border-[#edbc62]/60" placeholder={tr("Your administrator email")}/></div></div><div><div className="mb-2 flex items-center justify-between gap-2"><label htmlFor="admin-password" className="text-xs font-semibold text-white/70">{tr("Password")}</label><Link href="/forgot-password" className="text-[11px] text-[#edbc62] hover:underline">{tr("Forgot password?")}</Link></div><div className="relative"><LockKeyhole className="absolute start-4 top-3.5 size-4 text-white/30"/><input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#090b0e] ps-11 pe-12 text-sm outline-none focus:border-[#edbc62]/60" placeholder={tr("Enter your password")}/><button type="button" aria-label={show ? tr("Hide password") : tr("Show password")} onClick={() => setShow(v => !v)} className="absolute end-2 top-1.5 grid size-9 place-items-center text-white/40">{show ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div></div>{error ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-200">{tr(error)}</p> : null}<button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#edbc62] text-sm font-bold text-[#15110a] transition hover:bg-[#f7cf89] disabled:opacity-50">{busy ? tr("Signing in…") : tr("Enter workspace")}<ArrowRight className="size-4"/></button></form><div className="mt-6 flex items-center justify-center gap-2 border-t border-white/[.07] pt-5 text-[11px] text-white/35"><ShieldCheck className="size-3.5"/>{tr("Protected administrator access")}</div><Link href="/login" className="mt-5 block text-center text-xs text-white/45 hover:text-white">{tr("Business sign in")}</Link></section>
  </div></main>;
}
