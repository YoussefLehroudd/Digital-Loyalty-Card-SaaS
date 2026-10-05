"use client";

import { usePathname } from "next/navigation";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { CustomerPageSkeleton, type CustomerSkeletonVariant } from "@/components/customer-app/customer-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const pages: Record<string, { title: string; variant: CustomerSkeletonVariant }> = {
  dashboard: { title: "Dashboard", variant: "dashboard" },
  cards: { title: "My Cards", variant: "cards" },
  rewards: { title: "Rewards", variant: "rewards" },
  activity: { title: "Activity", variant: "activity" },
  profile: { title: "Profile", variant: "profile" },
  settings: { title: "Settings", variant: "profile" },
  notifications: { title: "Notifications", variant: "notifications" },
  join: { title: "Join Loyalty Program", variant: "join" },
};

export function CustomerPageLoading() {
  const pathname = usePathname();
  const route = pathname.split("/")[2] ?? "dashboard";
  if (route === "login" || route === "register") {
    return <div role="status" aria-label="Loading account form" className="flex min-h-dvh items-center justify-center bg-[#080907] p-4"><div aria-hidden="true" className="w-full max-w-md space-y-6 rounded-[26px] border border-[#d8a63f]/20 bg-[#10110e] p-6"><Skeleton className="h-7 w-2/3 bg-white/[.07] motion-reduce:animate-none" />{[0,1,2].map(i => <Skeleton key={i} className="h-11 w-full bg-white/[.07] motion-reduce:animate-none" />)}</div></div>;
  }
  const page = pages[route] ?? pages.dashboard;
  return <CustomerLayout title={page.title}><CustomerPageSkeleton variant={page.variant} /></CustomerLayout>;
}
