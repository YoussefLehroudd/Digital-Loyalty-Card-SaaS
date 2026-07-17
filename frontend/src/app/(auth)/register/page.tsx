import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      description="Create the business tenant and first owner account for your loyalty workspace."
      eyebrow="Start your workspace"
      footer={
        <span>
          Already have an account?{" "}
          <Link className="font-medium text-foreground" href="/login">
            Sign in
          </Link>
        </span>
      }
      title="Create your business account"
    >
      <RegisterForm />
    </AuthShell>
  );
}
