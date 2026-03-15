import type { Metadata, Viewport } from "next";
import I18nHydrator from "@/components/layout/I18nHydrator";
import "./globals.css";

// ---- SEO Metadata (bilingual zh + en) ----
export const metadata: Metadata = {
  title: "TesVault — Tesla 行車記錄器播放器 | Tesla Dashcam Viewer",
  description:
    "免安裝 Tesla 行車記錄器 Web 播放器，支援六鏡頭 (HW4) 同步播放、哨兵模式、匯出影片。" +
    " Free online Tesla dashcam viewer — 6-camera (HW4) sync playback, Sentry mode, video export. No install needed.",
  keywords: [
    // Chinese keywords
    "Tesla 行車記錄器", "Tesla 行車紀錄器", "特斯拉行車記錄器",
    "TeslaCam 播放器", "哨兵模式播放", "六鏡頭播放",
    "行車記錄器影片", "行車紀錄器備份", "Tesla 事故影片",
    "Tesla dashcam 查看", "特斯拉影片匯出",
    "行車記錄器剪輯", "Tesla 影片剪輯", "事故影片處理",
    // English keywords
    "Tesla dashcam viewer", "Tesla dashcam player", "TeslaCam viewer",
    "Tesla sentry mode viewer", "Tesla HW4 dashcam", "6 camera dashcam",
    "Tesla dashcam export", "Tesla accident footage", "TeslaCam backup",
    "Tesla dashcam online", "free Tesla dashcam player",
    "Tesla USB dashcam", "Tesla sentry clip viewer",
  ],
  authors: [{ name: "Earvin Chen" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TesVault",
  },
  icons: {
    apple: "/icon-180.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "TesVault — Tesla Dashcam Viewer",
    description:
      "Free online Tesla dashcam viewer with 6-camera sync playback, Sentry mode support, and video export. No install needed.",
    siteName: "TesVault",
    type: "website",
    locale: "zh_TW",
    alternateLocale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TesVault — Tesla Dashcam Viewer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TesVault — Tesla Dashcam Viewer",
    description:
      "Free online Tesla dashcam viewer with 6-camera sync, Sentry mode, and video export.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    languages: {
      "zh-TW": "/",
      "en": "/",
    },
  },
  applicationName: "TesVault",
  creator: "TesVault",
  publisher: "TesVault",
  category: "utility",
};

// viewport-fit=cover is required for env(safe-area-inset-*) to work on iOS notched devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d6adf",
};

// JSON-LD structured data for rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "TesVault",
  alternateName: "TesVault Tesla Dashcam Viewer",
  description:
    "Free online Tesla dashcam viewer with 6-camera (HW4) sync playback, Sentry mode support, and video export.",
  url: "https://tesvault.vercel.app",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern browser with HTML5 video support",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "6-camera synchronized playback (HW4)",
    "4-camera playback (HW3)",
    "Sentry mode clip viewer",
    "Video export with hardware acceleration",
    "iOS and desktop support",
    "Dark theme",
    "Keyboard shortcuts",
    "No installation required",
  ],
  inLanguage: ["zh-TW", "en"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased bg-[#0a0a0a] text-[#e5e5e5]">
        <I18nHydrator />
        {children}
      </body>
    </html>
  );
}
