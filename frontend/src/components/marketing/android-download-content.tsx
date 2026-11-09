"use client";
import Link from "next/link";
import {Download,Smartphone,ShieldCheck,Globe2} from "lucide-react";
import {useI18n} from "@/components/i18n/language-provider";

export function AndroidDownloadContent({available,version}:{available:boolean;version:string}){
 const {t,language}=useI18n();
 return <main lang={language} dir={language==="ar"?"rtl":"ltr"} className="min-h-screen bg-[#090b09] px-4 py-16 text-white">
  <section className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#e7b354]/30 bg-[#14150f] p-6 shadow-2xl sm:p-9">
   <div className="flex items-center gap-3 text-[#e7b354]">
    <Smartphone className="size-9"/>
    <div><h1 className="text-2xl font-bold">{t("LOYVANCE Android")}</h1><p className="text-xs text-white/55">{t("Same account · Same rewards · Same website data")}</p></div>
   </div>
   {available?<>
    <p className="text-sm leading-7 text-white/75">{t("Download the official signed Loyvance Android APK. Your account and cards remain synchronized with the website.")}</p>
    <a href="/downloads/Loyvance-Android.apk" download="Loyvance-Android.apk" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e7b354] px-5 py-3 font-bold text-black"><Download className="size-5"/>{t("Download Android APK")}{version?" · "+version:""}</a>
    <p className="text-xs text-white/55">{t("Android may ask you to allow installation from this browser. Download only from the official site.")}</p>
   </>:<>
    <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
     {t("The official signed APK has not been published yet. Once the Android release is signed, the download will appear here automatically.")}
    </div>
    <Link className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e7b354]/50 px-4 font-semibold text-[#e7b354]" href="/user/install"><Globe2 className="size-5"/>{t("Install the current web app instead")}</Link>
   </>}
   <p className="flex items-start gap-2 text-xs leading-5 text-white/55"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#e7b354]"/>{t("The Android app needs a compatible browser and internet connection for live data. QR camera and notifications depend on device permissions.")}</p>
   <Link href="/" className="block text-center text-sm text-[#e7b354] underline">{t("Back to Loyvance")}</Link>
  </section>
 </main>;
}
