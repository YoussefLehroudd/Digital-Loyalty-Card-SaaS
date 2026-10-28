"use client";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n, translate } from "@/components/i18n/language-provider";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Building2, CreditCard, Gift, Layers3, Menu, Palette, Play, QrCode, Send, Sparkles, Store, Users, Zap, Settings, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingHome({ locale: initialLocale = "en" }: { locale?: "en" | "fr" | "ar" }) {
  const { language, ready } = useI18n();
  const locale = ready ? language : initialLocale;
  const t = (value: string) => translate(value, locale);
const businesses = [
  [t("Restaurants"),"/brand/Restaurant chic aux accents dorés.png"],
  [t("Cafés"),"/brand/Café doré au latte artistique.png"],
  [t("Retail Stores"),"/brand/Boutique de luxe illuminée en doré.png"],
  [t("Beauty & Wellness"),"/brand/Beauté et bien-être au spa de luxe.png"],
  [t("Hotels"),"/brand/Hall de réception d’hôtel luxueux.png"],
  [t("Gyms & Fitness"),"/brand/Salle de sport moderne aux néons dorés.png"],
];

const features: Array<[LucideIcon, string, string]> = [
  [Layers3,t("Digital Loyalty Cards"),t("Create branded digital cards with QR codes.")],
  [Gift,t("Stamps & Rewards"),t("Set custom rewards and incentives.")],
  [Users,t("Customer Management"),t("Track customers and their activity.")],
  [BarChart3,t("Analytics & Insights"),t("See what works and grow faster.")],
  [Store,t("Multi-location Support"),t("Manage multiple branches easily.")],
  [Palette,t("Custom Branding"),t("Use your logo, colors, and style.")],
];


  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Existing PWA installations still launch '/'. Recover their authenticated
  // workspace without changing the ordinary marketing website.
  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches||
      Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
    if(standalone)window.location.replace("/app");
  },[]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeMenu = () => setMobileMenuOpen(false);
    window.addEventListener("scroll", closeMenu, { passive: true });
    window.addEventListener("touchmove", closeMenu, { passive: true });
    return () => {
      window.removeEventListener("scroll", closeMenu);
      window.removeEventListener("touchmove", closeMenu);
    };
  }, [mobileMenuOpen]);

  return (
    <main lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen overflow-hidden bg-[#070807] text-white">
      <header className="app-topbar fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="relative mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-2 px-4 sm:h-20 sm:px-5 lg:px-8">
          <Link href={locale === "en" ? "/" : `/${locale}`} className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative size-10 shrink-0 sm:size-12"><Image src="/brand/logo.png" alt="LOYVANCE" fill className="object-contain" /></div>
            <div className="min-w-0"><div className="truncate text-sm font-bold tracking-wide sm:text-base">LOYVANCE</div><div className="hidden text-xs text-white/45 min-[390px]:block">{t("Loyalty Platform")}</div></div>
          </Link>
          <nav className="hidden items-center gap-3 text-sm text-white/70 lg:flex">
            <a href="#home" className="rounded-full border-2 border-[#f3bd55] bg-[#f3bd55]/[.04] px-4 py-2 text-[#f3bd55] shadow-[0_0_10px_rgba(243,189,85,.18)] transition-all duration-300">{t("Home")}</a>
            <a href="#features" className="rounded-full border-2 border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55] hover:bg-[#f3bd55]/[.04] hover:text-[#f3bd55] hover:shadow-[0_0_10px_rgba(243,189,85,.18)]">{t("Features")}</a>
            <a href="#how" className="rounded-full border-2 border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55] hover:bg-[#f3bd55]/[.04] hover:text-[#f3bd55] hover:shadow-[0_0_10px_rgba(243,189,85,.18)]">{t("How it works")}</a>
            <a href="#businesses" className="rounded-full border-2 border-transparent px-4 py-2 transition-all duration-300 hover:border-[#f3bd55] hover:bg-[#f3bd55]/[.04] hover:text-[#f3bd55] hover:shadow-[0_0_10px_rgba(243,189,85,.18)]">{t("Businesses")}</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/login">{t("Sign in")}</Link></Button>
            <Button asChild className="hidden bg-[#f3bd55] text-black hover:bg-[#ffd16f] min-[390px]:inline-flex sm:px-4"><Link href="/register"><span className="hidden min-[430px]:inline">{t("Create account")}</span><span className="min-[430px]:hidden">{t("Join")}</span> <ArrowRight className="size-4"/></Link></Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={mobileMenuOpen ? t("Close navigation menu") : t("Open navigation menu")}
              aria-expanded={mobileMenuOpen}
              className="size-11 shrink-0 lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu className="size-6"/>
            </Button>
          </div>
          {mobileMenuOpen ? (
            <div className="absolute start-4 end-4 top-[78px] z-[60] overflow-hidden rounded-2xl border border-[#f3bd55]/25 bg-[#090a08]/[.98] p-2 shadow-[0_18px_55px_rgba(0,0,0,.6)] backdrop-blur-xl lg:hidden">
              <nav className="grid gap-1 text-sm font-semibold text-white/80">
                <a href="#home" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#f3bd55]/10 hover:text-[#f3bd55]">{t("Home")}</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#f3bd55]/10 hover:text-[#f3bd55]">{t("Features")}</a>
                <a href="#how" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#f3bd55]/10 hover:text-[#f3bd55]">{t("How it works")}</a>
                <a href="#businesses" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#f3bd55]/10 hover:text-[#f3bd55]">{t("Businesses")}</a>
                <div className="mt-1 grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
                  <Button asChild variant="outline" className="border-white/15 bg-transparent"><Link href="/login" onClick={() => setMobileMenuOpen(false)}>{t("Sign in")}</Link></Button>
                  <Button asChild className="bg-[#f3bd55] text-black hover:bg-[#ffd16f]"><Link href="/register" onClick={() => setMobileMenuOpen(false)}>{t("Create account")}</Link></Button>
                </div>
              </nav>
            </div>
          ) : null}
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
            <div className="mb-5 gold-flow-border inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(180deg,rgba(31,24,10,.88),rgba(8,8,7,.92))] px-5 py-2.5 text-xs font-extrabold uppercase tracking-[.08em] text-[#f5c34f] backdrop-blur"><Sparkles className="size-4"/> {t("Modern Loyalty Platform")}</div>
            <h1 className="text-5xl font-black leading-[1.02] tracking-[-.045em] drop-shadow-[0_3px_14px_rgba(0,0,0,.65)] sm:text-6xl lg:text-7xl">{t("Turn your customers into")} <span className="text-[#f3bd55]">{t("loyal fans.")}</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] sm:text-lg">{t("Create digital loyalty cards with QR codes for your coffee shop, restaurant, retail store or salon. Customize stamps and rewards for your business.")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-14 rounded-xl border border-[#ffd36d] bg-[#f3bd55] px-8 font-bold text-black shadow-[0_0_24px_rgba(243,189,85,.34),inset_0_1px_0_rgba(255,255,255,.4)] hover:bg-[#ffd16f]"><Link href="/register">{t("Create your free account")} <ArrowRight className="size-4"/></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-xl border-[#f3bd55]/25 bg-black/55 px-7 font-semibold text-white shadow-[0_0_20px_rgba(0,0,0,.25)] backdrop-blur hover:border-[#f3bd55]/55 hover:bg-black/70"><a href="#how"><span className="me-2 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#f3bd55]/80 bg-[#f3bd55]/10 text-[#f3bd55] shadow-[0_0_12px_rgba(243,189,85,.18)]"><Play className="size-4 fill-[#f3bd55] stroke-[2.2]"/></span>{t("See how it works")}</a></Button>
            </div>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {([[Settings,t("No technical skills required")],[Zap,t("Quick setup in minutes")],[Layers3,t("Everything in one platform")]] as Array<[LucideIcon,string]>).map(([Icon,label])=><div key={label} className="flex min-h-[68px] items-center gap-3 rounded-xl border border-[#e7b354]/20 bg-black/55 px-3 py-3 text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-md"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#f3bd55]/35 bg-[#f3bd55]/10 text-[#f3bd55] shadow-[0_0_14px_rgba(243,189,85,.12)]"><Icon className="size-5"/></span><span className="leading-4">{label}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="businesses" className="relative isolate overflow-hidden border-y border-white/10 bg-[#090a09] py-16">
        <Image src="/brand/Lobbу futuriste noir et or.png" alt="" fill quality={100} className="-z-20 object-cover object-center opacity-70"/>
        <div className="absolute inset-0 -z-10 bg-black/45"/>
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="mb-10 text-center text-2xl font-bold tracking-[-.02em] text-white sm:text-3xl">{t("Perfect for")} <span className="text-[#f3bd55]">{t("any type of business")}</span></p>
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

      
      <section id="how" className="relative isolate overflow-hidden py-16 sm:py-24 mobile-lite-section">
        <Image src="/brand/Arrière-plan doré futuriste avec cartes élégantes.png" alt="" fill quality={75} sizes="100vw" className="-z-20 object-cover object-center"/>
        <div className="absolute inset-0 -z-10 bg-black/35"/>
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <div className="gold-flow-border inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(180deg,rgba(31,24,10,.88),rgba(8,8,7,.92))] px-5 py-2.5 text-xs font-extrabold uppercase tracking-[.08em] text-[#f5c34f] backdrop-blur"><QrCode className="size-4 stroke-[2.4] text-[#f5bd3e] drop-shadow-[0_0_5px_rgba(245,189,62,.55)]"/> {t("How it works")}</div>
            <h2 className="mt-5 text-4xl font-black tracking-[-.035em] sm:text-5xl">{t("Get started in")} <span className="text-[#f3bd55]">{t("3 simple steps")}</span></h2>
            <p className="mt-3 text-base text-white/65 sm:text-lg">{t("Launch your digital loyalty program in minutes.")}</p>
          </div>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-11">
            {([[1,Users,t("Create your account"),t("Sign up and set up your business in a few clicks.")],[2,Palette,t("Customize your loyalty card"),t("Add your logo, colors, and rewards that fit your business.")],[3,Send,t("Share with your customers"),t("Let customers scan, collect stamps, and get rewarded.")]] as Array<[number, LucideIcon, string, string]>).map(([n,I,t,d],idx)=><div key={n} className="how-step-card gold-flow-border group relative flex min-h-[220px] sm:min-h-[250px] flex-col items-center justify-center overflow-visible rounded-2xl bg-black/70 px-6 py-6 sm:px-7 sm:py-8 text-center shadow-[inset_0_0_42px_rgba(243,189,85,.075),0_15px_50px_rgba(0,0,0,.3)] sm:backdrop-blur-sm after:absolute after:-left-10 after:-top-10 after:h-28 after:w-28 after:rounded-full after:bg-[#f3bd55]/10 after:blur-2xl">
              <div className="absolute start-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-[#ffd15c]/80 bg-[radial-gradient(circle_at_38%_32%,#8a621b_0%,#4a340d_46%,#241805_100%)] text-lg font-bold text-[#ffd15c] shadow-[0_0_10px_2px_rgba(243,189,85,.48),0_0_28px_rgba(243,189,85,.32),inset_0_0_12px_rgba(255,211,100,.16)] before:absolute before:-inset-2 before:-z-10 before:rounded-full before:bg-[#f3bd55]/15 before:blur-md before:animate-pulse">{n}</div>
              <div className="flex size-20 items-center justify-center rounded-full border border-[#f3bd55]/55 bg-[#f3bd55]/10 text-[#f3bd55] shadow-[inset_0_0_18px_rgba(243,189,85,.08),0_0_20px_rgba(243,189,85,.18)] transition-all duration-700 group-hover:border-[#ffd66f]/90 group-hover:shadow-[inset_0_0_20px_rgba(243,189,85,.12),0_0_30px_rgba(243,189,85,.38)]"><I className="size-9 stroke-[1.8]"/></div>
              <h3 className="mt-6 text-lg font-bold">{t}</h3>
              <p className="mt-2 max-w-[280px] text-sm leading-6 text-white/65">{d}</p>
              {idx < 2 && <div className="pointer-events-none absolute -right-[36px] top-1/2 z-20 hidden -translate-y-1/2 items-center md:flex"><span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3bd55]/20 blur-xl animate-pulse"/><ArrowRight className="relative size-8 text-[#ffd15c] drop-shadow-[0_0_8px_rgba(243,189,85,.9)] animate-pulse"/></div>}
            </div>)}
          </div>
        </div>
      </section>

      <section id="features" className="relative isolate overflow-hidden border-y border-white/10 bg-[#090a09] py-16 sm:py-24 mobile-lite-section">
        <Image src="/brand/Café de luxe et fidélité dorée.png" alt="" fill quality={75} sizes="100vw" className="-z-20 object-cover object-center"/>
        <div className="absolute inset-0 -z-10 bg-black/50"/>
        <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="hidden lg:block" />
          <div className="flex flex-col justify-center">
            <div className="gold-flow-border inline-flex items-center gap-2.5 rounded-full bg-[linear-gradient(180deg,rgba(31,24,10,.88),rgba(8,8,7,.92))] px-5 py-2.5 text-xs font-extrabold uppercase tracking-[.08em] text-[#f5c34f] backdrop-blur self-start"><Sparkles className="size-4 stroke-[2.4] text-[#f5bd3e] drop-shadow-[0_0_5px_rgba(245,189,62,.55)]"/> {t("Powerful features")}</div>
            <h2 className="mt-4 max-w-xl text-4xl font-bold leading-tight">{t("Everything you need to")} <span className="text-[#f3bd55]">{t("grow your business.")}</span></h2>
            <p className="mt-4 text-white/50">{t("A complete loyalty solution designed for modern businesses.")}</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">{features.map(([I,t,d])=><div key={t} className="gold-flow-border flex min-h-[96px] sm:min-h-[112px] items-center gap-3 sm:gap-4 rounded-xl bg-[#111210]/95 px-3 py-3 sm:px-4 sm:py-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_8px_24px_rgba(0,0,0,.18)]"><div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-[#f3bd55]/20 bg-[linear-gradient(145deg,rgba(243,189,85,.13),rgba(243,189,85,.045))] text-[#f5bd3e] shadow-[inset_0_0_18px_rgba(243,189,85,.04),0_0_12px_rgba(243,189,85,.05)]"><I className="size-9 stroke-[1.8] drop-shadow-[0_0_4px_rgba(243,189,85,.3)]"/></div><div className="min-w-0"><h3 className="text-[15px] font-bold leading-tight text-white">{t}</h3><p className="mt-2 text-[13px] leading-[1.45] text-white/55">{d}</p></div></div>)}</div>
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden px-5 py-14 sm:py-24 mobile-lite-section">
        <Image src="/brand/Rubans dorés sur fond noir luxueux.png" alt="" fill quality={75} sizes="100vw" className="-z-20 object-cover object-center"/>
        <div className="absolute inset-0 -z-10 bg-black/20"/>
        <div className="gold-flow-border mx-auto grid max-w-6xl items-center gap-5 sm:gap-7 overflow-hidden rounded-[24px] bg-black/75 px-5 py-6 sm:px-7 sm:py-7 shadow-[inset_0_0_35px_rgba(243,189,85,.06),0_0_18px_rgba(243,189,85,.20)] backdrop-blur-sm md:grid-cols-[128px_1fr_auto] md:px-8 md:py-8">
          <div className="relative flex size-20 sm:size-28 items-center justify-center rounded-2xl border border-[#f3bd55]/25 bg-[linear-gradient(145deg,rgba(243,189,85,.11),rgba(0,0,0,.55))] text-[#ffc64d] shadow-[inset_0_0_22px_rgba(243,189,85,.07),0_0_16px_rgba(243,189,85,.10)]"><div className="relative mt-3"><BarChart3 className="size-12 sm:size-[62px] stroke-[3] drop-shadow-[0_0_7px_rgba(255,196,65,.55)]"/><ArrowRight className="absolute -right-3 -top-3 size-9 -rotate-45 stroke-[3] text-[#ffd36a] drop-shadow-[0_0_6px_rgba(255,196,65,.5)]"/></div></div>
          <div><h2 className="text-3xl font-bold leading-tight md:text-[32px]">{t("Ready to grow your business")}<br className="hidden lg:block"/> {t("with")} <span className="text-[#f3bd55]">{t("loyalty?")}</span></h2><p className="mt-3 max-w-xl text-base leading-7 text-white/65">{t("Create your free account today and start building")}<br className="hidden lg:block"/> {t("stronger customer relationships.")}</p></div>
          <div className="shrink-0 text-center"><Button asChild size="lg" className="h-14 w-full sm:h-16 sm:min-w-[310px] bg-[#f3bd55] px-8 font-bold text-black shadow-[0_0_16px_rgba(243,189,85,.35),0_10px_35px_rgba(243,189,85,.2)] hover:bg-[#ffd16f]"><Link href="/register">{t("Create your free account")} <ArrowRight className="size-4"/></Link></Button><p className="mt-4 text-sm text-white/55">{t("No credit card required")} <span className="mx-2 text-[#f3bd55]">•</span> {t("Setup in minutes")}</p></div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 text-sm text-white/35 sm:flex-row lg:px-8"><span>{t("© LOYVANCE. Digital loyalty, made simple.")}</span><div className="flex gap-6"><Link href="/login">{t("Sign in")}</Link><Link href="/register">{t("Create account")}</Link><Link href="/analytics-privacy" className="text-[#efbd5d]/70 hover:text-[#efbd5d]">Visitor privacy</Link></div></div></footer>
    </main>
  );
}

