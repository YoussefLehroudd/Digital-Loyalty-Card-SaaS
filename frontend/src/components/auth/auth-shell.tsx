import Image from "next/image";
import Link from "next/link";
import { CreditCard, Gift, QrCode, ShieldCheck, Sparkles, Stamp } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  const features = [
    { icon: CreditCard, title: "One secure account for customers and businesses", text: "Access your cards or manage your business, with one login." },
    { icon: Stamp, title: "Loyalty cards, stamps, rewards, and business tools", text: "Everything you need in one platform." },
    { icon: ShieldCheck, title: "Automatic access to the right workspace", text: "We’ll take you to the right dashboard automatically." },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080a0b] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-45"
        style={{ backgroundImage: "url('/brand/Application%20de%20fid%C3%A9lit%C3%A9%20dor%C3%A9e%20et%20%C3%A9l%C3%A9gante.png')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,11,.80)_0%,rgba(8,10,11,.62)_45%,rgba(8,10,11,.76)_100%)]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 size-[560px] rounded-full bg-[#c68a2b]/20 blur-[110px]" />
        <div className="absolute -bottom-56 right-[-80px] size-[620px] rounded-full bg-[#f1b84a]/15 blur-[120px]" />
        <div className="absolute left-[58%] top-[-260px] h-[700px] w-[700px] rounded-full border border-[#c9953d]/15" />
        <div className="absolute right-[-90px] top-16 rotate-[-10deg] rounded-[30px] border border-[#d8a342]/30 bg-gradient-to-br from-[#d9a74b]/25 to-[#111]/30 p-7 shadow-2xl backdrop-blur-sm">
          <Gift className="size-16 text-[#e6b557]/60" />
        </div>
        <div className="absolute bottom-20 left-[-30px] rotate-[12deg] rounded-[28px] border border-[#d8a342]/25 bg-black/30 p-6 backdrop-blur-sm">
          <QrCode className="size-20 text-[#efbd5d]/50" />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <Link className="inline-flex items-center gap-4" href="/">
          <div className="relative flex size-[74px] items-center justify-center rounded-2xl border border-[#d4a24a]/25 bg-white/[0.04] shadow-[0_18px_50px_rgba(0,0,0,.35)]">
            <Image alt="LOYVANCE logo" className="object-contain p-1" fill priority sizes="74px" src="/brand/logo.png" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">LOYVANCE</p>
            <p className="text-sm text-white/60">Loyalty for everyone</p>
          </div>
        </Link>

        <section className="grid min-h-[calc(100vh-10rem)] items-center gap-12 py-12 lg:grid-cols-[1.08fr_.92fr]">
          <div className="max-w-[620px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Sparkles className="size-3.5" /> Multi-tenant loyalty SaaS
            </div>
            <h1 className="max-w-[600px] text-4xl font-bold leading-[1.08] tracking-[-.035em] sm:text-5xl">
              Digital loyalty for <span className="text-[#efbd5d]">customers and businesses.</span>
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-white/65">
              Sign in to access your loyalty cards, stamps, rewards, and business tools — all in one secure account.
            </p>

            <div className="mt-9 grid gap-3">
              {features.map(({ icon: Icon, title: itemTitle, text }) => (
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 shadow-[0_12px_35px_rgba(0,0,0,.18)] backdrop-blur-md" key={itemTitle}>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#e7b354]/15 bg-[#d8a342]/15 text-[#f0bd5a]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/95">{itemTitle}</p>
                    <p className="mt-1 text-xs text-white/45">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#d29b3d]/10 blur-3xl" />
            <div className="relative w-full rounded-[24px] border border-[#d4a24a]/25 bg-[#111315]/85 p-6 shadow-[0_30px_90px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-8">
              <div className="mb-7 space-y-2">
                <p className="text-sm font-semibold text-[#efbd5d]">{eyebrow}</p>
                <h2 className="text-3xl font-bold tracking-[-.025em]">{title}</h2>
                <p className="max-w-md text-sm leading-6 text-white/60">{description}</p>
              </div>
              {children}
              <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/55">{footer}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
