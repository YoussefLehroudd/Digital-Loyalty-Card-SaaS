"use client";

import { CustomerAuthProvider } from "@/components/customer-app/customer-auth-provider";
import { CustomerGuard } from "@/components/customer-app/customer-guard";

export default function UserAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <CustomerGuard>{children}</CustomerGuard>
    </CustomerAuthProvider>
  );
}
