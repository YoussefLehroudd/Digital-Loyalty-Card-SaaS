"use client";
import { useEffect, useRef, useState } from "react";
import { adminRequest } from "@/lib/admin";

type Result = { remaining: number; results: Array<{ campaign_code: string; status: string; error?: string }> };
type QueuePhase = "idle" | "sending" | "paused" | "finished" | "error";

export function OutreachSendQueue({ token, ready, unsent, configured, sender, onProgress, onReview }: {
  token: string; ready: number; unsent: number; configured: boolean; sender: string | null; onProgress: () => void; onReview: () => void;
}) {
  const [phase, setPhase] = useState<QueuePhase>("idle");
  const [processed, setProcessed] = useState(0);
  const [accepted, setAccepted] = useState(0);
  const [failures, setFailures] = useState(0);
  const [initial, setInitial] = useState(0);
  const [last, setLast] = useState("");
  const [problem, setProblem] = useState("");
  const stop = useRef(false);
  const working = useRef(false);
  useEffect(() => {
    return () => { stop.current = true; };
  }, []);
  const progress = initial > 0 ? Math.min(100, Math.round(processed / initial * 100)) : 0;

  async function sendQueue() {
    if (!configured || !ready || working.current) return;
    if (!window.confirm("Send eligible, individually reviewed B2B or opted-in outreach emails one by one from " + (sender || "the verified sender") +
      "? This does not include unverified, bounced, blocked or previously sent recipients.")) return;
    stop.current = false;
    working.current = true;
    setPhase("sending");
    setProblem("");
    setInitial(ready);
    setProcessed(0);
    setAccepted(0);
    setFailures(0);
    setLast("");
    try {
      while (!stop.current) {
        const result = await adminRequest<Result>("outreach/send-next", token, {
          method: "POST", body: JSON.stringify({ confirm: true })
        });
        const item = result.results[0];
        if (!item) { setPhase("finished"); break; }
        setProcessed(n => n + 1);
        setLast(item.campaign_code + " · " + item.status);
        if (item.status === "sent") setAccepted(n => n + 1);
        else if (item.status === "failed") setFailures(n => n + 1);
        onProgress();
        if (result.remaining <= 0) { setPhase("finished"); break; }
        await new Promise<void>(resolve => { window.setTimeout(resolve, 7500); });
      }
      if (stop.current) setPhase("paused");
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "Queue stopped unexpectedly.");
      setPhase("error");
    } finally {
      working.current = false;
      onProgress();
    }
  }

  return <section className="rounded-2xl border border-[#edbc62]/25 bg-[#101318] p-4 text-white sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">Outreach — send eligible contacts</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-white/50">One click, without selecting contacts. One email per request, spaced apart. Keep this page open until finished.</p>
      </div>
      {phase === "sending" ? <button type="button" onClick={() => { stop.current = true; setPhase("paused"); }}
        className="min-h-11 rounded-xl border border-white/20 px-4 text-xs font-bold">Pause sending</button> :
        ready === 0 && unsent > 0 ? <button type="button" onClick={onReview}
          className="min-h-11 rounded-xl bg-[#edbc62] px-4 text-xs font-bold text-black">
          Review pending businesses ({unsent})
        </button> :
        <button type="button" onClick={() => { void sendQueue(); }} disabled={!configured || ready === 0}
          className="min-h-11 rounded-xl bg-[#edbc62] px-4 text-xs font-bold text-black disabled:opacity-40">
          {phase === "paused" || phase === "error" ? "Resume eligible queue" : "Send all eligible"} ({ready})
        </button>}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
      <div className="rounded-xl bg-white/[.04] p-3">Ready to send<p className="mt-2 text-xl font-bold">{ready}</p></div>
      <div className="rounded-xl bg-white/[.04] p-3">Processed this run<p className="mt-2 text-xl font-bold">{processed}</p></div>
      <div className="rounded-xl bg-white/[.04] p-3">Accepted this run<p className="mt-2 text-xl font-bold">{accepted}</p></div>
      <div className="rounded-xl bg-white/[.04] p-3">Failed this run<p className="mt-2 text-xl font-bold">{failures}</p></div>
    </div>
    {phase !== "idle" ? <div className="mt-4 space-y-2 text-xs text-white/60">
      <p>Queue: {phase} · {progress}%</p>
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#edbc62]" style={{ width: progress + "%" }}/></div>
      {last ? <p>Last: {last}</p> : null}
    </div> : null}
    {problem ? <p role="alert" className="mt-3 text-xs text-rose-300">{problem}</p> : null}
    {unsent > ready ? <p className="mt-3 text-xs text-amber-200">{unsent - ready} unsent contacts need a verified B2B eligibility review or an actual opt-in. Use "Review pending businesses" to check each business and its country-specific rules; they are not automatically authorized.</p> : null}
    {!configured ? <p className="mt-3 text-xs text-rose-300">Sending provider is not configured.</p> : null}
    <p className="mt-3 text-[11px] text-white/40">Provider accepted does not mean delivered. Bounces and complaints are tracked separately. The queue sends only records with documented opt-in or an individually reviewed, jurisdiction-appropriate B2B basis.</p>
  </section>;
}
