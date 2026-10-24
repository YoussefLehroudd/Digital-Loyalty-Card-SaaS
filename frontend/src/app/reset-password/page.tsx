"use client";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/language-provider";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { resetPassword } from "@/lib/auth";
function ResetPasswordForm() {
    const { t: tr } = useI18n();
    const params = useSearchParams();
    const token = params.get("token") ?? "";
    const email = params.get("email") ?? "";
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const validLink = useMemo(() => Boolean(token && email), [token, email]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        if (password.length < 10)
            return setError("Use a password of at least 10 characters.");
        if (password !== confirmation)
            return setError("Passwords do not match.");
        setBusy(true);
        try {
            await resetPassword({ token, email, password, password_confirmation: confirmation });
            setDone(true);
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "This reset link is invalid or expired.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10"><div className="fixed end-4 top-4 z-50"><LanguageSwitcher /></div>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-xl">
        <div className="bg-neutral-950 px-7 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10"><ShieldCheck className="size-5"/></div>
            <div><div className="text-lg font-bold tracking-wide">LOYVANCE</div><div className="text-xs text-white/60">{tr("Secure account recovery")}</div></div>
          </div>
        </div>
        <div className="p-7">
          {done ? (<div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 size-12"/>
              <h1 className="text-2xl font-semibold">{tr("Password updated")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{tr("Your password has been changed securely. You can now sign in with your new password.")}</p>
              <Link href="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground">{tr("Back to sign in")}</Link>
            </div>) : !validLink ? (<div className="text-center">
              <KeyRound className="mx-auto mb-4 size-11 text-muted-foreground"/>
              <h1 className="text-xl font-semibold">{tr("Invalid reset link")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{tr("Request a new password reset link from your LOYVANCE account.")}</p>
              <Link href="/login" className="mt-6 inline-flex text-sm font-medium underline underline-offset-4">{tr("Back to sign in")}</Link>
            </div>) : (<>
              <h1 className="text-2xl font-semibold">{tr("Create a new password")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{tr("Resetting password for ")}<span className="font-medium text-foreground">{email}</span>{tr(". This secure link expires after 30 minutes.")}</p>
              <form className="mt-7 space-y-5" onSubmit={submit}>
                <label className="block text-sm font-medium">{tr("New password ")}<div className="relative mt-2"><input className="h-11 w-full rounded-lg border bg-background px-3 pe-11 outline-none focus:ring-2 focus:ring-ring" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required/><button type="button" aria-label={tr("Toggle password visibility")} onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 end-0 px-3 text-muted-foreground">{showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div>
                </label>
                <label className="block text-sm font-medium">{tr("Confirm new password ")}<div className="relative mt-2"><input className="h-11 w-full rounded-lg border bg-background px-3 pe-11 outline-none focus:ring-2 focus:ring-ring" type={showConfirmation ? "text" : "password"} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" minLength={10} required/><button type="button" aria-label={tr("Toggle password visibility")} onClick={() => setShowConfirmation((v) => !v)} className="absolute inset-y-0 end-0 px-3 text-muted-foreground">{showConfirmation ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div>
                </label>
                {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{tr(error)}</div> : null}
                <button disabled={busy} className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" type="submit">{busy ? <><Loader2 className="me-2 size-4 animate-spin"/>{tr("Updating password...")}</> : tr("Update password")}</button>
              </form>
            </>)}
        </div>
      </div>
    </main>);
}
export default function ResetPasswordPage() {
    const { t: tr } = useI18n();
    return <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><div className="fixed end-4 top-4 z-50"><LanguageSwitcher /></div><Loader2 className="size-6 animate-spin"/></main>}><ResetPasswordForm /></Suspense>;
}
