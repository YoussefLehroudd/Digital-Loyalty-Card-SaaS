import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const joinQuery = new URLSearchParams();
  for (const key of ["join", "join_business_id"]) {
    const value = params[key];
    if (typeof value === "string" && value) joinQuery.set(key, value);
  }
  const context = joinQuery.size ? `?${joinQuery}` : "";
  return (
    <AuthShell
      description="One secure sign-in for customers and businesses. We will take you to the right workspace automatically."
      eyebrow="Welcome back"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link className="font-medium text-foreground" href="/forgot-password">
            Forgot password?
          </Link>
          <span>
            New to LOYVANCE?{" "}
            <Link className="font-medium text-foreground" href={`/register${context}`}>
              Create account
            </Link>
          </span>
        </div>
      }
      title="Sign in to your account"
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
