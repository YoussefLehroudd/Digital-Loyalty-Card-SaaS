"use client";
import { useAuth } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AffiliateDashboard } from "@/components/affiliates/affiliate-dashboard";

export default function BusinessAffiliatePage() {
  const { token } = useAuth();
  return <DashboardShell activeItem="affiliate"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-8"><AffiliateDashboard token={token}/></div></DashboardShell>;
}
