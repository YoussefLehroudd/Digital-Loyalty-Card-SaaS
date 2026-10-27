"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

type DailyMetric = { day: string; sessions: number; pageviews: number };
type Metric = "sessions" | "pageviews";
type Bucket = { key: string; first: string; last: string; sessions: number; pageviews: number };

function label(dateKey: string, variant: "weekday" | "date") {
  const date = new Date(dateKey + "T12:00:00Z");
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    ...(variant === "weekday" ? { weekday: "short" } : { day: "numeric", month: "short" }),
  }).format(date);
}

function makeBuckets(data: DailyMetric[], days: 7 | 30 | 90): Bucket[] {
  // The API only returns days containing sessions. Fill all days with zeroes
  // so a single day's traffic never becomes one chart-wide bar.
  const lookup = new Map(data.map(item => [item.day, item]));
  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daily = Array.from({ length: days }, (_, index) => {
    const key = new Date(utcToday - (days - index - 1) * 86400000).toISOString().slice(0, 10);
    const stored = lookup.get(key);
    return {
      key,
      first: key,
      last: key,
      sessions: Math.max(0, Number(stored?.sessions ?? 0)),
      pageviews: Math.max(0, Number(stored?.pageviews ?? 0)),
    };
  });
  if (days !== 90) return daily;

  // Ninety daily bars would be unreadable on mobile. Sum into 13 week-sized
  // groups, preserving the exact day totals and UTC date ranges.
  const weeks: Bucket[] = [];
  for (let start = 0; start < daily.length; start += 7) {
    const group = daily.slice(start, start + 7);
    weeks.push({
      key: group[0].key,
      first: group[0].first,
      last: group[group.length - 1].last,
      sessions: group.reduce((total, item) => total + item.sessions, 0),
      pageviews: group.reduce((total, item) => total + item.pageviews, 0),
    });
  }
  return weeks;
}

export function DailyVisitsChart({ data, days }: { data: DailyMetric[]; days: 7 | 30 | 90 }) {
  const [metric, setMetric] = useState<Metric>("sessions");
  const buckets = useMemo(() => makeBuckets(data, days), [data, days]);
  const maxValue = Math.max(0, ...buckets.map(item => item[metric]));
  const scaleMax = maxValue <= 5 ? Math.max(1, maxValue) : Math.ceil(maxValue / 5) * 5;
  const total = buckets.reduce((sum, item) => sum + item[metric], 0);
  const metricName = metric === "sessions" ? "sessions" : "page views";

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101318] p-4 sm:p-5" aria-label="Daily visitor traffic chart">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <CalendarDays className="size-4 text-[#efbd5d]" />
            Daily visits
          </h2>
          <p className="mt-1 text-xs text-white/45">
            <strong className="font-semibold text-[#efbd5d]">{total.toLocaleString("en")}</strong>
            {" "}{metricName} · {days === 90 ? "Weekly totals" : "Daily totals"} · UTC
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1" role="group" aria-label="Daily visits metric">
          {(["sessions", "pageviews"] as const).map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={metric === option}
              onClick={() => setMetric(option)}
              className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition sm:text-xs ${metric === option ? "bg-[#efbd5d] text-black" : "text-white/50 hover:text-white"}`}
            >
              {option === "sessions" ? "Sessions" : "Page views"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 gap-2.5 sm:gap-4">
        <div className="flex h-[172px] w-7 shrink-0 flex-col justify-between pb-px text-right text-[10px] tabular-nums text-white/35 sm:w-9">
          <span>{scaleMax}</span>
          <span>{scaleMax > 1 ? Math.ceil(scaleMax / 2) : ""}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-[172px] border-b border-white/20">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {[0, 1, 2, 3, 4].map(index => (
                <div key={index} className="border-t border-dashed border-white/[.075]" />
              ))}
            </div>

            <div className="relative z-10 flex h-full min-w-0 items-end justify-between gap-1 sm:gap-2">
              {buckets.map(bucket => {
                const count = bucket[metric];
                const height = count === 0 ? 0 : Math.max(3, count / scaleMax * 100);
                const range = bucket.first === bucket.last ? label(bucket.first, "date") : label(bucket.first, "date") + "–" + label(bucket.last, "date");
                return (
                  <div
                    key={bucket.key}
                    className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                    title={range + ": " + count + " " + metricName}
                    role="img"
                    aria-label={range + ": " + count + " " + metricName}
                    tabIndex={0}
                  >
                    <div
                      className={`relative w-full max-w-[54px] rounded-t-[4px] transition-colors duration-150 ${count > 0 ? "bg-gradient-to-t from-[#b7852c] to-[#efbd5d] group-hover:from-[#df9d32] group-hover:to-[#ffe2a0] group-focus:from-[#df9d32] group-focus:to-[#ffe2a0]" : ""}`}
                      style={{ height: height + "%" }}
                    >
                      {days === 7 && count > 0 && (
                        <span className={height >= 80 ? "absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-[#17130b]" : "absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-[#efbd5d]"}>
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex min-w-0 gap-1 sm:gap-2" aria-hidden="true">
            {buckets.map((bucket, index) => {
              const show = days === 7 || (days === 30 ? index % 5 === 0 || index === buckets.length - 1 : index % 2 === 0 || index === buckets.length - 1);
              return (
                <div key={bucket.key} className="relative h-5 min-w-0 flex-1 text-center">
                  {show && <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[9px] tabular-nums text-white/40 sm:text-[10px]">
                    {days === 7 ? label(bucket.first, "weekday") : label(bucket.first, "date")}
                  </span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-white/40">
        {days === 90 ? "Grouped by consecutive 7-day periods for readability." : "One bar per UTC calendar day, including days with zero visits."}
        {" "}Hover or focus a bar to see its exact total.
      </p>
      {total === 0 && (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[.025] px-3 py-2 text-xs text-white/50">
          No {metricName} recorded in this period yet.
        </p>
      )}
    </section>
  );
}
