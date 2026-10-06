"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/auth/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { registerPublicCustomer } from "@/lib/public";

const schema = z.object({
  first_name: z.string().min(1, "First name is required.").max(255),
  last_name: z.string().min(1, "Last name is required.").max(255),
  phone: z.string().max(255).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
});

type RegisterValues = z.infer<typeof schema>;

function normalizeOptional(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function PublicCustomerRegisterForm({
  businessSlug,
}: {
  businessSlug: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [walletUrl, setWalletUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    setSuccess(null);
    setWalletUrl(null);

    try {
      const response = await registerPublicCustomer(businessSlug, {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        phone: normalizeOptional(values.phone),
        email: normalizeOptional(values.email),
      });

      setSuccess(response.message);
      const nextWalletUrl = response.wallet_url ?? `/wallet/${response.customer.qr_code}`;
      setWalletUrl(nextWalletUrl);

      reset({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
      });

      router.push(nextWalletUrl);
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.first_name?.[0] ??
            unknownError.errors?.last_name?.[0] ??
            unknownError.errors?.phone?.[0] ??
            unknownError.errors?.email?.[0] ??
            unknownError.message,
        );
        return;
      }

      setError("Unable to complete registration right now.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormError message={error} />
      {success ? (
        <Alert className="border-success/30 text-foreground">
          <div className="space-y-2">
            <p>{success}</p>
            {walletUrl ? (
              <a className="text-sm underline" href={walletUrl}>
                Open your wallet
              </a>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          error={errors.first_name?.message}
          registration={register("first_name")}
        />
        <Field
          label="Last name"
          error={errors.last_name?.message}
          registration={register("last_name")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone (optional)"
          error={errors.phone?.message}
          registration={register("phone")}
        />
        <Field
          label="Email (optional)"
          error={errors.email?.message}
          registration={register("email")}
          type="email"
        />
      </div>

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Joining...
          </>
        ) : (
          <>
            Join Loyalty Program
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  type?: string;
  registration: UseFormRegisterReturn;
};

function Field({ label, error, type = "text", registration }: FieldProps) {
  const id = registration.name;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} {...registration} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
