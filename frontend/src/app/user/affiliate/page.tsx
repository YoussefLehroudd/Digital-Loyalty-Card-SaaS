"use client";
import { CustomerLayout } from "@/components/customer-app/customer-layout";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
import { AffiliateDashboard } from "@/components/affiliates/affiliate-dashboard";

export default function CustomerAffiliatePage() {
  const { token } = useCustomerAuth();
  return <CustomerLayout title="Affiliate" subtitle="Your referral earnings"><AffiliateDashboard token={token}/></CustomerLayout>;
}
