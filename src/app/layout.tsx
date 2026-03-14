import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TesVault — Tesla 行車記錄器 Web 播放器",
  description: "免安裝、支援最新六鏡頭 (HW4) 架構的 Tesla 行車記錄器 Web 播放器",
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
        {children}
      </body>
    </html>
  );
}
