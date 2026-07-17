"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { registerBusinessOwner, storeToken } from "@/lib/auth";

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
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors.name?.message}
          label="Owner name"
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
        {isSubmitting ? "Creating workspace..." : "Create workspace"}
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
      <Input id={id} type={type} {...registration} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
