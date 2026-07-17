"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearStoredToken,
  getCurrentUser,
  getStoredToken,
  logout,
  type AuthUser,
  type UserRole,
} from "@/lib/auth";

type AuthContextValue = {
  token: string;
  user: AuthUser;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthGuard({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: UserRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const storedToken = getStoredToken();

    async function verifySession() {
      if (!storedToken) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const response = await getCurrentUser(storedToken);

        if (requiredRole && response.user.role !== requiredRole) {
          clearStoredToken();
          router.replace("/login");
          return;
        }

        if (isMounted) {
          setToken(storedToken);
          setUser(response.user);
          setIsLoading(false);
        }
      } catch {
        clearStoredToken();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [pathname, requiredRole, router]);

  const value = useMemo<AuthContextValue | null>(() => {
    if (!token || !user) {
      return null;
    }

    return {
      token,
      user,
      signOut: async () => {
        try {
          await logout(token);
        } finally {
          clearStoredToken();
          router.replace("/login");
          router.refresh();
        }
      },
    };
  }, [router, token, user]);

  if (isLoading || !value) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
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
