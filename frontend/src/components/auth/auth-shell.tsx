type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080a0b] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.82]"
        style={{ backgroundImage: "url('/brand/Application%20de%20fid%C3%A9lit%C3%A9%20dor%C3%A9e%20et%20%C3%A9l%C3%A9gante.png')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/20" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:justify-end lg:px-[7vw]">
        <div className="relative w-full max-w-[470px]">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#d29b3d]/10 blur-3xl" />
          <div className="relative w-full rounded-[26px] border border-[#d4a24a]/35 bg-[#0b0d0e]/72 p-6 shadow-[0_30px_90px_rgba(0,0,0,.45)] backdrop-blur-lg sm:p-8">
            <div className="mb-7 space-y-2">
              <p className="text-sm font-semibold text-[#efbd5d]">{eyebrow}</p>
              <h2 className="text-3xl font-bold tracking-[-.025em]">{title}</h2>
              <p className="max-w-md text-sm leading-6 text-white/60">{description}</p>
            </div>
            {children}
            <div className="mt-6 border-t border-white/10 pt-5 text-sm text-white/55">{footer}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
