import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, CreditCard, Gift, Layers3, Menu, Palette, Play, QrCode, Send, Sparkles, Store, Users, Zap, Settings, type LucideIcon } from "lucide-react";
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
          <nav className="hidden items-center gap-3 text-sm text-white/70 md:flex">
            <a href="#home" className="rounded-full border border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55]/55 hover:bg-[#f3bd55]/[.06] hover:text-[#f3bd55] hover:shadow-[0_0_0_1px_rgba(243,189,85,.12),0_0_18px_rgba(243,189,85,.18)] text-[#f3bd55]">Home</a>
            <a href="#features" className="rounded-full border border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55]/55 hover:bg-[#f3bd55]/[.06] hover:text-[#f3bd55] hover:shadow-[0_0_0_1px_rgba(243,189,85,.12),0_0_18px_rgba(243,189,85,.18)]">Features</a>
            <a href="#how" className="rounded-full border border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55]/55 hover:bg-[#f3bd55]/[.06] hover:text-[#f3bd55] hover:shadow-[0_0_0_1px_rgba(243,189,85,.12),0_0_18px_rgba(243,189,85,.18)]">How it works</a>
            <a href="#businesses" className="rounded-full border border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55]/55 hover:bg-[#f3bd55]/[.06] hover:text-[#f3bd55] hover:shadow-[0_0_0_1px_rgba(243,189,85,.12),0_0_18px_rgba(243,189,85,.18)]">Businesses</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
            <Button asChild className="bg-[#f3bd55] text-black hover:bg-[#ffd16f]"><Link href="/register">Create account <ArrowRight className="size-4"/></Link></Button>
            <Button variant="ghost" size="icon" className="md:hidden"><Menu className="size-5"/></Button>
          </div>
        </div>
      </header>

      <section id="home" className="relative min-h-[720px] pt-20 sm:min-h-[740px] lg:min-h-[700px]">
        <div className="absolute inset-0">
          <Image src="/brand/Expérience café et fidélité dorée.png" alt="" fill priority quality={100} sizes="100vw" className="object-cover object-top opacity-80 sm:object-[62%_top] lg:object-center"/>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,7,.18)_0%,rgba(7,8,7,.28)_42%,#070807_78%,#070807_100%)] sm:bg-[linear-gradient(90deg,#070807_0%,rgba(7,8,7,.82)_35%,rgba(7,8,7,.25)_68%,rgba(7,8,7,.62)_100%)]"/>
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#070807] via-[#070807]/80 to-transparent sm:h-48"/>
        </div>
        <div className="relative mx-auto flex min-h-[640px] max-w-7xl items-end px-5 pb-12 pt-20 sm:min-h-[660px] sm:items-center sm:pb-0 sm:pt-0 lg:min-h-[620px] lg:px-8">
          <div className="max-w-[610px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#f3bd55]/45 bg-black/55 px-4 py-2 text-xs font-bold text-[#f3bd55] shadow-[0_0_20px_rgba(243,189,85,.12)] backdrop-blur"><Sparkles className="size-4"/> Modern Loyalty Platform</div>
            <h1 className="text-5xl font-black leading-[1.02] tracking-[-.045em] drop-shadow-[0_3px_14px_rgba(0,0,0,.65)] sm:text-6xl lg:text-7xl">Turn your customers into <span className="text-[#f3bd55]">loyal fans.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] sm:text-lg">Create digital loyalty cards, rewards, and personalized experiences for your business. Easy, fast, and professional.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-14 rounded-xl border border-[#ffd36d] bg-[#f3bd55] px-8 font-bold text-black shadow-[0_0_24px_rgba(243,189,85,.34),inset_0_1px_0_rgba(255,255,255,.4)] hover:bg-[#ffd16f]"><Link href="/register">Create your free account <ArrowRight className="size-4"/></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-xl border-[#f3bd55]/25 bg-black/55 px-7 font-semibold text-white shadow-[0_0_20px_rgba(0,0,0,.25)] backdrop-blur hover:border-[#f3bd55]/55 hover:bg-black/70"><a href="#how"><span className="mr-2 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#f3bd55]/80 bg-[#f3bd55]/10 text-[#f3bd55] shadow-[0_0_12px_rgba(243,189,85,.18)]"><Play className="size-4 fill-[#f3bd55] stroke-[2.2]"/></span>See how it works</a></Button>
            </div>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {([[Settings,"No technical skills required"],[Zap,"Quick setup in minutes"],[Layers3,"Everything in one platform"]] as Array<[LucideIcon,string]>).map(([Icon,label])=><div key={label} className="flex min-h-[68px] items-center gap-3 rounded-xl border border-[#e7b354]/20 bg-black/55 px-3 py-3 text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-md"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#f3bd55]/35 bg-[#f3bd55]/10 text-[#f3bd55] shadow-[0_0_14px_rgba(243,189,85,.12)]"><Icon className="size-5"/></span><span className="leading-4">{label}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="businesses" className="relative isolate overflow-hidden border-y border-white/10 bg-[#090a09] py-16">
        <Image src="/brand/Lobbу futuriste noir et or.png" alt="" fill quality={100} className="-z-20 object-cover object-center opacity-70"/>
        <div className="absolute inset-0 -z-10 bg-black/45"/>
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="mb-10 text-center text-2xl font-bold tracking-[-.02em] text-white sm:text-3xl">Perfect for <span className="text-[#f3bd55]">any type of business</span></p>
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

      <section id="how" className="relative isolate overflow-hidden py-24">
        <Image src="/brand/Arrière-plan doré futuriste avec cartes élégantes.png" alt="" fill quality={100} sizes="100vw" className="-z-20 object-cover object-center"/>
        <div className="absolute inset-0 -z-10 bg-black/35"/>
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f3bd55]/45 bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[.12em] text-[#f3bd55] shadow-[0_0_18px_rgba(243,189,85,.14)] backdrop-blur"><QrCode className="size-4"/> How it works</div>
            <h2 className="mt-5 text-4xl font-black tracking-[-.035em] sm:text-5xl">Get started in <span className="text-[#f3bd55]">3 simple steps</span></h2>
            <p className="mt-3 text-base text-white/65 sm:text-lg">Launch your digital loyalty program in minutes.</p>
          </div>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-11">
            {([[1,Users,"Create your account","Sign up and set up your business in a few clicks."],[2,Palette,"Customize your loyalty card","Add your logo, colors, and rewards that fit your business."],[3,Send,"Share with your customers","Let customers scan, collect stamps, and get rewarded."]] as Array<[number, LucideIcon, string, string]>).map(([n,I,t,d],idx)=><div key={n} className="group relative flex min-h-[250px] flex-col items-center justify-center overflow-visible rounded-2xl border border-[#f3bd55]/70 bg-black/55 px-7 py-8 text-center shadow-[inset_0_0_42px_rgba(243,189,85,.075),0_0_18px_rgba(243,189,85,.12),0_15px_50px_rgba(0,0,0,.3)] backdrop-blur-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ffd56f] before:to-transparent before:shadow-[0_0_14px_3px_rgba(243,189,85,.48)] before:animate-pulse after:absolute after:-left-10 after:-top-10 after:h-28 after:w-28 after:rounded-full after:bg-[#f3bd55]/10 after:blur-2xl">
              <div className="absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-[#ffd15c]/80 bg-[radial-gradient(circle_at_38%_32%,#8a621b_0%,#4a340d_46%,#241805_100%)] text-lg font-bold text-[#ffd15c] shadow-[0_0_10px_2px_rgba(243,189,85,.48),0_0_28px_rgba(243,189,85,.32),inset_0_0_12px_rgba(255,211,100,.16)] before:absolute before:-inset-2 before:-z-10 before:rounded-full before:bg-[#f3bd55]/15 before:blur-md before:animate-pulse">{n}</div>
              <div className="flex size-20 items-center justify-center rounded-full border border-[#f3bd55]/55 bg-[#f3bd55]/10 text-[#f3bd55] shadow-[inset_0_0_18px_rgba(243,189,85,.08),0_0_20px_rgba(243,189,85,.18)] transition-all duration-700 group-hover:border-[#ffd66f]/90 group-hover:shadow-[inset_0_0_20px_rgba(243,189,85,.12),0_0_30px_rgba(243,189,85,.38)]"><I className="size-9 stroke-[1.8]"/></div>
              <h3 className="mt-6 text-lg font-bold">{t}</h3>
              <p className="mt-2 max-w-[280px] text-sm leading-6 text-white/65">{d}</p>
              {idx < 2 && <div className="pointer-events-none absolute -right-[36px] top-1/2 z-20 hidden -translate-y-1/2 items-center md:flex"><span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3bd55]/20 blur-xl animate-pulse"/><ArrowRight className="relative size-8 text-[#ffd15c] drop-shadow-[0_0_8px_rgba(243,189,85,.9)] animate-pulse"/></div>}
            </div>)}
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

      <section className="relative isolate overflow-hidden px-5 py-24">
        <Image src="/brand/Rubans dorés sur fond noir luxueux.png" alt="" fill quality={100} sizes="100vw" className="-z-20 object-cover object-center"/>
        <div className="absolute inset-0 -z-10 bg-black/20"/>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 overflow-hidden rounded-[32px] border border-[#f3bd55]/40 bg-black/25 p-8 shadow-[0_0_70px_rgba(243,189,85,.08)] backdrop-blur-[2px] md:flex-row md:p-12">
          <div><div className="flex size-14 items-center justify-center rounded-2xl bg-[#f3bd55]/15 text-[#f3bd55]"><BarChart3/></div><h2 className="mt-5 text-3xl font-bold">Ready to grow your business <span className="text-[#f3bd55]">with loyalty?</span></h2><p className="mt-3 max-w-xl text-white/50">Create your account today and start building stronger customer relationships.</p></div>
          <div className="shrink-0 text-center"><Button asChild size="lg" className="h-14 bg-[#f3bd55] px-8 font-bold text-black hover:bg-[#ffd16f]"><Link href="/register">Create your free account <ArrowRight className="size-4"/></Link></Button><p className="mt-3 text-xs text-white/35">Setup in minutes</p></div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 text-sm text-white/35 sm:flex-row lg:px-8"><span>© LOYVANCE. Digital loyalty, made simple.</span><div className="flex gap-6"><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></div></div></footer>
    </main>
  );
}
