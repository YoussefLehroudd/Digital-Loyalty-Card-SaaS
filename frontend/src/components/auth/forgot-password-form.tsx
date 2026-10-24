"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/auth/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/auth";
import { useAutoDismiss } from "@/lib/use-auto-dismiss";
const schema = z.object({
    email: z.string().email("Enter a valid email address."),
});
type ForgotPasswordValues = z.infer<typeof schema>;
export function ForgotPasswordForm() {
    const { t: tr } = useI18n();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const clearSuccess = useCallback(() => {
        setSuccess(null);
    }, []);
    useAutoDismiss(success, clearSuccess);
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm<ForgotPasswordValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
        },
    });
    async function onSubmit(values: ForgotPasswordValues) {
        setError(null);
        setSuccess(null);
        try {
            const response = await forgotPassword(values);
            setSuccess(response.message);
        }
        catch (unknownError) {
            if (unknownError instanceof ApiError) {
                setError(unknownError.errors?.email?.[0] ?? unknownError.message);
                return;
            }
            setError("Unable to send a reset link. Try again.");
        }
    }
    return (<form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormError message={tr(error)}/>
      {success ? (<Alert className="border-success/30 text-foreground">{tr(success)}</Alert>) : null}
      <div className="space-y-2">
        <Label htmlFor="email">{tr("Email")}</Label>
        <Input autoComplete="email" id="email" placeholder={tr("owner@business.com")} type="email" {...register("email")}/>
        {errors.email ? (<p className="text-xs text-red-600">{tr(errors.email.message)}</p>) : null}
      </div>
      <Button className="w-full border-0 bg-[#efbd5d] font-semibold text-black shadow-[0_10px_30px_rgba(239,189,93,.16)] hover:bg-[#f4c86f]" disabled={isSubmitting} type="submit">
        {isSubmitting ? tr("Sending...") : tr("Send reset link")}
        <Mail className="size-4"/>
      </Button>
    </form>);
}
