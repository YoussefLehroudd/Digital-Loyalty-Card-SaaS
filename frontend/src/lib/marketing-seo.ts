import type { Metadata } from "next";

// Set NEXT_PUBLIC_SITE_URL to the final public domain when changing domains.
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://loyvance.vercel.app";
export const siteUrl = new URL(configuredUrl).origin;
export const marketingLanguages = { en: siteUrl + "/", fr: siteUrl + "/fr", "x-default": siteUrl + "/" };

export function marketingMetadata(locale: "en" | "fr"): Metadata {
  const isFrench = locale === "fr";
  const title = isFrench ? "Loyvance — Carte de fidélité digitale pour votre commerce" : "Loyvance — Digital Loyalty Cards for Your Business";
  const description = isFrench
    ? "Créez des cartes de fidélité digitales avec QR code pour cafés, restaurants, boutiques et salons. Personnalisez vos tampons et récompenses avec Loyvance."
    : "Create digital loyalty cards and QR code loyalty programs for coffee shops, restaurants, retail stores and salons. Customize stamps and rewards with Loyvance.";
  const url = siteUrl + (isFrench ? "/fr" : "/");
  return {
    metadataBase: new URL(siteUrl), title, description,
    alternates: { canonical: url, languages: marketingLanguages },
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "Loyvance", title, description, url,
      locale: isFrench ? "fr_FR" : "en_US", alternateLocale: [isFrench ? "en_US" : "fr_FR"],
      images: [{ url: "/brand/og-image.png", alt: "Loyvance digital loyalty cards" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/brand/og-image.png"] },
  };
}
