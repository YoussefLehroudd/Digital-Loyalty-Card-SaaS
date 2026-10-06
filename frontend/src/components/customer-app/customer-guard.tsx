"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CustomerPageLoading } from "@/components/customer-app/customer-page-loading";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";

const PUBLIC_USER_ROUTES = new Set(["/user/login", "/user/register"]);

export function CustomerGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useCustomerAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_USER_ROUTES.has(pathname);

    if (!isAuthenticated && !isPublic) {
      router.replace("/user/login");
      return;
    }

    if (isAuthenticated && isPublic) {
      router.replace("/user/dashboard");
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return (
      <CustomerPageLoading />
    );
  }

  return <>{children}</>;
}
