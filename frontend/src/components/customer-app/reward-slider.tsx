"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const GAP = 16;
const SPEED = 24; // Pixels per second, independent of screen refresh rate.
const wrap = (value: number, cycle: number) => ((value % cycle) + cycle) % cycle;

export function RewardSlider({ items }: { items: ReactNode[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const metrics = useRef({ cycle: 0, step: 0 });
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; active: boolean } | null>(null);
  const resumeAt = useRef(0);
  const pausedRef = useRef(false);
  const move = useRef<{ from: number; to: number; started: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const canSlide = items.length > 1;

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPaused(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const view = viewport.current;
    const strip = track.current;
    if (!view || !strip) return;
    if (!canSlide) {
      strip.style.transform = "";
      strip.style.removeProperty("--reward-slide-width");
      metrics.current = { cycle: 0, step: 0 };
      position.current = 0;
      return;
    }
    let frame = 0;
    let previous = 0;
    const paint = () => {
      const cycle = metrics.current.cycle;
      if (cycle) strip.style.transform = `translate3d(${-cycle - wrap(position.current, cycle)}px, 0, 0)`;
    };
    const measure = () => {
      const width = view.clientWidth;
      if (!width) return;
      const columns = window.matchMedia("(min-width: 1024px)").matches ? Math.min(3, items.length) : 1;
      const slideWidth = (width - GAP * (columns - 1)) / columns;
      const oldCycle = metrics.current.cycle;
      const phase = oldCycle ? wrap(position.current, oldCycle) / oldCycle : 0;
      strip.style.setProperty("--reward-slide-width", `${slideWidth}px`);
      metrics.current = { cycle: (slideWidth + GAP) * items.length, step: slideWidth + GAP };
      position.current = phase * metrics.current.cycle;
      move.current = null;
      paint();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    measure();

    const tick = (now: number) => {
      const delta = previous ? Math.min(now - previous, 64) : 0;
      previous = now;
      if (document.visibilityState === "visible") {
        const transition = move.current;
        if (transition) {
          const progress = Math.min(1, (now - transition.started) / 380);
          position.current = transition.from + (transition.to - transition.from) * (1 - Math.pow(1 - progress, 3));
          if (progress === 1) move.current = null;
        } else if (!pausedRef.current && !drag.current && now >= resumeAt.current) {
          position.current += SPEED * delta / 1000;
        }
        // Wrapping swaps identical copies; the visible cards never jump to the start.
        if (!move.current && metrics.current.cycle) position.current = wrap(position.current, metrics.current.cycle);
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      drag.current = null;
      move.current = null;
    };
  }, [items.length, canSlide]);

  const advance = (direction: number) => {
    if (!metrics.current.step) return;
    move.current = { from: position.current, to: position.current + direction * metrics.current.step, started: performance.now() };
    resumeAt.current = performance.now() + 1200;
  };
  const finishDrag = () => {
    drag.current = null;
    resumeAt.current = performance.now() + 900;
  };

  return (
    <div>
      <div
        ref={viewport}
        role="region"
        aria-roledescription="carousel"
        aria-label="Your loyalty rewards"
        tabIndex={canSlide ? 0 : undefined}
        className="overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]/60"
        style={{ touchAction: "pan-y", cursor: canSlide ? "grab" : undefined }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            advance(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onPointerDown={(event) => {
          if (!canSlide || !event.isPrimary || event.button !== 0) return;
          move.current = null;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, active: false };
        }}
        onPointerMove={(event) => {
          const gesture = drag.current;
          if (!gesture || gesture.id !== event.pointerId) return;
          const dx = event.clientX - gesture.x;
          const dy = event.clientY - gesture.y;
          if (!gesture.active) {
            if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { finishDrag(); return; }
            if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
            gesture.active = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          position.current -= event.clientX - gesture.lastX;
          gesture.lastX = event.clientX;
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerLeave={() => { if (!drag.current?.active) finishDrag(); }}
        onWheel={(event) => {
          if (!canSlide || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
          move.current = null;
          position.current += event.deltaX;
          resumeAt.current = performance.now() + 900;
        }}
      >
        <div
          ref={track}
          className={`flex select-none items-stretch gap-4 [--reward-slide-width:100%] ${items.length > 2 ? "lg:[--reward-slide-width:calc((100%_-_32px)/3)]" : items.length === 2 ? "lg:[--reward-slide-width:calc((100%_-_16px)/2)]" : ""}`}
          style={{ willChange: canSlide ? "transform" : undefined }}
        >
          {(canSlide ? [0, 1, 2] : [1]).flatMap((copy) => items.map((item, index) => (
            <div key={`${copy}-${index}`} aria-hidden={copy !== 1 ? true : undefined} className="flex w-[var(--reward-slide-width)] min-w-0 shrink-0 [&>article]:w-full">
              {item}
            </div>
          )))}
        </div>
      </div>
      {canSlide ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-white/40">Swipe to explore your rewards</p>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous reward" onClick={() => advance(-1)} className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/65 transition hover:border-[#f3bd55]/40 hover:text-[#f3bd55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label={paused ? "Play automatic slides" : "Pause automatic slides"} onClick={() => setPaused((value) => !value)} className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/65 transition hover:border-[#f3bd55]/40 hover:text-[#f3bd55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]">{paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button>
            <button type="button" aria-label="Next reward" onClick={() => advance(1)} className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/65 transition hover:border-[#f3bd55]/40 hover:text-[#f3bd55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3bd55]"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
