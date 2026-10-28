"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CustomerPageLoading } from "@/components/customer-app/customer-page-loading";
import { useCustomerAuth } from "@/components/customer-app/customer-auth-provider";
const PUBLIC_USER_ROUTES = new Set(["/user/login", "/user/register"]);
export function CustomerGuard({ children }: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, loading, token, sessionError, retrySession } = useCustomerAuth();
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        if (loading || (token && sessionError))
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
    }, [isAuthenticated, loading, pathname, router, token, sessionError]);
    if (loading) {
        return (<CustomerPageLoading />);
    }
    if(token && sessionError && !isAuthenticated && !PUBLIC_USER_ROUTES.has(pathname)){
      return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#080907] p-6 text-center text-white">
        <h1 className="text-xl font-semibold">Connection unavailable</h1>
        <p className="max-w-sm text-sm text-white/60">{sessionError}</p>
        <button type="button" className="rounded-xl bg-[#e7b354] px-6 py-3 font-semibold text-black" onClick={()=>void retrySession()}>Retry connection</button>
        <p className="text-xs text-white/40">Your login remains saved on this device. You will not need to enter your password again.</p>
      </main>;
    }
    return <>{children}</>;
}
