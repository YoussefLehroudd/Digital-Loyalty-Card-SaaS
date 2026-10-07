import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const joinQuery = new URLSearchParams();
  for (const key of ["join", "join_business_id"]) {
    const value = params[key];
    if (typeof value === "string" && value) joinQuery.set(key, value);
  }
  const context = joinQuery.size ? `?${joinQuery}` : "";
  return (
    <AuthShell
      description="Create a customer account to collect rewards, or launch a business loyalty workspace."
      eyebrow="Join LOYVANCE"
      footer={
        <span>
          Already have an account?{" "}
          <Link className="font-medium text-foreground" href={`/login${context}`}>
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
