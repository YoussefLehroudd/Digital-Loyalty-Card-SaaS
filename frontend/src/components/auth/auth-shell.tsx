import Link from "next/link";
import { CreditCard, ShieldCheck, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">
              Digital Loyalty
            </p>
            <p className="text-xs text-muted-foreground">Business access</p>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <div className="hidden max-w-xl space-y-8 lg:block">
          <Badge className="border-success/30 bg-secondary text-secondary-foreground">
            <Sparkles className="mr-1 size-3" />
            Multi-tenant loyalty SaaS
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight">
              Branded loyalty cards, secure owner access, and QR-ready
              operations.
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Sign in to manage the customer experience behind every stamp,
              visit, and reward.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              "Tenant-aware business owner accounts",
              "Protected workspaces for business teams",
              "Password recovery for returning owners",
            ].map((item) => (
              <div
                className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm"
                key={item}
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
          <div className="mt-6 border-t pt-5 text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
