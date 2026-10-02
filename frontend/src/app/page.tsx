import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, Check, CreditCard, Gift, Menu, Palette, QrCode, Sparkles, Store, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const businesses = [
  ["Restaurants","/brand/Restaurant chic aux accents dorés.png"],
  ["Cafés","/brand/Café doré au latte artistique.png"],
  ["Retail Stores","/brand/Boutique de luxe illuminée en doré.png"],
  ["Beauty & Wellness","/brand/Beauté et bien-être au spa de luxe.png"],
  ["Hotels","/brand/Hall de réception d’hôtel luxueux.png"],
  ["Gyms & Fitness","/brand/Salle de sport moderne aux néons dorés.png"],
];

const features: Array<[LucideIcon, string, string]> = [
  [CreditCard,"Digital Loyalty Cards","Create branded digital cards with QR codes."],
  [Gift,"Stamps & Rewards","Set custom rewards and incentives."],
  [Users,"Customer Management","Track customers and their activity."],
  [BarChart3,"Analytics & Insights","See what works and grow faster."],
  [Store,"Multi-location Support","Manage multiple branches easily."],
  [Palette,"Custom Branding","Use your logo, colors, and style."],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070807] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative size-12 overflow-hidden rounded-xl border border-[#e7b354]/30 bg-black"><Image src="/brand/logo.png" alt="LOYVANCE" fill className="object-contain" /></div>
            <div><div className="font-bold tracking-wide">LOYVANCE</div><div className="text-xs text-white/45">Loyalty Platform</div></div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            <a href="#home" className="text-[#f3bd55]">Home</a><a href="#features">Features</a><a href="#how">How it works</a><a href="#businesses">Businesses</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
            <Button asChild className="bg-[#f3bd55] text-black hover:bg-[#ffd16f]"><Link href="/register">Create account <ArrowRight className="size-4"/></Link></Button>
            <Button variant="ghost" size="icon" className="md:hidden"><Menu className="size-5"/></Button>
          </div>
        </div>
      </header>

      <section id="home" className="relative min-h-[760px] pt-20">
        <div className="absolute inset-0">
          <Image src="/brand/Expérience café et fidélité dorée.png" alt="" fill priority quality={100} className="object-contain object-top opacity-80"/>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#070807_0%,rgba(7,8,7,.82)_35%,rgba(7,8,7,.25)_68%,rgba(7,8,7,.62)_100%)]"/>
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#070807] to-transparent"/>
        </div>
        <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-5 lg:px-8">
          <div className="max-w-[610px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e7b354]/30 bg-black/45 px-4 py-2 text-xs font-semibold text-[#f3bd55] backdrop-blur"><Sparkles className="size-4"/> Modern Loyalty Platform</div>
            <h1 className="text-5xl font-black leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-7xl">Turn your customers into <span className="text-[#f3bd55]">loyal fans.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg">Create digital loyalty cards, rewards, and personalized experiences for your business. Easy, fast, and professional.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-[52px] bg-[#f3bd55] px-7 font-bold text-black shadow-[0_0_35px_rgba(243,189,85,.25)] hover:bg-[#ffd16f]"><Link href="/register">Create your free account <ArrowRight className="size-4"/></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-[52px] border-white/15 bg-black/30 px-7 backdrop-blur"><a href="#how">See how it works</a></Button>
            </div>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {["No technical skills required","Quick setup in minutes","Everything in one platform"].map((x)=><div key={x} className="rounded-xl border border-[#e7b354]/20 bg-black/45 p-3 text-xs font-medium backdrop-blur-md"><Check className="mb-2 size-4 text-[#f3bd55]"/>{x}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="businesses" className="relative isolate overflow-hidden border-y border-white/10 bg-[#090a09] py-16">
        <Image src="/brand/Lobbу futuriste noir et or.png" alt="" fill quality={100} className="-z-20 object-cover object-center opacity-70"/>
        <div className="absolute inset-0 -z-10 bg-black/45"/>
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="mb-8 text-center text-sm text-white/45">Perfect for any type of business</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map(([name,img])=><div key={name} className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#e7b354]/25 bg-[#111] shadow-[0_18px_50px_rgba(0,0,0,.32)]">
              <Image
                src={img}
                alt={name}
                fill
                sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                className="object-cover object-center transition duration-500 group-hover:scale-[1.025]"
                quality={100}
              />
            </div>)}
          </div>
        </div>
      </section>

      <section id="how" className="relative py-24">
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="text-center"><div className="text-xs font-bold uppercase tracking-[.2em] text-[#f3bd55]">How it works</div><h2 className="mt-4 text-4xl font-bold">Get started in <span className="text-[#f3bd55]">3 simple steps</span></h2><p className="mt-3 text-white/50">Launch your digital loyalty program in minutes.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {([[1,Building2,"Create your account","Sign up and set up your business in a few clicks."],[2,Palette,"Customize your loyalty card","Add your logo, colors, and rewards that fit your business."],[3,QrCode,"Share with your customers","Let customers scan, collect stamps, and get rewarded."]] as Array<[number, LucideIcon, string, string]>).map(([n,I,t,d])=><div key={n} className="relative rounded-3xl border border-[#e7b354]/20 bg-[#10110f] p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,.3)]"><div className="absolute left-5 top-5 flex size-9 items-center justify-center rounded-full border border-[#f3bd55]/50 bg-[#30240f] font-bold text-[#f3bd55]">{n}</div><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#f3bd55]/10 text-[#f3bd55]"><I className="size-7"/></div><h3 className="mt-6 font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-white/50">{d}</p></div>)}
          </div>
        </div>
      </section>

      <section id="features" className="relative isolate overflow-hidden border-y border-white/10 bg-[#090a09] py-24">
        <Image src="/brand/Café de luxe et fidélité dorée.png" alt="" fill quality={100} className="-z-20 object-cover object-center"/>
        <div className="absolute inset-0 -z-10 bg-black/50"/>
        <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="hidden lg:block" />
          <div className="flex flex-col justify-center">
            <div className="text-xs font-bold uppercase tracking-[.2em] text-[#f3bd55]">Powerful features</div>
            <h2 className="mt-4 max-w-xl text-4xl font-bold leading-tight">Everything you need to <span className="text-[#f3bd55]">grow your business.</span></h2>
            <p className="mt-4 text-white/50">A complete loyalty solution designed for modern businesses.</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">{features.map(([I,t,d])=><div key={t} className="rounded-2xl border border-white/10 bg-[#111210] p-5"><div className="flex size-11 items-center justify-center rounded-xl bg-[#f3bd55]/10 text-[#f3bd55]"><I className="size-5"/></div><h3 className="mt-4 text-sm font-bold">{t}</h3><p className="mt-2 text-xs leading-5 text-white/45">{d}</p></div>)}</div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 overflow-hidden rounded-[32px] border border-[#f3bd55]/40 bg-[radial-gradient(circle_at_15%_50%,rgba(243,189,85,.17),transparent_30%),#11100d] p-8 shadow-[0_0_70px_rgba(243,189,85,.08)] md:flex-row md:p-12">
          <div><div className="flex size-14 items-center justify-center rounded-2xl bg-[#f3bd55]/15 text-[#f3bd55]"><BarChart3/></div><h2 className="mt-5 text-3xl font-bold">Ready to grow your business <span className="text-[#f3bd55]">with loyalty?</span></h2><p className="mt-3 max-w-xl text-white/50">Create your account today and start building stronger customer relationships.</p></div>
          <div className="shrink-0 text-center"><Button asChild size="lg" className="h-14 bg-[#f3bd55] px-8 font-bold text-black hover:bg-[#ffd16f]"><Link href="/register">Create your free account <ArrowRight className="size-4"/></Link></Button><p className="mt-3 text-xs text-white/35">Setup in minutes</p></div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 text-sm text-white/35 sm:flex-row lg:px-8"><span>© LOYVANCE. Digital loyalty, made simple.</span><div className="flex gap-6"><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></div></div></footer>
    </main>
  );
}
