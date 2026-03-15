import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageContext";

export const metadata: Metadata = {
  title: {
    default: "TesVault | Tesla 行車記錄器 Web 播放器",
    template: "%s | TesVault",
  },
  description: "免安裝 Tesla 行車記錄器播放器。六鏡頭同步、瀏覽器直接開。發生事故時免下載App，直接在線剪輯Tesla影片。支援HW4。",
  keywords: [
    "Tesla 行車記錄器",
    "TeslaCam viewer",
    "Tesla dashcam",
    "行車記錄器剪輯",
    "Tesla 影片剪輯",
    "Tesla Sentry Mode",
    "事故影片處理",
    "Tesla HW4",
    "TeslaCam Web",
    "行車紀錄器播放器",
  ],
  authors: [{ name: "Earvin Chen" }],
  creator: "TesVault",
  publisher: "TesVault",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    alternateLocale: "en_US",
    siteName: "TesVault",
    title: "TesVault | Tesla 行車記錄器 Web 播放器",
    description: "免安裝 Tesla 行車記錄器播放器。六鏡頭同步、瀏覽器直接開。發生事故時免下載App，直接在線剪輯。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TesVault - Tesla 行車記錄器 Web 播放器",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TesVault | Tesla 行車記錄器 Web 播放器",
    description: "免安裝Tesla行車記錄器播放器。發生事故時免下載App，直接在線剪輯。",
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TesVault",
  },
  icons: {
    apple: "/icon-180.png",
  },
};

// viewport-fit=cover is required for env(safe-area-inset-*) to work on iOS notched devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d6adf",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW" className="dark">
      <body className="antialiased bg-[#0a0a0a] text-[#e5e5e5]">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
