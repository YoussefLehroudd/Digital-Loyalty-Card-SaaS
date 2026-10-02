import { CreditCard, ShieldCheck, Sparkles, Stamp } from "lucide-react";

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
        className="pointer-events-none absolute inset-0 bg-cover bg-[position:42%_center] bg-no-repeat opacity-[0.72] sm:bg-[position:40%_center] lg:bg-[position:38%_center]"
        style={{ backgroundImage: "url('/brand/Application%20de%20fid%C3%A9lit%C3%A9%20dor%C3%A9e%20et%20%C3%A9l%C3%A9gante.png')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,11,.48)_0%,rgba(8,10,11,.34)_45%,rgba(8,10,11,.46)_100%)] max-lg:bg-[rgba(8,10,11,.52)]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <section className="grid min-h-[calc(100vh-5rem)] items-center gap-10 py-8 lg:grid-cols-[1.05fr_.95fr] lg:py-6">
          <div className="max-w-[600px] lg:-translate-x-3 lg:rounded-[28px] lg:border lg:border-white/[0.07] lg:bg-black/25 lg:p-6 lg:shadow-[0_24px_70px_rgba(0,0,0,.20)] lg:backdrop-blur-[2px]">
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
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-3.5 shadow-[0_12px_35px_rgba(0,0,0,.14)] backdrop-blur-[3px]" key={itemTitle}>
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

          <div className="relative lg:translate-x-3">
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#d29b3d]/10 blur-3xl" />
            <div className="relative w-full rounded-[24px] border border-[#d4a24a]/30 bg-[#0d0f10]/60 p-6 shadow-[0_30px_90px_rgba(0,0,0,.38)] backdrop-blur-md sm:p-8">
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
