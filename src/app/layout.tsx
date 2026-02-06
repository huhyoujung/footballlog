import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "네모의 꿈",
  description: "축구 팀원들을 위한 운동 일지 SNS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "네모의 꿈",
  },
};

export const viewport: Viewport = {
  themeColor: "#967B5D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className="antialiased bg-gray-50 min-h-screen"
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
