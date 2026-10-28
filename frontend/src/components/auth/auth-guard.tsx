"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {ApiError} from "@/lib/api";
import { clearStoredToken, getCurrentUser, getStoredToken, logout, type AuthUser, type UserRole, } from "@/lib/auth";
type AuthContextValue = {
    token: string;
    user: AuthUser;
    signOut: () => Promise<void>;
    updateUser: (user: AuthUser) => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthGuard({ children, requiredRole, }: {
    children: ReactNode;
    requiredRole?: UserRole;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [offlineError,setOfflineError]=useState(false);
    const [retry,setRetry]=useState(0);
    useEffect(() => {
        let isMounted = true;
        setOfflineError(false);
        const onOnline=()=>setRetry(v=>v+1);
        window.addEventListener("online",onOnline);
        const storedToken = getStoredToken();
        const cachedUserCacheKey = "digital_loyalty_cached_user";
        const cachedUserTsCacheKey = "digital_loyalty_cached_user_ts";
        const cachedUserTtlMs = 2 * 60 * 1000; // 2 minutes
        async function verifySession() {
            if (!storedToken) {
                router.replace(`/login?next=${encodeURIComponent(pathname)}`);
                return;
            }
            // Immediate post-login hydration optimization:
            // if the login page just cached the user, use it once to avoid an extra /auth/me call.
            try {
                const raw = window.sessionStorage.getItem(cachedUserCacheKey);
                const tsRaw = window.sessionStorage.getItem(cachedUserTsCacheKey);
                const ts = tsRaw ? Number(tsRaw) : NaN;
                const isExpired = !Number.isFinite(ts) || Date.now() - ts > cachedUserTtlMs;
                if (raw && !isExpired) {
                    const parsed = JSON.parse(raw) as AuthUser;
                    if (!requiredRole || parsed.role === requiredRole || (requiredRole==="business_owner" && parsed.role==="staff" && pathname === "/dashboard/scanner")) {
                        window.sessionStorage.removeItem(cachedUserCacheKey);
                        window.sessionStorage.removeItem(cachedUserTsCacheKey);
                        if (isMounted) {
                            setToken(storedToken);
                            setUser(parsed);
                            setIsLoading(false);
                        }
                        return;
                    }
                    // Role mismatch: clear cached user and fall back to real verification below.
                    window.sessionStorage.removeItem(cachedUserCacheKey);
                    window.sessionStorage.removeItem(cachedUserTsCacheKey);
                }
            }
            catch {
                // Ignore cache errors and fall back to real verification below.
                try {
                    window.sessionStorage.removeItem(cachedUserCacheKey);
                    window.sessionStorage.removeItem(cachedUserTsCacheKey);
                }
                catch {
                    // ignore
                }
            }
            try {
                const response = await getCurrentUser(storedToken);
                if (requiredRole && response.user.role !== requiredRole && !(requiredRole==="business_owner" && response.user.role==="staff" && pathname === "/dashboard/scanner")) {
                    clearStoredToken();
                    router.replace("/login");
                    return;
                }
                if (isMounted) {
                    setOfflineError(false);
                    setToken(storedToken);
                    setUser(response.user);
                    setIsLoading(false);
                }
            }
            catch(error) {
                if(!isMounted)return;
                if(error instanceof ApiError && [401,403].includes(error.status)){
                    clearStoredToken();router.replace(`/login?next=${encodeURIComponent(pathname)}`);
                    return;
                }
                // A temporary network/5xx problem must not destroy the saved login.
                setOfflineError(true);setIsLoading(false);
            }
        }
        verifySession();
        return () => {
            isMounted = false;
            window.removeEventListener("online",onOnline);
        };
    }, [pathname, requiredRole, router,retry]);
    const value = useMemo<AuthContextValue | null>(() => {
        if (!token || !user) {
            return null;
        }
        return {
            token,
            user,
            updateUser: (nextUser) => setUser(nextUser),
            signOut: async () => {
                try {
                    await logout(token);
                }
                finally {
                    clearStoredToken();
                    router.replace("/login");
                    router.refresh();
                }
            },
        };
    }, [router, token, user]);
    if(offlineError)return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#080907] p-6 text-center text-white">
      <h1 className="text-xl font-semibold">Connection unavailable</h1>
      <p className="max-w-sm text-sm text-white/60">Your Business/Admin login remains saved. Try again when your connection is back.</p>
      <button type="button" className="rounded-xl bg-[#e7b354] px-6 py-3 font-semibold text-black" onClick={()=>{setIsLoading(true);setRetry(v=>v+1);}}>Retry connection</button>
    </main>;
    if (isLoading || !value) {
        return (<main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-7 w-56"/>
              <Skeleton className="h-4 w-80 max-w-full"/>
              <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-24"/>
                <Skeleton className="h-24"/>
                <Skeleton className="h-24"/>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>);
    }
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthGuard.");
    }
    return context;
}
