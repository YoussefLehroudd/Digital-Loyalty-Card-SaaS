"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStoredCustomerToken, customerLogin, customerLogout, customerMe, customerRegister, getStoredCustomerToken, storeCustomerToken, type CustomerAuthResponse, type CustomerLoginPayload, type CustomerRegisterPayload, type CustomerRegistrationResponse, type CustomerUser, } from "@/lib/customerAuth";
import { ApiError } from "@/lib/api";
type CustomerAuthContextValue = {
    user: CustomerUser | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (payload: CustomerLoginPayload) => Promise<CustomerAuthResponse>;
    register: (payload: CustomerRegisterPayload) => Promise<CustomerRegistrationResponse>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
};
const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);
export function CustomerAuthProvider({ children }: {
    children: React.ReactNode;
}) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<CustomerUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    useEffect(() => {
        const stored = getStoredCustomerToken();
        if (!stored) {
            setLoading(false);
            return;
        }
        setToken(stored);
        customerMe(stored)
            .then((res) => {
            setUser(res.user);
        })
            .catch(() => {
            clearStoredCustomerToken();
            setToken(null);
            setUser(null);
        })
            .finally(() => setLoading(false));
    }, []);
    const value = useMemo<CustomerAuthContextValue>(() => {
        return {
            user,
            token,
            loading,
            isAuthenticated: Boolean(user && token),
            login: async (payload) => {
                const res = await customerLogin(payload);
                storeCustomerToken(res.token);
                setToken(res.token);
                setUser(res.user);
                return res;
            },
            // Registration is pending until email OTP verification; never authenticate here.
            register: (payload) => customerRegister(payload),
            logout: async () => {
                if (token) {
                    try {
                        await customerLogout(token);
                    }
                    catch (e) {
                        if (!(e instanceof ApiError && (e.status === 401 || e.status === 403))) {
                            throw e;
                        }
                    }
                }
                clearStoredCustomerToken();
                setToken(null);
                setUser(null);
                router.push("/user/login");
            },
            refresh: async () => {
                if (!token)
                    return;
                const res = await customerMe(token);
                setUser(res.user);
            },
        };
    }, [loading, router, token, user]);
    return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}
export function useCustomerAuth() {
    const ctx = useContext(CustomerAuthContext);
    if (!ctx)
        throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
    return ctx;
}
