import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      description="Create a customer account to collect rewards, or launch a business loyalty workspace."
      eyebrow="Join LOYVANCE"
      footer={
        <span>
          Already have an account?{" "}
          <Link className="font-medium text-foreground" href="/login">
            Sign in
          </Link>
        </span>
      }
      title="Create your account"
    >
      <RegisterForm />
    </AuthShell>
  );
}
