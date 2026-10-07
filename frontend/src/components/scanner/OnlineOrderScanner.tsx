"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StampOptions, defaultStampSelection, type ScanPreview } from "@/components/scanner/stamp-options";
import { apiFetch } from "@/lib/api";

type Preview = ScanPreview;
type Result = { loyalty: { current_stamps: number; required_stamps: number; reward_unlocked: boolean; reward_redeemed?: boolean } };

export function OnlineOrderScanner({ token }: { token: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const [selection, setSelection] = useState(defaultStampSelection);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Array<{id: string; name: string; email: string | null; phone: string | null}>>([]);
  const [searched, setSearched] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  useEffect(() => () => { generation.current++; }, []);

  async function searchCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || !token) return;
    const session = ++generation.current;
    busyRef.current = true; setBusy(true); setError(null); setMessage(null); setPreview(null); setQr(null); setCustomerId(null); setCompleted(false); setMatches([]); setSearched(false); setReference(""); setSelection(defaultStampSelection());
    try {
      const result = await apiFetch<{data: typeof matches}>("/order-customers", { method: "POST", token, body: JSON.stringify({ query: query.trim() }) });
      if (session === generation.current) { setMatches(result.data); setSearched(true); }
    } catch (err) { if (session === generation.current) setError(err instanceof Error ? err.message : "Could not find this customer."); }
    finally { busyRef.current = false; if (session === generation.current) setBusy(false); }
  }

  async function selectCustomer(id: string) {
    if (busyRef.current || !token) return;
    const session = ++generation.current;
    busyRef.current = true; setBusy(true); setError(null); setMessage(null); setPreview(null); setQr(null); setCustomerId(null); setCompleted(false); setReference(""); setSelection(defaultStampSelection());
    try {
      const data = await apiFetch<Preview>("/scan-preview", { method: "POST", token, body: JSON.stringify({ customer_id: id }) });
      if (session === generation.current) { setCustomerId(id); setPreview(data); }
    } catch (err) { if (session === generation.current) setError(err instanceof Error ? err.message : "Could not load this customer."); }
    finally { busyRef.current = false; if (session === generation.current) setBusy(false); }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busyRef.current) return;
    const session = ++generation.current;
    setQr(null); setCustomerId(null); setMatches([]); setSearched(false); setPreview(null); setReference(""); setSelection(defaultStampSelection()); setMessage(null); setCompleted(false); setError(null);
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose a PNG, JPG or WebP image smaller than 10 MB."); return;
    }
    busyRef.current = true; setBusy(true);
    const url = URL.createObjectURL(file);
    let reader: import("@zxing/library").BrowserQRCodeReader | undefined;
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("This image cannot be opened. Try a PNG or JPG screenshot.")); image.src = url; });
      if (image.naturalWidth * image.naturalHeight > 20000000) throw new Error("This image is too large. Crop the screenshot around the QR code.");
      const { BrowserQRCodeReader } = await import("@zxing/library");
      reader = new BrowserQRCodeReader();
      let value: string;
      try { value = (await reader.decodeFromImageElement(image)).getText().trim(); }
      catch { throw new Error("No readable QR found. Choose a clear screenshot of the customer's loyalty card."); }
      if (session !== generation.current) return;
      const data = await apiFetch<Preview>("/scan-preview", { method: "POST", token: token ?? undefined, body: JSON.stringify({ qr_code: value }) });
      if (session !== generation.current) return;
      setQr(value); setPreview(data);
    } catch (err) {
      if (session === generation.current) setError(err instanceof Error ? err.message : "Could not read this QR image.");
    } finally {
      reader?.reset(); URL.revokeObjectURL(url);
      busyRef.current = false;
      if (session === generation.current) setBusy(false);
    }
  }

  async function confirm(action: "stamp" | "redeem-reward") {
    if ((!qr && !customerId) || !preview || busyRef.current || completed) return;
    if (action === "stamp" && !reference.trim()) { setError("Enter the confirmed order reference."); return; }
    const session = generation.current;
    busyRef.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const data = await apiFetch<Result>("/" + action, { method: "POST", token: token ?? undefined, body: JSON.stringify({ qr_code: qr ?? undefined, customer_id: customerId ?? undefined, source: customerId ? "online" : "image", order_reference: action === "stamp" ? reference.trim() : undefined, ...(action === "stamp" ? selection : {}) }) });
      if (session !== generation.current) return;
      setPreview({ ...preview, current_stamps: data.loyalty.current_stamps, reward_ready: data.loyalty.reward_unlocked });
      setCompleted(true);
      setMessage(action === "stamp" ? `${selection.stamp_count} stamp${selection.stamp_count === 1 ? "" : "s"} added. The customer's card has been updated.` : "Reward redeemed. The customer's card has been updated.");
    } catch (err) {
      if (session === generation.current) setError(err instanceof Error ? err.message : "Could not confirm this order.");
    } finally {
      busyRef.current = false;
      if (session === generation.current) setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#e7b354]/25 bg-black/25 p-5 sm:p-6" aria-labelledby="online-order-title">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-[#e7b354]/10 p-3 text-[#ffd369]"><ImagePlus className="size-5" /></span>
        <div><h2 id="online-order-title" className="text-lg font-semibold">Online orders</h2><p className="text-sm text-muted-foreground">Find your customer or scan a QR screenshot.</p></div>
      </div>
      <form onSubmit={e => void searchCustomer(e)} className="mt-5 space-y-3">
        <label htmlFor="online-customer-search" className="block text-sm font-medium">Customer email or phone</label>
        <Input id="online-customer-search" value={query} maxLength={254} placeholder="Email or complete phone number" disabled={busy} onChange={e => setQuery(e.target.value)} />
        <Button type="submit" className="h-11 w-full" disabled={busy || !token || !query.trim()}>Find customer</Button>
      </form>
      {searched && !matches.length ? <p role="status" className="mt-3 text-sm text-muted-foreground">No matching customer in your program. Send the invitation link so they can add your card first.</p> : null}
      {matches.length ? <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">{matches.map(customer => <button key={customer.id} type="button" disabled={busy} onClick={() => void selectCustomer(customer.id)} aria-pressed={customerId === customer.id} className="w-full rounded-xl border border-white/15 bg-white/5 p-3 text-left transition hover:border-[#e7b354]/50 disabled:opacity-50"><span className="block font-medium">{customer.name}</span><span className="block break-all text-xs text-muted-foreground">{customer.email} {customer.phone}</span><span className="mt-1 block text-xs text-[#ffd369]">Select customer</span></button>)}</div> : null}
      <p className="mt-5 text-center text-xs text-muted-foreground">Or use a customer QR image</p>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Customer QR image" onChange={(event) => void selectImage(event)} disabled={busy} />
      <Button className="mt-5 h-12 w-full" variant="outline" disabled={busy || !token} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {busy ? "Processing…" : "Scan from image"}
      </Button>
      {preview ? <div className="mt-5 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3"><p className="font-semibold">{preview.customer_name}</p><span className="shrink-0 text-[#ffd369]">{preview.current_stamps}/{preview.required_stamps} stamps</span></div>
        <p className="text-sm text-muted-foreground">Reward: {preview.reward_name}</p>
        {!completed && !preview.reward_ready ? <>
          <label htmlFor="online-order-reference" className="block text-sm font-medium">Order reference</label>
          <Input id="online-order-reference" value={reference} maxLength={120} placeholder="e.g. ORDER-1042" autoComplete="off" disabled={busy} onChange={(event) => setReference(event.target.value)} />
          <p className="text-xs text-muted-foreground">Use a unique reference for each confirmed order. Each order can only be credited once.</p>
          <StampOptions prefix="online-stamp" features={preview.features} value={selection} onChange={setSelection} remaining={preview.required_stamps-preview.current_stamps} disabled={busy} />
          <Button className="h-11 w-full" disabled={busy || !reference.trim() || selection.stamp_count < 1 || selection.stamp_count > preview.required_stamps-preview.current_stamps} onClick={() => void confirm("stamp")}>Confirm order & add {selection.stamp_count} {selection.stamp_count === 1 ? "stamp" : "stamps"}</Button>
        </> : null}
        {!completed && preview.reward_ready ? <><p className="text-sm text-[#ffd369]">Reward ready. Redeem it when you provide the reward to this customer.</p><Button className="h-11 w-full" disabled={busy} onClick={() => void confirm("redeem-reward")}>Confirm reward redeemed</Button></> : null}
      </div> : <p className="mt-3 text-xs text-muted-foreground">Reading an image does not add a stamp. Confirm the order after checking the customer.</p>}
      {error ? <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {message ? <p role="status" className="mt-4 flex items-start gap-2 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{message}</p> : null}
    </section>
  );
}
