"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CustomerPageLoading } from "@/components/customer-app/customer-page-loading";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
const PUBLIC_USER_ROUTES = new Set(["/user/login", "/user/register"]);
export function CustomerGuard({ children }: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, loading } = useCustomerAuth();
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        if (loading)
            return;
        const isPublic = PUBLIC_USER_ROUTES.has(pathname);
        if (!isAuthenticated && !isPublic) {
            const query = new URLSearchParams(window.location.search);
            const login = new URLSearchParams();
            if (pathname === "/user/join") {
                if (query.get("auto"))
                    login.set("join", query.get("auto")!);
                if (query.get("auto_business_id"))
                    login.set("join_business_id", query.get("auto_business_id")!);
            }
            router.replace(`/login${login.size ? `?${login}` : ""}`);
            return;
        }
        if (isAuthenticated && isPublic) {
            router.replace("/user/dashboard");
        }
    }, [isAuthenticated, loading, pathname, router]);
    if (loading) {
        return (<CustomerPageLoading />);
    }
    return <>{children}</>;
}
