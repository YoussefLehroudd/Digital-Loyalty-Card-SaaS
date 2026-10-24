"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
type PullToRefreshProps = {
    onRefresh: () => Promise<void> | void;
    children: React.ReactNode;
    threshold?: number;
};
export function PullToRefresh({ onRefresh, children, threshold = 72 }: PullToRefreshProps) {
    const { t: tr } = useI18n();
    const startY = useRef<number | null>(null);
    const [distance, setDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    useEffect(() => {
        const onTouchStart = (e: TouchEvent) => {
            if (window.scrollY > 0 || refreshing)
                return;
            startY.current = e.touches[0]?.clientY ?? null;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (startY.current === null || refreshing)
                return;
            const current = e.touches[0]?.clientY ?? 0;
            const delta = Math.max(0, current - startY.current);
            setDistance(Math.min(delta, threshold * 1.4));
        };
        const onTouchEnd = async () => {
            if (refreshing)
                return;
            if (distance >= threshold) {
                try {
                    setRefreshing(true);
                    await onRefresh();
                }
                finally {
                    setRefreshing(false);
                }
            }
            startY.current = null;
            setDistance(0);
        };
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        window.addEventListener("touchend", onTouchEnd, { passive: true });
        return () => {
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        };
    }, [distance, onRefresh, refreshing, threshold]);
    const progress = Math.min(100, Math.round((distance / threshold) * 100));
    return (<div>
      <div className="flex items-center justify-center overflow-hidden transition-all duration-200" style={{ height: distance > 0 || refreshing ? 44 : 0 }} aria-hidden={!(distance > 0 || refreshing)}>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}/>
          {refreshing ? tr("Refreshing...") : progress >= 100 ? tr("Release to refresh") : tr("Pull to refresh")}
        </div>
      </div>
      {children}
    </div>);
}
