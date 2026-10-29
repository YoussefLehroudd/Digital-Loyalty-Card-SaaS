"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { Skeleton } from "@/components/ui/skeleton";
const panel = "customer-loading-panel rounded-2xl border border-[#d8a63f]/15 bg-[#10110e]/95";
function Block({ className = "" }: {
    className?: string;
}) {
    const { t: tr } = useI18n();
    return <Skeleton aria-hidden="true" className={`customer-loading-block bg-white/[.07] motion-reduce:animate-none ${className}`}/>;
}
export function CustomerStatsSkeleton({ count = 4 }: {
    count?: number;
}) {
    const { t: tr } = useI18n();
    return (<div aria-hidden="true" className={count === 3 ? "grid grid-cols-3 gap-2 sm:gap-4" : "grid grid-cols-2 gap-2.5 lg:grid-cols-4"}>
      {Array.from({ length: count }, (_, i) => (<div key={i} className={`${panel} ${count === 4 ? "min-h-[118px] p-3 sm:min-h-[124px] sm:p-4" : "px-3 py-3.5 sm:px-5"}`}>
          <div className="flex items-center gap-2.5"><Block className={count === 4 ? "size-10 shrink-0 rounded-xl" : "size-7 shrink-0 rounded-lg"}/><Block className="h-7 w-10"/></div>
          <Block className="mt-3 h-2.5 w-2/3"/>
          {count === 4 ? <Block className="mt-3 h-2 w-4/5"/> : null}
        </div>))}
    </div>);
}
export function CustomerCardSkeleton() {
    const { t: tr } = useI18n();
    return (<div aria-hidden="true" className="customer-loading-card mx-auto min-h-[240px] w-full max-w-[450px] rounded-[24px] border border-[#d8a63f]/20 bg-[linear-gradient(145deg,#191a14,#0c0d09)] p-5 shadow-xl">
      <div className="flex items-center gap-3"><Block className="size-10 shrink-0 rounded-xl"/><div className="flex-1 space-y-2"><Block className="h-4 w-2/3"/><Block className="h-2.5 w-1/3"/></div></div>
      <div className="mt-5 flex items-center justify-between gap-4"><div className="flex-1 space-y-3"><Block className="h-3 w-3/4"/><Block className="h-2 w-full rounded-full"/><Block className="h-3 w-1/2"/></div><Block className="size-16 shrink-0 rounded-xl sm:size-20"/></div>
      <div className="mt-5 grid grid-cols-5 gap-2">{Array.from({ length: 5 }, (_, i) => <Block key={i} className="aspect-square max-h-10 rounded-full"/>)}</div>
    </div>);
}
export function CustomerListSkeleton({ rows = 3 }: {
    rows?: number;
}) {
    const { t: tr } = useI18n();
    return (<div role="status" aria-label={tr("Loading updates")} className="customer-loading-skeleton space-y-3">
      {Array.from({ length: rows }, (_, i) => (<div key={i} aria-hidden="true" className={`${panel} flex items-start gap-3 p-4`}>
          <Block className="size-9 shrink-0 rounded-xl"/>
          <div className="min-w-0 flex-1 space-y-2.5"><Block className="h-3.5 w-2/3"/><Block className="h-2.5 w-full"/><Block className="h-2 w-1/3"/></div>
        </div>))}
    </div>);
}
export type CustomerSkeletonVariant = "dashboard" | "cards" | "rewards" | "activity" | "profile" | "notifications" | "join";
export function CustomerPageSkeleton({ variant = "dashboard" }: {
    variant?: CustomerSkeletonVariant;
}) {
    const { t: tr } = useI18n();
    if (variant === "notifications")
        return <CustomerListSkeleton rows={4}/>;
    return (<div role="status" aria-label={tr("Loading page content")} className="customer-loading-skeleton space-y-5">
      {variant === "dashboard" ? <CustomerStatsSkeleton /> : variant === "activity" || variant === "rewards" ? <CustomerStatsSkeleton count={3}/> : null}
      {variant === "dashboard" || variant === "cards" || variant === "join" ? (<div aria-hidden="true" className={`${panel} space-y-5 p-4 sm:p-6`}>
          <div className="flex items-center justify-between gap-4"><div className="space-y-2"><Block className="h-4 w-36"/><Block className="h-2.5 w-44"/></div><Block className="h-9 w-20 rounded-xl"/></div>
          <CustomerCardSkeleton />
          <div className="mx-auto flex max-w-[450px] justify-center gap-3"><Block className="size-9 rounded-full"/><Block className="size-9 rounded-full"/></div>
          {variant === "cards" ? <div className="mx-auto grid max-w-[450px] gap-2 sm:grid-cols-2"><Block className="h-[50px] w-full rounded-xl"/><Block className="h-[50px] w-full rounded-xl"/></div> : null}
        </div>) : variant === "activity" ? (<div className={`${panel} overflow-hidden`}>
          <div aria-hidden="true" className="space-y-4 border-b border-white/10 p-5"><Block className="h-4 w-40"/><div className="flex flex-col gap-3 xl:flex-row"><Block className="h-10 w-full rounded-xl xl:w-80"/><Block className="h-10 w-full rounded-xl xl:ms-auto xl:w-72"/></div></div>
          <div className="p-4"><CustomerListSkeleton rows={5}/></div>
        </div>) : variant === "rewards" ? (<>
          <div aria-hidden="true"><Block className="mb-4 h-5 w-32"/><div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className={`${panel} space-y-5 p-5 ${i > 0 ? "hidden lg:block" : ""}`}><div className="flex gap-3"><Block className="size-11 rounded-xl"/><Block className="mt-2 h-3 w-1/2"/></div><Block className="h-5 w-3/4"/><Block className="h-3 w-full"/><Block className="h-3 w-2/3"/><Block className="h-2 w-full rounded-full"/><Block className="h-3 w-1/3"/></div>)}</div></div>
          <CustomerListSkeleton rows={3}/>
        </>) : (<div aria-hidden="true" className="space-y-5">
          <div className={`${panel} flex items-center gap-4 p-5`}><Block className="size-20 shrink-0 rounded-2xl"/><div className="flex-1 space-y-3"><Block className="h-5 w-1/2"/><Block className="h-3 w-2/3"/></div></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)]">{[4, 3].map((fields, i) => <div key={i} className={`${panel} space-y-5 p-5 sm:p-6`}><Block className="h-5 w-40"/>{Array.from({ length: fields }, (_, j) => <div key={j} className="space-y-2"><Block className="h-2.5 w-24"/><Block className="h-11 w-full rounded-xl"/></div>)}<Block className="h-11 w-full rounded-xl"/></div>)}</div>
        </div>)}
    </div>);
}
