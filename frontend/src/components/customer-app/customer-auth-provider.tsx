"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStoredCustomerToken, customerLogin, customerLogout, customerMe, customerRegister, getStoredCustomerToken, storeCustomerToken, type CustomerAuthResponse, type CustomerLoginPayload, type CustomerRegisterPayload, type CustomerRegistrationResponse, type CustomerUser, } from "@/lib/customerAuth";
import { ApiError } from "@/lib/api";
import {disablePushOnDevice} from "@/lib/web-push-client";
type CustomerAuthContextValue = {
    user: CustomerUser | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    sessionError: string | null;
    retrySession: () => Promise<void>;
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
    const [sessionError,setSessionError]=useState<string|null>(null);
    const router = useRouter();
    const retrySession=useCallback(async()=>{
        const saved=getStoredCustomerToken();
        if(!saved){setToken(null);setUser(null);setSessionError(null);setLoading(false);return;}
        setToken(saved);setLoading(true);setSessionError(null);
        try{
          const res=await customerMe(saved);
          // Do not resurrect sessions when user explicitly logged out while fetching.
          if(getStoredCustomerToken()!==saved)return;
          setUser(res.user);
        }catch(e){
          if(getStoredCustomerToken()!==saved)return;
          if(e instanceof ApiError && (e.status===401||e.status===403)){
            clearStoredCustomerToken();setToken(null);setUser(null);
          }else{
            // Offline/502/temporary errors must NEVER destroy a valid remembered session.
            setSessionError("Connection unavailable. Your login is saved; reconnect and retry.");
          }
        }finally{setLoading(false);}
    },[]);
    useEffect(()=>{
      void retrySession();
      const retryWhenOnline=()=>{void retrySession();};
      window.addEventListener("online",retryWhenOnline);
      return()=>window.removeEventListener("online",retryWhenOnline);
    },[retrySession]);
    const value = useMemo<CustomerAuthContextValue>(() => {
        return {
            user,
            token,
            loading,
            isAuthenticated: Boolean(user && token),
            sessionError,
            retrySession,
            login: async (payload) => {
                const res = await customerLogin(payload);
                storeCustomerToken(res.token);
                setToken(res.token);
                setUser(res.user);
                setSessionError(null);
                return res;
            },
            // Registration is pending until email OTP verification; never authenticate here.
            register: (payload) => customerRegister(payload),
            logout: async () => {
                if (token) {
                    // Prevent private notifications reaching a shared device after sign-out.
                    try{await disablePushOnDevice(token);}catch{/* Account sign-out must still work offline. */}
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
                setSessionError(null);
                router.push("/user/login");
            },
            refresh: async () => {
                if (!token)
                    return;
                const res = await customerMe(token);
                setUser(res.user);
            },
        };
    }, [loading, router, token, user, sessionError, retrySession]);
    return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}
export function useCustomerAuth() {
    const ctx = useContext(CustomerAuthContext);
    if (!ctx)
        throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
    return ctx;
}
