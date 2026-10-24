"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { login, storeToken } from "@/lib/auth";
import { storeCustomerToken } from "@/lib/customerAuth";
const schema = z.object({
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof schema>;
export function LoginForm() {
    const { t: tr } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const next = searchParams.get("next");
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm<LoginValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            password: "",
        },
    });
    async function onSubmit(values: LoginValues) {
        setError(null);
        try {
            const response = await login({ ...values, device_name: "web" });
            if (response.user.role === "customer") {
                storeCustomerToken(response.token);
            }
            else {
                storeToken(response.token);
            }
            // Temporary user cache to speed up the immediate post-login redirect flow
            // (avoids an extra /auth/me roundtrip on the first AuthGuard mount).
            try {
                window.sessionStorage.setItem("digital_loyalty_cached_user", JSON.stringify(response.user));
                window.sessionStorage.setItem("digital_loyalty_cached_user_ts", String(Date.now()));
            }
            catch {
                // ignore
            }
            const join = searchParams.get("join");
            const joinBusinessId = searchParams.get("join_business_id");
            const destination = response.user.role === "customer"
                ? join
                    ? `/user/join?auto=${encodeURIComponent(join)}`
                    : joinBusinessId
                        ? `/user/join?auto_business_id=${encodeURIComponent(joinBusinessId)}`
                        : next?.startsWith("/user/") ? next : "/user/dashboard"
                : next?.startsWith("/dashboard") ? next : "/dashboard";
            router.replace(destination);
            router.refresh();
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.email?.[0] ?? unknownError.message);
                return;
            }
            setError("Unable to sign in. Try again.");
        }
    }
    return (<form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormError message={tr(error)}/>
      <div className="space-y-2">
        <Label htmlFor="email">{tr("Email")}</Label>
        <Input autoComplete="email" id="email" placeholder={tr("you@example.com")} {...register("email")}/>
        {errors.email ? (<p className="text-xs text-red-600">{tr(errors.email.message)}</p>) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{tr("Password")}</Label>
        <PasswordInput autoComplete="current-password" id="password" placeholder={tr("Password")} {...register("password")}/>
        {errors.password ? (<p className="text-xs text-red-600">{tr(errors.password.message)}</p>) : null}
      </div>
      <Button className="w-full border-0 bg-[#efbd5d] text-black shadow-[0_10px_30px_rgba(239,189,93,.16)] hover:bg-[#f4c86f]" disabled={isSubmitting} type="submit">
        {isSubmitting ? tr("Signing in...") : tr("Sign in")}
        <ArrowRight className="size-4"/>
      </Button>
    </form>);
}
