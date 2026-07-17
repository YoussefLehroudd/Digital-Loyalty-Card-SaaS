import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      description="Access your business workspace, scanner flows, and protected loyalty tools."
      eyebrow="Welcome back"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link className="font-medium text-foreground" href="/forgot-password">
            Forgot password?
          </Link>
          <span>
            New workspace?{" "}
            <Link className="font-medium text-foreground" href="/register">
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
