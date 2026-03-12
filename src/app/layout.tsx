import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TesVault — Tesla 行車記錄器 Web 播放器",
  description: "免安裝、支援最新六鏡頭 (HW4) 架構的基於 Web 的 Tesla 行車記錄器播放器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark">
      <body className="antialiased bg-[#0a0a0a] text-[#e5e5e5]">
        {children}
      </body>
    </html>
  );
}
