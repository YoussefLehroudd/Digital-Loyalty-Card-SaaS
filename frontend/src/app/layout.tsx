import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { GlobalEchoProvider } from "@/components/echo/global-echo-provider";

import { InstallAppBanner } from "@/components/pwa/install-app-banner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LOYVANCE", statusBarStyle: "black-translucent" },
  title: "LOYVANCE",
  description:
    "A multi-tenant loyalty card platform for customer stamps, rewards, and QR-based visits.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/brand/favicon.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "LOYVANCE",
    description:
      "A multi-tenant loyalty card platform for customer stamps, rewards, and QR-based visits.",
    images: ["/brand/og-image.png"],
  },
};

export const viewport: Viewport = { themeColor: "#080907" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <GlobalEchoProvider>
            <InstallAppBanner />
            {children}
          </GlobalEchoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
