import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { GlobalEchoProvider } from "@/components/echo/global-echo-provider";

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
          <GlobalEchoProvider>{children}</GlobalEchoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
