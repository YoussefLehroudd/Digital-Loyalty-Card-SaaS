"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { registerBusinessOwner, storeToken } from "@/lib/auth";
import { customerRegister, storeCustomerToken } from "@/lib/customerAuth";

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

const schema = z
  .object({
    businessName: z.string().min(2, "Enter your business name."),
    businessEmail: z.string().email("Enter a valid business email."),
    name: z.string().min(2, "Enter your name."),
    email: z.string().email("Enter a valid owner email."),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

type RegisterValues = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accountType, setAccountType] = useState<"customer" | "business">("customer");
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: "",
      businessEmail: "",
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);

    try {
      if (accountType === "customer") {
        const nameParts = values.name.trim().split(/\\s+/);
        const firstName = nameParts.shift() || values.name.trim();
        const lastName = nameParts.join(" ") || "-";
        const response = await customerRegister({
          first_name: firstName,
          last_name: lastName,
          email: values.email,
          password: values.password,
          password_confirmation: values.passwordConfirmation,
          device_name: "web-unified-register",
        });
        storeCustomerToken(response.token);
        const join = searchParams.get("join");
        const joinBusinessId = searchParams.get("join_business_id");
        router.replace(join ? `/user/join?auto=${encodeURIComponent(join)}` : joinBusinessId ? `/user/join?auto_business_id=${encodeURIComponent(joinBusinessId)}` : "/user/dashboard");
        router.refresh();
        return;
      }

      const response = await registerBusinessOwner({
        business_name: values.businessName,
        business_email: values.businessEmail,
        name: values.name,
        email: values.email,
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      });

      storeToken(response.token);
      router.replace("/dashboard");
      router.refresh();
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.email?.[0] ??
            unknownError.errors?.business_email?.[0] ??
            unknownError.message,
        );
        return;
      }

      setError("Unable to create your workspace. Try again.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => setAccountType("customer")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${accountType === "customer" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><UserRound className="size-4" />Customer</button>
        <button type="button" onClick={() => setAccountType("business")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${accountType === "business" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Building2 className="size-4" />Business</button>
      </div>
      {accountType === "business" ? <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.businessName?.message}
          label="Business name"
          registration={register("businessName")}
        />
        <Field
          error={errors.businessEmail?.message}
          label="Business email"
          registration={register("businessEmail")}
          type="email"
        />
      </div> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.name?.message}
          label={accountType === "business" ? "Owner name" : "Full name"}
          registration={register("name")}
        />
        <Field
          error={errors.email?.message}
          label="Owner email"
          registration={register("email")}
          type="email"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.password?.message}
          label="Password"
          registration={register("password")}
          type="password"
        />
        <Field
          error={errors.passwordConfirmation?.message}
          label="Confirm password"
          registration={register("passwordConfirmation")}
          type="password"
        />
      </div>
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account..." : accountType === "business" ? "Create business account" : "Create customer account"}
        <ArrowRight className="size-4" />
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
      {type === "password" ? (
        <PasswordInput id={id} {...registration} />
      ) : (
        <Input id={id} type={type} {...registration} />
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
