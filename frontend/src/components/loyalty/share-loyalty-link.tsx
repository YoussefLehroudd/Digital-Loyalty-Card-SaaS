"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useState } from "react";
import { Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ShareLoyaltyLink({ businessId, name }: {
    businessId?: string;
    name?: string;
}) {
    const { t: tr } = useI18n();
    const [feedback, setFeedback] = useState("");
    const link = () => `${window.location.origin}/user/join?auto_business_id=${encodeURIComponent(businessId ?? "")}`;
    async function copy() {
        try {
            await navigator.clipboard.writeText(link());
            setFeedback("Link copied. Send it to your customer.");
        }
        catch {
            setFeedback("Copy the link from the field below.");
        }
    }
    async function share() {
        if (!navigator.share)
            return copy();
        try {
            await navigator.share({ title: `${name ?? "Our"} loyalty card`, text: "Join our loyalty program and collect rewards.", url: link() });
        }
        catch (error) {
            if (!(error instanceof Error && error.name === "AbortError"))
                await copy();
        }
    }
    return <section className="rounded-2xl border border-[#e7b354]/25 bg-black/25 p-4 sm:p-5">
    <h2 className="flex items-center gap-2 font-semibold"><Link2 className="size-4 text-[#ffd369]"/>{tr("Customer invitation link")}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{tr("Send this link on WhatsApp or Instagram. Customers sign in or create an account to add your card without scanning a QR.")}</p>
    <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={!businessId} onClick={() => void copy()}><Copy className="size-4"/>{tr("Copy invitation link")}</Button><Button variant="outline" disabled={!businessId} onClick={() => void share()}><Share2 className="size-4"/>{tr("Share link")}</Button></div>
    {feedback ? <><p role="status" className="mt-3 text-xs text-[#ffd369]">{feedback}</p><input aria-label={tr("Customer invitation link")} readOnly value={link()} onFocus={e => e.target.select()} className="mt-2 w-full min-w-0 rounded-lg border border-white/10 bg-black/30 p-2 text-xs"/></> : null}
  </section>;
}
