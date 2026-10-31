"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CirclePause, Clock3, MailCheck, Play, Send, ShieldAlert } from "lucide-react";
import { adminRequest } from "@/lib/admin";

type QueueResult = {
  remaining: number;
  results: Array<{ campaign_code: string; status: string; error?: string }>;
  note: string;
};
type State = "idle" | "sending" | "pausing" | "paused" | "finished" | "failed";

export function OutreachSendQueue({ token, ready, unsent, configured, sender, onProgress }: {
  token: string;
  ready: number;
  unsent: number;
  configured: boolean;
  sender: string | null;
  onProgress: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [accepted, setAccepted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [last, setLast] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [initialCount, setInitialCount] = useState(0);
  const stopRef = useRef(false);
  const workingRef = useRef(false);
  useEffect(() => () => { stopRef.current = true; }, []);

  const unverified = Math.max(0, unsent - ready);
  const pending = remaining ?? ready;
  const finishedCount = accepted + failed + skipped;
  const percent = initialCount ? Math.min(100, Math.round((finishedCount / initialCount) * 100)) : 0;
  async function start() {
    if (workingRef.current || !configured || !ready) return;
    if (!window.confirm(
      "Start sending verified, opted-in outreach emails one at a time from " + (sender || "the configured account") +
      "? Messages that are unverified, blocked, bounced or already sent will not be included. The queue runs while this page stays open."
    )) return;

    workingRef.current = true;
    stopRef.current = false;
    setState("sending");
    setError("");
    setRemaining(null);
    setInitialCount(ready);
    setAccepted(0);
    setFailed(0);
    setSkipped(0);
    setLast("");
    try {
      while (!stopRef.current) {
        const response = await adminRequest<QueueResult>("outreach/send-next", token, {
          method: "POST",
          body: JSON.stringify({ confirm: true }),
        });
        const entry = response.results[0];
        setRemaining(response.remaining);
        if (!entry) {
          setState("finished");
          break;
        }
        setLast(entry.campaign_code + " · " + entry.status + (entry.error ? " — " + entry.error : ""));
        if (entry.status === "sent") setAccepted(value => value + 1);
        else if (entry.status === "failed") setFailed(value => value + 1);
        else setSkipped(value => value + 1);
        onProgress();
        if (response.remaining <= 0) {
          setState("finished");
          break;
        }
        // One recipient per request, with a deliberate pause.
        await new Promise<void>(resolve => window.setTimeout(resolve, 7500));
      }
      if (stopRef.current) setState("paused");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue stopped after a sending error.");
      setState("failed");
      onProgress();
    } finally {
      workingRef.current = false;
      onProgress();
    }
  }
  function pause() {
    stopRef.current = true;
    setState("pausing");
  }

  return <section aria-label="Outreach sending queue" className="rounded-2xl border border-[#edbc62]/20 bg-[#edbc62]/[.04] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#edbc62]"><Send className="size-4"/>Send remaining emails</p>
        <h2 className="mt-2 text-lg font-semibold text-white">One click · gradual sending</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-white/55">No manual selection. Each verified recipient receives their own saved message and campaign tracking URL. This runs while the admin page remains open.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(state === "sending" || state === "pausing") ? <button type="button" disabled={state === "pausing"} onClick={pause}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-xs font-bold text-white disabled:opacity-50">
          <CirclePause className="size-4"/>{state === "pausing" ? "Pausing…" : "Pause sending"}</button> :
        <button type="button" onClick={() => void start()} disabled={!configured || ready === 0 || workingRef.current}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#edbc62] px-4 text-xs font-bold text-black hover:bg-[#f3cf8c] disabled:cursor-not-allowed disabled:opacity-40">
          {state === "paused" || state === "failed" ? <Play className="size-4"/> : <Send className="size-4"/>}
          {state === "paused" || state === "failed" ? "Resume approved queue" : "Send all approved"} ({ready})
        </button>}
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { icon: Clock3, title: "Ready to send", value: pending },
        { icon: MailCheck, title: "Provider accepted this run", value: accepted },
        { icon: ShieldAlert, title: "Failed this run", value: failed },
        { icon: CheckCircle2, title: "Skipped this run", value: skipped },
      ].map(item => <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="flex items-center gap-1.5 text-[11px] text-white/50"><item.icon className="size-3.5 text-[#edbc62]"/>{item.title}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{item.value}</p>
      </div>)}
    </div>
    {initialCount > 0 && state !== "idle" ? <div className="mt-3 space-y-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Sending queue progress"><div className="flex justify-between text-[11px] text-white/50"><span>{finishedCount} / {initialCount} processed</span><span>{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#edbc62] transition-all" style={{width:percent+"%"}}/></div></div> : null}
    {state !== "idle" ? <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70" role="status">
      <p><strong className="text-[#edbc62]">Queue: {state}</strong>{state === "sending" ? " · one message approximately every 8 seconds" : ""}</p>
      {last ? <p className="mt-1 break-words">Last: {last}</p> : null}
    </div> : null}
    {error ? <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p> : null}
    {unverified > 0 ? <p className="mt-3 text-xs leading-5 text-amber-200/90">
      {unverified} unsent contact(s) have no recorded permission or are otherwise not eligible. They will not be automatically sent. Confirm each contact's permission before starting; do not mark consent without evidence.
    </p> : null}
    {!configured ? <p className="mt-3 text-xs text-rose-300">Sending is not configured on the server.</p> : null}
    <p className="mt-3 text-[11px] text-white/40">Accepted by provider ≠ Delivered. Delivery confirmation depends on signed email-provider events. The queue stops on a network error and can be resumed without re-sending completed records.</p>
  </section>;
}
