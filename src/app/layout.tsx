import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { NativeAppBootstrap } from "@/components/app/NativeAppBootstrap";
import { NativeAppUpdatePrompt } from "@/components/app/NativeAppUpdatePrompt";
import { PwaRegister } from "@/components/app/PwaRegister";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "퀵배달 메이커",
  description: "퀵·배달 경유지 구설정, 팬 권역, 길찾기를 모바일에서 빠르게 처리하는 앱",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "퀵배달 메이커",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} antialiased`}>
        <NativeAppBootstrap />
        <PwaRegister />
        <NativeAppUpdatePrompt />
        {children}
      </body>
    </html>
  );
}
