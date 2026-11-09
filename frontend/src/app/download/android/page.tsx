import Link from "next/link";
import { Download, Smartphone, ShieldCheck, Globe2 } from "lucide-react";

export const metadata = {
  title: "Loyvance for Android — APK",
  description: "Official Loyvance Android app and installation instructions.",
};

const releasesApi = "https://api.github.com/repos/YoussefLehroudd/Digital-Loyalty-Card-SaaS/releases/latest";

async function findApk() {
  try {
    const response = await fetch(releasesApi, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const release = await response.json() as {
      assets?: Array<{ name: string; browser_download_url: string }>;
    };
    const asset = release.assets?.find((item) => item.name === "Loyvance-Android.apk");
    if (!asset || !asset.browser_download_url.startsWith("https://github.com/")) return null;
    return asset.browser_download_url;
  } catch {
    return null;
  }
}

export default async function AndroidDownloadPage() {
  const apk = await findApk();
  return (
    <main className="min-h-screen bg-[#090b09] px-4 py-16 text-white">
      <section className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#e7b354]/30 bg-[#14150f] p-6 shadow-2xl sm:p-9">
        <div className="flex items-center gap-3 text-[#e7b354]">
          <Smartphone className="size-9"/>
          <div><h1 className="text-2xl font-bold">LOYVANCE Android</h1><p className="text-xs text-white/55">Same account · Same rewards · Same website data</p></div>
        </div>
        {apk ? <>
          <p className="text-sm leading-7 text-white/75">Download the official signed Loyvance Android APK. Your account and cards remain synchronized with the website.</p>
          <a href={apk} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e7b354] px-5 py-3 font-bold text-black"><Download className="size-5"/> Download Android APK</a>
          <p className="text-xs text-white/55">Android may ask you to allow installation from this browser. Download only from the official release linked here.</p>
        </> : <>
          <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            The official APK has not been published yet. Download will appear here after the signed Android release is available.
          </div>
          <Link className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e7b354]/50 px-4 font-semibold text-[#e7b354]" href="/user/install">
            <Globe2 className="size-5"/> Install the current web app instead
          </Link>
        </>}
        <p className="flex items-start gap-2 text-xs leading-5 text-white/55"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#e7b354]"/>The Android wrapper requires Chrome or another compatible browser, internet access for live data, and verified domain association for full-screen Trusted Web Activity mode.</p>
        <Link href="/" className="block text-center text-sm text-[#e7b354] underline">Back to Loyvance</Link>
      </section>
    </main>
  );
}
