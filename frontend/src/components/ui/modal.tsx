"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    allowOverlayClose?: boolean;
    closeDisabled?: boolean;
    children: React.ReactNode;
    className?: string;
};
const openModals: symbol[] = [];
let originalBodyOverflow = "";
export function Modal({ isOpen, onClose, title, description, icon, allowOverlayClose = false, closeDisabled = false, children, className, }: ModalProps) {
    const { t: tr } = useI18n();
    const [mounted, setMounted] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const callbacks = useRef({ onClose, closeDisabled });
    const id = useId();
    useEffect(() => { setMounted(true); }, []);
    useEffect(() => { callbacks.current = { onClose, closeDisabled }; }, [onClose, closeDisabled]);
    useEffect(() => {
        if (!isOpen || !mounted)
            return;
        const key = Symbol("modal");
        const previousFocus = document.activeElement as HTMLElement | null;
        if (openModals.length === 0) {
            originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        }
        openModals.push(key);
        panelRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (openModals[openModals.length - 1] !== key)
                return;
            if (event.key === "Escape") {
                event.preventDefault();
                if (!callbacks.current.closeDisabled)
                    callbacks.current.onClose();
            }
            if (event.key !== "Tab")
                return;
            const panel = panelRef.current;
            if (!panel)
                return;
            const controls = Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0);
            const first = controls[0], last = controls[controls.length - 1];
            if (!first) {
                event.preventDefault();
                panel.focus();
                return;
            }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            const wasTop = openModals[openModals.length - 1] === key;
            const index = openModals.indexOf(key);
            if (index >= 0)
                openModals.splice(index, 1);
            if (openModals.length === 0)
                document.body.style.overflow = originalBodyOverflow;
            if (wasTop && previousFocus?.isConnected)
                previousFocus.focus();
        };
    }, [isOpen, mounted]);
    if (!isOpen || !mounted)
        return null;
    return createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6" onClick={(event) => {
            if (event.target === event.currentTarget && allowOverlayClose && !closeDisabled)
                onClose();
        }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={title ? id + "-title" : undefined} aria-label={title ? undefined : tr("LOYVANCE dialog")} aria-describedby={description ? id + "-description" : undefined} tabIndex={-1} className={cn("relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-[#e7b354]/25 bg-[linear-gradient(145deg,#141510,#090a08)] text-white shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_40px_rgba(231,179,84,.06)] outline-none sm:max-h-[calc(100dvh-48px)]", className)}>
        <div className="flex shrink-0 items-start gap-3 border-b border-white/[.07] p-5 sm:p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#e7b354]/20 bg-[#e7b354]/10 text-[#f3bd55] [&_svg]:size-6">
            {icon ?? <img src="/brand/icon.png" alt="" width={32} height={32} className="size-8 object-contain"/>}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            {title ? <h2 id={id + "-title"} className="break-words text-base font-semibold tracking-tight sm:text-lg">{tr(title)}</h2> : null}
            {description ? <p id={id + "-description"} className="mt-1.5 break-words text-xs leading-5 text-white/50 sm:text-sm">{tr(description)}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={closeDisabled} onClick={onClose} aria-label={tr("Close modal")} className="-me-1 -mt-1 size-8 shrink-0 rounded-xl text-white/45 hover:bg-white/5 hover:text-white focus-visible:ring-[#f3bd55]">
            <X className="size-4"/>
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 text-sm text-white/70 sm:p-6 [&_button]:rounded-xl [&_button]:focus-visible:ring-[#f3bd55] [&_button[data-size=default]]:h-11 [&_button[data-variant=default]]:bg-[#f3bd55] [&_button[data-variant=default]]:font-semibold [&_button[data-variant=default]]:text-black [&_button[data-variant=default]]:hover:bg-[#ffd078] [&_button[data-variant=outline]]:border-white/15 [&_button[data-variant=outline]]:bg-white/[.025] [&_button[data-variant=outline]]:text-white/80 [&_button[data-variant=outline]]:hover:bg-white/[.07]" style={{ scrollbarWidth: "thin", scrollbarColor: "#806629 #10110e" }}>{children}</div>
      </div>
    </div>, document.body);
}
