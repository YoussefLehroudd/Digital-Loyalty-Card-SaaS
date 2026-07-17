import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      description="Choose a new password for your business owner account."
      eyebrow="Secure reset"
      footer={
        <Link className="font-medium text-foreground" href="/login">
          Back to sign in
        </Link>
      }
      title="Set a new password"
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
