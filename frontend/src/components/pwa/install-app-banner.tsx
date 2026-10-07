"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "loyvance-install-dismissed-until";
const INSTALLED_KEY = "loyvance-app-installed";

export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const prompt = useRef<InstallPrompt | null>(null);
  const banner = useRef<HTMLElement>(null);
  const sessionDismissed = useRef(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const mobile = window.matchMedia("(max-width: 1023px)");
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIos);
    let dismissed = false;
    let installed = false;
    try {
      dismissed = Number(localStorage.getItem(DISMISSED_KEY)) > Date.now();
      installed = localStorage.getItem(INSTALLED_KEY) === "true";
    } catch { /* Installation remains available without browser storage. */ }
    const update = () => setVisible(mobile.matches && !standalone.matches && !(navigator as Navigator & { standalone?: boolean }).standalone && !dismissed && !sessionDismissed.current && !installed);
    const beforeInstall = (event: Event) => { event.preventDefault(); installed = false; prompt.current = event as InstallPrompt; update(); };
    const onInstalled = () => {
      installed = true;
      prompt.current = null;
      setVisible(false);
      setInstructions(false);
      try { localStorage.setItem(INSTALLED_KEY, "true"); } catch { /* Optional storage. */ }
    };
    update();
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    standalone.addEventListener("change", update);
    mobile.addEventListener("change", update);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!visible || !banner.current) {
      document.documentElement.style.removeProperty("--app-install-height");
      return;
    }
    const updateHeight = () => document.documentElement.style.setProperty("--app-install-height", `${banner.current?.getBoundingClientRect().height ?? 0}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(banner.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--app-install-height"); };
  }, [visible]);

  function dismiss() {
    sessionDismissed.current = true;
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now() + 7 * 86400000)); } catch { /* Optional storage. */ }
    setVisible(false);
  }

  async function install() {
    if (busy) return;
    const event = prompt.current;
    if (!event) { setInstructions(true); return; }
    prompt.current = null;
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
    } catch { setInstructions(true); }
    finally { setBusy(false); }
  }

  return <>
    {visible ? <aside ref={banner} aria-label="Install LOYVANCE app" className="fixed inset-x-0 top-0 z-[110] flex items-center gap-3 border-b border-[#efbd5d]/25 bg-[#11120f] px-3 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))] text-white shadow-lg lg:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pwa/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">LOYVANCE App</p><p className="mt-0.5 text-xs text-white/55">Your loyalty, one tap away.</p></div>
      <button type="button" onClick={() => void install()} disabled={busy} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#efbd5d] px-3 py-2.5 text-xs font-bold text-black disabled:opacity-60"><Download className="size-4" />{busy ? "Installing…" : "Install"}</button>
      <button type="button" onClick={dismiss} aria-label="Dismiss install banner" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/10"><X className="size-4" /></button>
    </aside> : null}
    <Modal isOpen={instructions} onClose={() => setInstructions(false)} title="Install LOYVANCE" icon={<Smartphone />} description="Keep your loyalty cards on your home screen.">
      <ol className="space-y-4 text-sm leading-6 text-white/75">
        {ios ? <><li>1. Open this site in <strong className="text-white">Safari</strong>.</li><li>2. Tap <Share className="inline size-4 text-[#efbd5d]" /> <strong className="text-white">Share</strong>, then <strong className="text-white">Add to Home Screen</strong>.</li><li>3. Keep <strong className="text-white">Open as Web App</strong> enabled if shown, then tap <strong className="text-white">Add</strong>.</li></> : <><li>1. Open this site in <strong className="text-white">Chrome</strong> on your phone.</li><li>2. Tap the browser menu <strong className="text-white">⋮</strong>, then <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.</li><li>3. Confirm to add <strong className="text-white">LOYVANCE</strong> to your phone.</li></>}
      </ol>
      <p className="mt-5 text-xs leading-5 text-white/40">An internet connection is needed for live stamps and rewards.</p>
    </Modal>
  </>;
}
