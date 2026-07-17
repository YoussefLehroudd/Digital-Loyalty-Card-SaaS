"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { resetPassword } from "@/lib/auth";

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

const schema = z
  .object({
    token: z.string().min(1, "Reset token is missing."),
    email: z.string().email("Enter a valid email address."),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

type ResetPasswordValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      token: searchParams.get("token") ?? "",
      email: searchParams.get("email") ?? "",
      password: "",
      passwordConfirmation: "",
    },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);

    try {
      await resetPassword({
        token: values.token,
        email: values.email,
        password: values.password,
        password_confirmation: values.passwordConfirmation,
      });

      router.replace("/login");
    } catch (unknownError) {
      if (unknownError instanceof ApiError) {
        setError(
          unknownError.errors?.email?.[0] ??
            unknownError.errors?.password?.[0] ??
            unknownError.message,
        );
        return;
      }

      setError("Unable to reset your password. Try again.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormError message={error} />
      <input type="hidden" {...register("token")} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          type="email"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-red-600">{errors.email.message}</p>
        ) : null}
        {errors.token ? (
          <p className="text-xs text-red-600">{errors.token.message}</p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            autoComplete="new-password"
            id="password"
            type="password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-red-600">{errors.password.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">Confirm password</Label>
          <Input
            autoComplete="new-password"
            id="passwordConfirmation"
            type="password"
            {...register("passwordConfirmation")}
          />
          {errors.passwordConfirmation ? (
            <p className="text-xs text-red-600">
              {errors.passwordConfirmation.message}
            </p>
          ) : null}
        </div>
      </div>
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : "Save new password"}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
