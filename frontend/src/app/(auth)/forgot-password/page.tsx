import { LocalizedText } from "@/components/i18n/language-provider";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
export default function ForgotPasswordPage() {
    return (<AuthShell description="Enter the email linked to your LOYVANCE account." eyebrow="Password recovery" footer={<Link className="font-medium text-foreground" href="/login"><LocalizedText text=" Back to sign in "/></Link>} title="Reset your password">
      <ForgotPasswordForm />
    </AuthShell>);
}
